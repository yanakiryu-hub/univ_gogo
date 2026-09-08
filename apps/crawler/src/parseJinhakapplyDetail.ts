import * as cheerio from "cheerio";
import { kstToUtcDate } from "./kst.js";
import type { AdmissionTypeRatio, DepartmentRatio, UniversityRatioDetail } from "./types.js";
import { extractUpdateNotice } from "./updateNotice.js";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";

async function fetchUtf8(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  return res.text();
}

function parseRatio(text: string): number | null {
  const m = text.match(/([\d.]+)\s*:\s*1/);
  return m ? Number(m[1]) : null;
}

function parseInt10(text: string): number | null {
  const m = text.match(/\d+/);
  return m ? Number(m[0]) : null;
}

/** "2026-09-07 오후 11:20 현황" -> Date */
function parseCapturedAt(raw: string | null): Date | null {
  if (!raw) return null;
  const m = raw.match(/(\d{4})-(\d{2})-(\d{2})\s*(오전|오후)\s*(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const [, y, mo, d, ampm, hRaw, mi] = m;
  let h = Number(hRaw) % 12;
  if (ampm === "오후") h += 12;
  return kstToUtcDate(Number(y), Number(mo), Number(d), h, Number(mi));
}

type ColumnRole = "group" | "unit" | "capacity" | "applicants" | "ratio" | "ignore";

/**
 * 대학마다 컬럼 구성이 다르다.
 * 대부분: [모집단위, 모집인원, 지원인원, 경쟁률] (college 없음)
 * 건국대(서울) 등 일부: [대학(rowspan), 모집단위, 모집인원, 지원인원, 경쟁률]
 * 고정 offset을 가정하지 않고 헤더 <th> 텍스트로 역할을 분류한다.
 */
function classifyHeader(text: string): ColumnRole {
  if (text.includes("모집단위")) return "unit";
  if (text.includes("모집") && text.includes("인원")) return "capacity";
  if (text.includes("지원") && text.includes("인원")) return "applicants";
  if (text.includes("경쟁률")) return "ratio";
  if (text.includes("안내") || text.includes("홈페이지")) return "ignore";
  return "group"; // 대학/캠퍼스 등 rowspan 그룹 컬럼
}

/**
 * addon.jinhakapply.com 상세 페이지를 파싱한다.
 * 전형별로 <div id="SelTypeXXX"> 안에 표가 들어있고, rowspan으로 생략된 앞쪽 그룹 컬럼(대학 등)은
 * 마지막 값을 이어받는다 (parseUwayDetail.ts와 동일한 방식).
 */
export async function parseJinhakapplyDetail(
  url: string,
  universityName: string
): Promise<UniversityRatioDetail> {
  const html = await fetchUtf8(url);
  const $ = cheerio.load(html);

  const capturedAtRaw = $("#RatioTime").first().text().trim() || null;
  const capturedAt = parseCapturedAt(capturedAtRaw);
  const updateNotice = extractUpdateNotice($, "#TopType");

  const admissionTypes: AdmissionTypeRatio[] = [];

  $("div[id^='SelType']").each((_, div) => {
    const $div = $(div);
    const rawTitle = $div.find("h2").first().text().trim(); // "일반학생(정원내) 경쟁률 현황"
    const titleMatch = rawTitle.match(/^(.+?)\s*경쟁률 현황$/);
    const fullName = (titleMatch ? titleMatch[1] : rawTitle).trim();

    const quotaMatch = fullName.match(/\((정원내|정원외)\)$/);
    const quotaGroup = quotaMatch ? quotaMatch[1] : null;

    const $table = $div.find("table.tableRatio3").first();
    const roles: ColumnRole[] = $table
      .find("tr")
      .first()
      .find("th")
      .toArray()
      .map((th) => classifyHeader($(th).text().trim()));

    if (roles.length === 0) return;

    const unitIdx = roles.indexOf("unit");
    const capIdx = roles.indexOf("capacity");
    const appIdx = roles.indexOf("applicants");
    const ratioIdx = roles.indexOf("ratio");

    const departments: DepartmentRatio[] = [];
    const carry: Record<number, string> = {};

    $table.find("tr").each((__, tr) => {
      const $tr = $(tr);
      if ($tr.hasClass("total")) return; // 총계 행 제외
      const cells = $tr.find("> td").toArray();
      if (cells.length === 0) return; // 헤더행 제외

      const missing = roles.length - cells.length;
      if (missing < 0 || missing >= roles.length) return; // 예상치 못한 구조면 스킵

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

      const name = unitIdx >= 0 ? values[unitIdx] : "";
      if (!name) return;

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
        name,
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
      name: fullName,
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
