import * as cheerio from "cheerio";
import type { AdmissionTypeRatio, DepartmentRatio, UniversityRatioDetail } from "./types.js";

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
  return new Date(Number(y), Number(mo) - 1, Number(d), h, Number(mi));
}

/**
 * addon.jinhakapply.com 상세 페이지를 파싱한다.
 * 전형별로 <div id="SelTypeXXX"> 안에 "모집단위/모집인원/지원인원/경쟁률" 4열 표가 들어있고,
 * uwayapply와 달리 단과대학(college) 컬럼이 없는 평탄한 구조라 rowspan 처리가 필요 없다.
 */
export async function parseJinhakapplyDetail(
  url: string,
  universityName: string
): Promise<UniversityRatioDetail> {
  const html = await fetchUtf8(url);
  const $ = cheerio.load(html);

  const capturedAtRaw = $("#RatioTime").first().text().trim() || null;
  const capturedAt = parseCapturedAt(capturedAtRaw);

  const admissionTypes: AdmissionTypeRatio[] = [];

  $("div[id^='SelType']").each((_, div) => {
    const $div = $(div);
    const rawTitle = $div.find("h2").first().text().trim(); // "일반학생(정원내) 경쟁률 현황"
    const titleMatch = rawTitle.match(/^(.+?)\s*경쟁률 현황$/);
    const fullName = (titleMatch ? titleMatch[1] : rawTitle).trim();

    const quotaMatch = fullName.match(/\((정원내|정원외)\)$/);
    const quotaGroup = quotaMatch ? quotaMatch[1] : null;

    const departments: DepartmentRatio[] = [];

    $div.find("table.tableRatio3 tr").each((__, tr) => {
      const $tr = $(tr);
      if ($tr.hasClass("total")) return; // 총계 행 제외 (아래에서 별도 합산)
      const tds = $tr.find("> td");
      if (tds.length < 4) return; // 헤더행 제외

      const name = tds.eq(0).text().trim();
      if (!name) return;

      const capacityRaw = tds.eq(1).text().trim();
      const applicantsRaw = tds.eq(2).text().trim();
      const ratioRaw = tds.eq(3).text().trim();

      departments.push({
        college: null,
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
    admissionTypes,
  };
}
