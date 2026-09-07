import * as cheerio from "cheerio";
import { fetchEucKr } from "./http.js";
import type { DetailSource, UniversityMapping } from "./types.js";

const LIST_URL = "https://info.uway.com/power/?isApply=1";

function classifySource(href: string | undefined): DetailSource {
  if (!href) return "unknown";
  if (href.includes("ratio.uwayapply.com")) return "uwayapply";
  if (href.includes("addon.jinhakapply.com")) return "jinhakapply";
  return "unknown";
}

/**
 * 일부 대학은 목록에서 바로 상세 경쟁률 URL로 가지 않고
 * ratio.uwayapply.com/power/?ratioURL=...&applyURL=...&ratioNM=... 형태의 프레임셋 래퍼로 연결된다.
 * 이 래퍼는 실제로 ratioURL 쿼리 파라미터 값을 그대로 iframe(powerMain)에 로드하므로,
 * 굳이 프레임셋을 거치지 않고 ratioURL 값을 디코딩해 바로 최종 상세 URL로 쓸 수 있다.
 */
function resolveDetailUrl(href: string): string {
  if (!href.includes("/power/?")) return href;

  const query = href.split("?")[1] ?? "";
  const params = new URLSearchParams(query);
  const ratioUrl = params.get("ratioURL"); // 예: //ratio.uwayapply.com/Sl5K...
  if (!ratioUrl) return href;

  return ratioUrl.startsWith("//") ? `https:${ratioUrl}` : ratioUrl;
}

/**
 * info.uway.com/power 목록 페이지를 파싱해 대학별 상세 경쟁률 URL 매핑을 만든다.
 * 목록 자체는 로그인 없이 정적 HTML로 내려오므로 fetch + cheerio만으로 충분하다.
 */
export async function fetchMapping(): Promise<UniversityMapping[]> {
  const html = await fetchEucKr(LIST_URL);
  const $ = cheerio.load(html);

  const rows: UniversityMapping[] = [];

  $("tbody tr[data-state]").each((_, el) => {
    const $row = $(el);
    const tds = $row.find("> td");
    if (tds.length < 6) return;

    const status = $row.attr("data-state") ?? tds.eq(0).text().trim();
    const category = tds.eq(1).text().trim();
    const region = tds.eq(2).text().trim() || null;
    const foundedType = tds.eq(3).text().trim() || null;

    const nameCell = tds.eq(4);
    const name = nameCell.text().trim();
    const applyUrl = nameCell.find("a").attr("href") ?? null;

    const applyPeriodRaw = tds.eq(5).text().trim() || null;

    const rawDetailHref = tds.eq(6).find("a").attr("href");
    const detailHref =
      rawDetailHref && rawDetailHref !== "javascript:void(0);"
        ? resolveDetailUrl(rawDetailHref)
        : undefined;
    const detailSource = classifySource(detailHref);
    const detailUrl = detailHref ?? null;

    if (!name) return;

    rows.push({
      name,
      category,
      region,
      foundedType,
      status,
      applyPeriodRaw,
      applyUrl,
      detailSource,
      detailUrl,
    });
  });

  return rows;
}

async function main() {
  const rows = await fetchMapping();
  const bySource = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.detailSource] = (acc[r.detailSource] ?? 0) + 1;
    return acc;
  }, {});

  console.log(`총 ${rows.length}개 대학 매핑 완료`);
  console.log("소스별 분포:", bySource);
  console.log(JSON.stringify(rows.slice(0, 5), null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
