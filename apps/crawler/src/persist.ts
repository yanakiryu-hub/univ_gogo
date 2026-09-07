import { prisma } from "../../../packages/db/src/client.js";
import { kstToUtcDate } from "./kst.js";
import { matchSelection } from "./matchSelection.js";
import { parseJinhakapplyDetail } from "./parseJinhakapplyDetail.js";
import { parseUwayDetail } from "./parseUwayDetail.js";
import { resolveTargets } from "./resolveTargets.js";
import { TARGET_SELECTIONS, type TargetSelection } from "./targets.js";
import type { AdmissionTypeRatio, DepartmentRatio, UniversityMapping } from "./types.js";

function parseApplyPeriod(raw: string | null): { start: Date | null; end: Date | null } {
  if (!raw) return { start: null, end: null };
  const m = raw.match(/(\d{4})\.(\d{2})\.(\d{2})\s*~\s*(\d{4})\.(\d{2})\.(\d{2})/);
  if (!m) return { start: null, end: null };
  const [, sy, smo, sd, ey, emo, ed] = m;
  return {
    start: kstToUtcDate(Number(sy), Number(smo), Number(sd)),
    end: kstToUtcDate(Number(ey), Number(emo), Number(ed)),
  };
}

function label(s: TargetSelection): string {
  return `${s.university} ${s.department} (${s.admissionType})`;
}

export async function persistUniversity(m: UniversityMapping) {
  const { start, end } = parseApplyPeriod(m.applyPeriodRaw);
  return prisma.university.upsert({
    where: { name: m.name },
    create: {
      name: m.name,
      category: m.category,
      region: m.region,
      foundedType: m.foundedType,
      status: m.status,
      applyStart: start,
      applyEnd: end,
      applyUrl: m.applyUrl,
      detailSource: m.detailSource,
      detailUrl: m.detailUrl!,
    },
    update: {
      category: m.category,
      region: m.region,
      foundedType: m.foundedType,
      status: m.status,
      applyStart: start,
      applyEnd: end,
      applyUrl: m.applyUrl,
      detailSource: m.detailSource,
      detailUrl: m.detailUrl!,
    },
  });
}

/** 매칭된 전형 하나 + 학과 하나만 저장한다 (targets.ts에서 고른 항목만 DB/화면에 남기기 위함) */
export async function persistSelectionResult(
  universityId: string,
  capturedAt: Date,
  at: AdmissionTypeRatio,
  dept: DepartmentRatio
) {
  const admissionType = await prisma.admissionType.upsert({
    where: { universityId_name: { universityId, name: at.name } },
    create: {
      universityId,
      name: at.name,
      quotaGroup: at.quotaGroup,
      capacity: at.capacity,
      applicants: at.applicants,
      ratio: at.ratio,
      capturedAt,
    },
    update: {
      quotaGroup: at.quotaGroup,
      capacity: at.capacity,
      applicants: at.applicants,
      ratio: at.ratio,
      capturedAt,
    },
  });

  const college = dept.college ?? "";
  const department = await prisma.department.upsert({
    where: {
      admissionTypeId_college_name: { admissionTypeId: admissionType.id, college, name: dept.name },
    },
    create: {
      admissionTypeId: admissionType.id,
      college,
      name: dept.name,
      capacityRaw: dept.capacityRaw,
      capacity: dept.capacity,
      applicants: dept.applicants,
      ratio: dept.ratio,
    },
    update: {
      capacityRaw: dept.capacityRaw,
      capacity: dept.capacity,
      applicants: dept.applicants,
      ratio: dept.ratio,
    },
  });

  await prisma.ratioSnapshot.create({
    data: { departmentId: department.id, capturedAt, applicants: dept.applicants, ratio: dept.ratio },
  });
}

export interface CrawlRunResult {
  target: string;
  status: "ok" | "skipped" | "error";
  detail?: string;
}

/**
 * targets.ts(TARGET_SELECTIONS)에 지정한 (대학, 전형, 학과) 조합만 크롤링해서 DB에 저장한다.
 * 대학 하나당 상세 페이지는 한 번만 불러오고, 그 안에서 필요한 선택 항목들만 골라서 저장한다.
 * 웹 대시보드/CLI 양쪽에서 공용으로 쓰는 진입점.
 */
export interface CrawlAndPersistOptions {
  /**
   * true면 detailSource가 jinhakapply인 대학은 아예 시도하지 않고 skipped 처리한다.
   * addon.jinhakapply.com이 해외 IP를 차단해서, 해외 리전에 배포된 서버(Railway 등)에서는
   * 매번 403만 반복되므로 로컬 push 스크립트(pushJinhakapply.ts)에게 맡기고 조용히 건너뛴다.
   */
  skipJinhakapply?: boolean;
}

export async function crawlAndPersistAll(options: CrawlAndPersistOptions = {}): Promise<CrawlRunResult[]> {
  const resolved = await resolveTargets();
  const results: CrawlRunResult[] = [];

  for (const r of resolved) {
    const selections = TARGET_SELECTIONS.filter((s) => s.university === r.target);

    if (!r.mapping?.detailUrl) {
      for (const s of selections) {
        results.push({ target: label(s), status: "skipped", detail: "상세 링크 없음 (접수 시작 전으로 추정)" });
      }
      continue;
    }
    if (r.ambiguous) {
      for (const s of selections) {
        results.push({
          target: label(s),
          status: "skipped",
          detail: `이름 부분일치("${r.mapping.name}") - 확인 필요`,
        });
      }
      continue;
    }
    if (options.skipJinhakapply && r.mapping.detailSource === "jinhakapply") {
      for (const s of selections) {
        results.push({
          target: label(s),
          status: "skipped",
          detail: "진학어플라이 소스 - 로컬 크롤러(push:jinhakapply)가 담당",
        });
      }
      continue;
    }

    const m = r.mapping;
    try {
      const detail =
        m.detailSource === "jinhakapply"
          ? await parseJinhakapplyDetail(m.detailUrl!, m.name)
          : await parseUwayDetail(m.detailUrl!, m.name);
      const capturedAt = detail.capturedAt ?? new Date();
      const university = await persistUniversity(m);

      for (const s of selections) {
        const match = matchSelection(detail, s);
        if (!match.admissionType || !match.department) {
          results.push({
            target: label(s),
            status: "error",
            detail: `사이트에서 "${s.admissionType}" / "${s.department}"를 찾지 못함 - 실제 표기 확인 필요`,
          });
          continue;
        }

        await persistSelectionResult(university.id, capturedAt, match.admissionType, match.department);
        results.push({
          target: label(s),
          status: "ok",
          detail: `경쟁률 ${match.department.ratio ?? "-"} : 1`,
        });
      }
    } catch (err) {
      for (const s of selections) {
        results.push({ target: label(s), status: "error", detail: String(err) });
      }
    }
  }

  return results;
}
