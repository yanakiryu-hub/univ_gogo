import { parseJinhakapplyDetail } from "./parseJinhakapplyDetail.js";
import { parseUwayDetail } from "./parseUwayDetail.js";
import { resolveTargets } from "./resolveTargets.js";

/**
 * targets.ts에 지정한 대학 중 상세 경쟁률 링크가 준비된 대학만 순회하며 파싱한다.
 * 아직 접수를 시작하지 않아 링크가 없는 대학(예: 9/8 접수 시작 예정)은 건너뛰고 로그만 남긴다.
 */
async function main() {
  const resolved = await resolveTargets();

  for (const r of resolved) {
    if (!r.mapping?.detailUrl) {
      console.log(`⏳ SKIP ${r.target} - 아직 상세 경쟁률 링크 없음`);
      continue;
    }

    const m = r.mapping;
    if (r.ambiguous) {
      console.log(`⚠️  ${r.target} -> "${m.name}"은(는) 이름 부분일치라 다른 캠퍼스/분교일 수 있음. 건너뜀 (확인 후 targets.ts 조정 필요)`);
      continue;
    }

    try {
      const detail =
        m.detailSource === "jinhakapply"
          ? await parseJinhakapplyDetail(m.detailUrl!, m.name)
          : await parseUwayDetail(m.detailUrl!, m.name);

      console.log(
        `✅ ${m.name} | 기준: ${detail.capturedAtRaw} | 전형 ${detail.admissionTypes.length}개 | 학과 합계 ${detail.admissionTypes.reduce((s, a) => s + a.departments.length, 0)}개`
      );
    } catch (err) {
      console.error(`❌ ${m.name} 파싱 실패:`, err);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
