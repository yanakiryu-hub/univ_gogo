import { fetchMapping } from "./fetchMapping.js";
import { TARGET_UNIVERSITIES } from "./targets.js";
import type { UniversityMapping } from "./types.js";

export interface ResolvedTarget {
  target: string;
  found: boolean;
  /** true면 완전 일치가 아니라 괄호가 붙은 다른 캠퍼스/분교 등과 매칭된 것일 수 있음 (사람 확인 필요) */
  ambiguous: boolean;
  mapping: UniversityMapping | null;
}

function normalize(name: string): string {
  return name
    .replace(/\s*U$/, "") // 유웨이 단독 표시
    .trim();
}

/**
 * targets.ts에 지정한 대학들을 최신 유웨이 목록과 대조한다.
 * 아직 원서접수가 시작되지 않아 목록 페이지에 등장하지 않는 대학은 found=false로 표시한다
 * (9/8 접수 시작 대학들이 여기 해당할 수 있음).
 *
 * 목록에는 "건국대학교(글로컬)"처럼 분교/캠퍼스가 괄호로 구분되어 별도 항목으로 올라오는 경우가 있어,
 * 정확히 같은 이름이 아니라 부분일치로만 찾은 경우는 ambiguous=true로 표시해 사람이 확인하게 한다.
 */
export async function resolveTargets(): Promise<ResolvedTarget[]> {
  const mapping = await fetchMapping();

  return TARGET_UNIVERSITIES.map((target) => {
    const exact = mapping.find((u) => normalize(u.name) === target);
    if (exact) {
      return { target, found: true, ambiguous: false, mapping: exact };
    }

    const partial = mapping.find((u) => u.name.includes(target));
    if (partial) {
      return { target, found: true, ambiguous: true, mapping: partial };
    }

    return { target, found: false, ambiguous: false, mapping: null };
  });
}

async function main() {
  const resolved = await resolveTargets();

  const ready = resolved.filter((r) => r.mapping?.detailUrl);
  const notYet = resolved.filter((r) => !r.mapping?.detailUrl);

  console.log(`크롤링 가능: ${ready.length}개 / 대기중: ${notYet.length}개\n`);

  for (const r of ready) {
    const m = r.mapping!;
    const mark = r.ambiguous ? "⚠️ (이름 부분일치 - 확인 필요)" : "✅";
    console.log(`${mark} ${r.target} -> ${m.name} | ${m.status} | ${m.applyPeriodRaw} | source=${m.detailSource}`);
  }

  if (notYet.length > 0) {
    console.log("\n--- 아직 상세 경쟁률 링크 없음 (원서접수 시작 전일 가능성) ---");
    for (const r of notYet) {
      console.log(`⏳ ${r.target}${r.mapping ? ` (목록엔 있음: ${r.mapping.status})` : " (목록에 아직 없음)"}`);
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
