import { fetchMapping } from "./fetchMapping.js";
import { parseJinhakapplyDetail } from "./parseJinhakapplyDetail.js";
import { parseUwayDetail } from "./parseUwayDetail.js";

/**
 * 사용법: npm run detail -- "가톨릭관동대학교"
 * 매핑 목록에서 이름을 찾아 uwayapply 상세 페이지를 파싱해 출력한다.
 */
async function main() {
  const targetName = process.argv[2];
  if (!targetName) {
    console.error('사용법: npm run detail -- "대학명"');
    process.exit(1);
  }

  const mapping = await fetchMapping();
  const univ = mapping.find((u) => u.name.includes(targetName));

  if (!univ) {
    console.error(`"${targetName}"에 해당하는 대학을 목록에서 찾지 못했습니다.`);
    process.exit(1);
  }

  if (!univ.detailUrl) {
    console.error(`"${univ.name}"은(는) 아직 경쟁률이 공개되지 않았습니다 (준비중).`);
    process.exit(1);
  }

  if (univ.detailSource === "unknown") {
    console.error(`"${univ.name}"의 상세 URL 형식을 인식하지 못했습니다: ${univ.detailUrl}`);
    process.exit(1);
  }

  const detail =
    univ.detailSource === "jinhakapply"
      ? await parseJinhakapplyDetail(univ.detailUrl, univ.name)
      : await parseUwayDetail(univ.detailUrl, univ.name);

  console.log(JSON.stringify(detail, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
