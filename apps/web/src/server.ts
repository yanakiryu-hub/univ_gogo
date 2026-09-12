import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "../../../packages/db/src/client.js";
import { fuzzyMatch } from "../../crawler/src/matchSelection.js";
import { persistSelectionResult, persistUniversity } from "../../crawler/src/persist.js";
import { TARGET_SELECTIONS, TARGET_UNIVERSITIES } from "../../crawler/src/targets.js";
import type { AdmissionTypeRatio, DepartmentRatio, UniversityMapping } from "../../crawler/src/types.js";
import { forceTickOnce, getCrawlStatus, startCrawlLoop, stopCrawlLoop } from "./runner.js";

/** targets.ts에 적어둔 대학 순서대로 대시보드에 노출한다. 목록에 없는 이름은 뒤로 보낸다. */
function targetOrderIndex(universityName: string): number {
  const normalized = universityName.replace(/\s*U$/, "").trim();
  const idx = TARGET_UNIVERSITIES.indexOf(normalized);
  return idx === -1 ? TARGET_UNIVERSITIES.length : idx;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT ?? 4000);

app.use(express.static(path.join(__dirname, "..", "public")));
app.use(express.json());

// 대시보드에 필요한 전체 상태: 대학 목록 + 전형 + 학과별 현재 경쟁률 + 크롤러 상태
app.get("/api/state", async (_req, res) => {
  const universities = (
    await prisma.university.findMany({
      include: {
        admissionTypes: {
          orderBy: { name: "asc" },
          include: {
            departments: {
              orderBy: [{ college: "asc" }, { name: "asc" }],
            },
          },
        },
      },
    })
  ).sort((a, b) => targetOrderIndex(a.name) - targetOrderIndex(b.name));

  const lastMappedAt = universities.reduce<Date | null>((max, u) => {
    if (!max || u.lastMappedAt > max) return u.lastMappedAt;
    return max;
  }, null);

  const lastCapturedAt = universities.reduce<Date | null>((max, u) => {
    for (const at of u.admissionTypes) {
      if (!max || at.capturedAt > max) max = at.capturedAt;
    }
    return max;
  }, null);

  res.json({
    universities,
    lastMappedAt,
    lastCapturedAt,
    crawlStatus: getCrawlStatus(),
  });
});

// 대학 하나의 학과별 시간대별 경쟁률 변화 (그래프용)
app.get("/api/universities/:id/history", async (req, res) => {
  const university = await prisma.university.findUnique({
    where: { id: req.params.id },
    include: {
      admissionTypes: {
        orderBy: { name: "asc" },
        include: {
          departments: {
            orderBy: [{ college: "asc" }, { name: "asc" }],
            include: {
              snapshots: { orderBy: { capturedAt: "asc" } },
            },
          },
        },
      },
    },
  });

  if (!university) {
    res.status(404).json({ error: "not found" });
    return;
  }

  res.json(university);
});

/**
 * "경쟁률보드" 페이지용: targets.ts에 등록한 (대학,전형,학과) 16건 전부를 순서대로 반환한다.
 * DB에 아직 없는 항목(접수 시작 전 등)은 status: "pending"으로, 있으면 "ready"로 현재값+시간대별 스냅샷을 담는다.
 */
