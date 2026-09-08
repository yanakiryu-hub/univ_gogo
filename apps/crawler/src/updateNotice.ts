import * as cheerio from "cheerio";

/**
 * 대학 상세 페이지에 실제로 적혀있는 "경쟁률 업데이트 안내" 문구를 읽어온다.
 * 우리가 몇 분마다 크롤링하는지가 아니라, 사이트 자체가 언제 값을 갱신/발표하는지가
 * 대학마다 다르기 때문에(예: "10분마다", "1시간 단위", "매일 10시·14시·17시") 원문을 그대로 보여준다.
 *
 * uwayapply는 <dl id="Ratio_Comment">, jinhakapply는 <ul id="TopType">에 안내문이 들어있고,
 * 그 안에 원서접수 기간 등 다른 공지도 섞여있어서 "업데이트/갱신/발표" 키워드가 들어간 줄만 골라낸다.
 */
export function extractUpdateNotice($: cheerio.CheerioAPI, selector: string): string | null {
  let html = $(selector).first().html() ?? "";
  if (!html) return null;

  html = html.replace(/<br\s*\/?>/gi, "\n").replace(/<\/?li[^>]*>/gi, "\n");
  const text = cheerio.load(`<div>${html}</div>`).text();

  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const matches = lines.filter((l) => /업데이트|갱신|발표/.test(l));

  return matches.join(" / ") || null;
}
