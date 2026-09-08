import * as cheerio from "cheerio";
import { fetchEucKr } from "./http.js";
import { kstToUtcDate } from "./kst.js";
import type { AdmissionTypeRatio, DepartmentRatio, UniversityRatioDetail } from "./types.js";
import { extractUpdateNotice } from "./updateNotice.js";

function parseRatio(text: string): number | null {
  const m = text.match(/([\d.]+)\s*:\s*1/);
  return m ? Number(m[1]) : null;
}

function parseInt10(text: string): number | null {
  const m = text.match(/\d+/);
  return m ? Number(m[0]) : null;
}

/** "2026년 09월 07일 23시 20분 기준" -> Date */
function parseCapturedAt(raw: string | null): Date | null {
  if (!raw) return null;
  const m = raw.match(/(\d{4})년\s*(\d{2})월\s*(\d{2})일\s*(\d{2})시\s*(\d{2})분/);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m;
  return kstToUtcDate(Number(y), Number(mo), Number(d), Number(h), Number(mi));
}

type ColumnRole = "group" | "unit" | "capacity" | "applicants" | "ratio" | "ignore";

/**
 * 대학마다 컬럼 구성이 조금씩 다르다.
 * 예) 대부분: [대학(rowspan), 모집단위, 모집인원, 지원인원, 경쟁률, 학과안내, 학과홈페이지]
 *     경기대: [캠퍼스(rowspan), 소속(rowspan), 모집단위, 개설된학과(설명), 모집인원, 지원인원, 경쟁률]
 * 고정된 컬럼 offset을 가정하지 않고, 매 표의 <thead> 텍스트를 보고 역할을 분류한다.
 */
function classifyHeader(text: string): ColumnRole {
  if (text.includes("모집단위")) return "unit";
  if (text.includes("모집") && text.includes("인원")) return "capacity";
  if (text.includes("지원") && text.includes("인원")) return "applicants";
  if (text.includes("경쟁률")) return "ratio";
  if (text.includes("안내") || text.includes("홈페이지") || text.includes("개설된학과")) return "ignore";
  return "group"; // 대학/캠퍼스/소속 등 앞쪽 rowspan 그룹 컬럼
}

/**
 * ratio.uwayapply.com 상세 페이지를 파싱한다.
 * rowspan으로 생략된 앞쪽 그룹 컬럼(대학/캠퍼스/소속 등)은 마지막 값을 이어받아 채운다.
 * 실제 <td> 개수가 헤더 컬럼 수보다 적은 만큼, 앞에서부터(rowspan 대상인 group 컬럼부터) 생략된 것으로 보고
 * 뒤에서부터(오른쪽 정렬) 남은 td를 채워넣는 방식으로 정렬을 맞춘다.
 */
export async function parseUwayDetail(url: string, universityName: string): Promise<UniversityRatioDetail> {
  const html = await fetchEucKr(url);
  const $ = cheerio.load(html);

  const capturedAtRaw =
    $("body")
      .text()
      .match(/\d{4}년\s*\d{2}월\s*\d{2}일\s*\d{2}시\s*\d{2}분\s*기준/)?.[0] ?? null;
  const capturedAt = parseCapturedAt(capturedAtRaw);
  const updateNotice = extractUpdateNotice($, "#Ratio_Comment");

  const admissionTypes: AdmissionTypeRatio[] = [];

  $("div.DivType").each((_, div) => {
    const $div = $(div);
    const title = $div.find("span[id^='strTitleId_']").first().text().trim();
    if (!title) return;

    // "정원내 학생부교과(일반전형) 경쟁률 현황" -> quotaGroup="정원내", name="학생부교과(일반전형)"
    const titleMatch = title.match(/^(정원내|정원외)\s*(.+?)\s*경쟁률 현황$/);
    const quotaGroup = titleMatch ? titleMatch[1] : null;
    const name = titleMatch ? titleMatch[2] : title.replace(/\s*경쟁률 현황$/, "");

    const $table = $div.find("table").first();
    const roles: ColumnRole[] = $table
      .find("thead th")
      .toArray()
      .map((th) => classifyHeader($(th).text().trim()));

    if (roles.length === 0) return;

    // 헤더 문구가 "지원현황"처럼 애매해서 "경쟁률"로 못 잡히는 대학이 있다.
    // 첫 데이터 행(rowspan 생략이 아직 없어 전체 컬럼이 다 채워진 행)의 실제 값이
    // "N : 1" 형태면 그 컬럼은 경쟁률로 간주해 헤더 분류를 보정한다.
    if (!roles.includes("ratio")) {
      const firstRowCells = $table.find("tr.trFieldValue").first().find("> td").toArray();
      if (firstRowCells.length === roles.length) {
        firstRowCells.forEach((td, i) => {
          if (roles[i] === "group" && /\d+(\.\d+)?\s*:\s*1/.test($(td).text())) {
            roles[i] = "ratio";
          }
        });
      }
    }

    const unitIdx = roles.indexOf("unit");
    const capIdx = roles.indexOf("capacity");
    const appIdx = roles.indexOf("applicants");
    const ratioIdx = roles.indexOf("ratio");

    const departments: DepartmentRatio[] = [];
    const carry: Record<number, string> = {}; // group 컬럼의 rowspan 이월 값

    $table.find("tr.trFieldValue").each((__, tr) => {
      const cells = $(tr)
        .find("> td")
        .toArray();
      const missing = roles.length - cells.length;
      if (missing < 0) return; // 예상치 못한 구조면 스킵

      const values: string[] = new Array(roles.length);
      let cellIdx = 0;
      for (let i = 0; i < roles.length; i++) {
        if (i < missing) {
          values[i] = carry[i] ?? "";
        } else {
          const text = $(cells[cellIdx]).text().trim();
          values[i] = text;
          if (roles[i] === "group") carry[i] = text;
          cellIdx++;
        }
      }

      const deptName = unitIdx >= 0 ? values[unitIdx] : "";
      if (!deptName) return;

      const college =
        roles
          .map((r, i) => (r === "group" ? values[i] : null))
          .filter((v): v is string => Boolean(v))
          .join(" ") || null;

      const capacityRaw = capIdx >= 0 ? values[capIdx] : "";
      const applicantsRaw = appIdx >= 0 ? values[appIdx] : "";
      const ratioRaw = ratioIdx >= 0 ? values[ratioIdx] : "";

      departments.push({
        college,
        name: deptName,
        capacityRaw,
        capacity: parseInt10(capacityRaw),
        applicants: applicantsRaw ? parseInt10(applicantsRaw) : null,
        ratio: parseRatio(ratioRaw),
      });
    });

    if (departments.length === 0) return;

    const totalCapacity = departments.reduce((sum, d) => sum + (d.capacity ?? 0), 0);
    const totalApplicants = departments.reduce((sum, d) => sum + (d.applicants ?? 0), 0);

    admissionTypes.push({
      name,
      quotaGroup,
      capacity: totalCapacity || null,
      applicants: totalApplicants || null,
      ratio: totalCapacity ? Number((totalApplicants / totalCapacity).toFixed(2)) : null,
      departments,
    });
  });

  return {
    universityName,
    capturedAt,
    capturedAtRaw,
    updateNotice,
    admissionTypes,
  };
}