app.get("/api/board", async (_req, res) => {
  const universities = await prisma.university.findMany({
    include: {
      admissionTypes: {
        include: {
          departments: {
            include: { snapshots: { orderBy: { capturedAt: "asc" } } },
          },
        },
      },
    },
  });

  const findUniversity = (name: string) =>
    universities.find((u) => u.name.replace(/\s*U$/, "").trim() === name);

  const rows = TARGET_SELECTIONS.map((sel) => {
    const uni = findUniversity(sel.university);
    const base = {
      university: sel.university,
      department: sel.department,
      admissionType: sel.admissionType,
      core: Boolean(sel.core),
    };

    if (!uni) {
      return { ...base, status: "pending" as const };
    }

    for (const at of uni.admissionTypes) {
      if (!fuzzyMatch(at.name, sel.admissionType)) continue;
      for (const d of at.departments) {
        if (!fuzzyMatch(d.name, sel.department)) continue;
        return {
          ...base,
          status: "ready" as const,
          universityId: uni.id,
          universityStatus: uni.status,
          detailSource: uni.detailSource,
          updateNotice: uni.updateNotice,
          admissionTypeName: at.name,
          quotaGroup: at.quotaGroup,
          departmentName: d.name,
          college: d.college || null,
          capacityRaw: d.capacityRaw,
          capacity: d.capacity,
          applicants: d.applicants,
          ratio: d.ratio,
          capturedAt: at.capturedAt,
          snapshots: d.snapshots.map((s) => ({ capturedAt: s.capturedAt, ratio: s.ratio, applicants: s.applicants })),
        };
      }
    }

    return { ...base, status: "pending" as const };
  });

  res.json({ rows, crawlStatus: getCrawlStatus() });
});

app.post("/api/crawl/start", (_req, res) => {
  startCrawlLoop();
  res.json(getCrawlStatus());
});

// 오전 10시 이전이어도 강제로 한 번 크롤링 (수동 새로고침/디버깅용, 반복 루프 상태는 안 건드림)
app.post("/api/crawl/run-once", async (_req, res) => {
  await forceTickOnce();
  res.json(getCrawlStatus());
});

app.post("/api/crawl/stop", (_req, res) => {
  stopCrawlLoop();
  res.json(getCrawlStatus());
});

app.get("/api/crawl/status", (_req, res) => {
  res.json(getCrawlStatus());
});

interface IngestBody {
  universityMapping: UniversityMapping;
  capturedAt: string | null;
  updateNotice: string | null;
  admissionType: AdmissionTypeRatio;
  department: DepartmentRatio;
}

/**
 * 진학어플라이(addon.jinhakapply.com)는 해외 IP를 막아서 Railway 서버가 직접 크롤링할 수 없다.
 * 대신 한국 IP에서 로컬로 크롤링한 결과를 이 엔드포인트로 전송받아 저장한다.
 * (apps/crawler/src/pushJinhakapply.ts 참고)
 */
app.post("/api/ingest/selection", async (req, res) => {
  const secret = process.env.INGEST_SECRET;
  if (!secret || req.get("x-ingest-secret") !== secret) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  const body = req.body as Partial<IngestBody>;
  if (!body.universityMapping || !body.admissionType || !body.department) {
    res.status(400).json({ error: "invalid body" });
    return;
  }

  try {
    const university = await persistUniversity(body.universityMapping, body.updateNotice);
    const capturedAt = body.capturedAt ? new Date(body.capturedAt) : new Date();
    await persistSelectionResult(university.id, capturedAt, body.admissionType, body.department);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

/**
 * 수시 접수 종료(9/11 20:00 KST) 이후에도 남아있던 스냅샷을 정리하기 위한 일회성 관리자 엔드포인트.
 * cutoff 이후 시각의 RatioSnapshot을 모두 삭제한다. 정리가 끝나면 이 라우트는 제거할 예정.
 */
app.post("/api/admin/cleanup-snapshots", async (req, res) => {
  const secret = process.env.INGEST_SECRET;
  if (!secret || req.get("x-ingest-secret") !== secret) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  const cutoff = req.body?.cutoff ? new Date(req.body.cutoff) : null;
  if (!cutoff || Number.isNaN(cutoff.getTime())) {
    res.status(400).json({ error: "invalid cutoff" });
    return;
  }

  const result = await prisma.ratioSnapshot.deleteMany({
    where: { capturedAt: { gt: cutoff } },
  });
  res.json({ ok: true, deletedCount: result.count, cutoff: cutoff.toISOString() });
});

app.listen(PORT, () => {
  console.log(`univ_gogo web running at http://localhost:${PORT}`);
  // 9/11 20:00 KST 수시 접수 종료로 더 이상 크롤링할 필요가 없어, 서버 부팅 시 자동 시작을 껐다.
  // (필요하면 /api/crawl/start로 수동 시작 가능)
});
