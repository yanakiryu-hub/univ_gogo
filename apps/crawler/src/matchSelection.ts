import type { AdmissionTypeRatio, DepartmentRatio, UniversityRatioDetail } from "./types.js";
import type { TargetSelection } from "./targets.js";

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[()·・\-_]/g, "");
}

/** "전형" 표기 유무는 대학마다 제각각이라(예: "자기추천" vs "자기추천전형") 비교 전에 제거한다 */
function stripJeonhyeong(s: string): string {
  return s.replace(/전형/g, "");
}

/**
 * "학생부교과(OOO)", "학생부종합(OOO)" 같은 사이트 쪽 상위 분류 접두어는
 * 사용자가 적는 축약 표기에는 보통 없어서, 비교 전에 제거해 핵심 이름끼리만 비교되게 한다.
 */
function stripBoilerplate(s: string): string {
  return s.replace(/학생부(교과|종합)|실기\/?실적/g, "");
}

function bigrams(s: string): Set<string> {
  const set = new Set<string>();
  for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2));
  if (set.size === 0 && s.length > 0) set.add(s);
  return set;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

/**
 * 사용자가 적은 표기와 실제 사이트 표기가 완전히 같지 않을 수 있어
 * (괄호/공백/"전형" 접미사 차이, 학과명 약칭 등) 두 단계로 비교한다.
 * 1) 정규화 후 "사이트 표기가 사용자가 적은 이름을 포함하는지" (사이트 쪽이 보통 더 정식/상세한 표기라 이 방향만 확인)
 * 2) 실패 시 글자 2-gram Jaccard 유사도 (예: "일어일문전공" vs "일어일문학전공")
 *
 * 주의: 반대 방향(사용자가 적은 이름이 사이트 표기를 포함하는지)은 확인하지 않는다.
 * 학과명은 "화학과"처럼 짧은 단어가 "일본언어문화학과" 같은 다른 학과명 안에 우연히
 * 부분 포함되는 경우가 있어, 그 방향을 허용하면 엉뚱한 학과가 매칭될 수 있다.
 */
export function fuzzyMatch(siteText: string, queryText: string): boolean {
  const a = normalize(stripBoilerplate(stripJeonhyeong(siteText)));
  const b = normalize(stripBoilerplate(stripJeonhyeong(queryText)));
  if (!a || !b) return false;
  if (a.includes(b)) return true;
  return jaccard(bigrams(a), bigrams(b)) >= 0.5;
}

export interface MatchResult {
  selection: TargetSelection;
  admissionType: AdmissionTypeRatio | null;
  department: DepartmentRatio | null;
}

/**
 * 파싱된 대학 상세 데이터에서 targets.ts에 적은 전형/학과와 가장 근접하게 일치하는 항목을 찾는다.
 *
 * 전형명이 여러 캠퍼스/전형에서 비슷하게 겹치는 경우가 있다
 * (예: 경희대 "서울캠퍼스 학생부종합(네오르네상스전형)"과 "국제캠퍼스 학생부종합(네오르네상스전형)").
 * 첫 번째로 이름이 맞는 전형만 보면 학과가 없는 엉뚱한 캠퍼스에서 멈출 수 있어서,
 * 이름이 맞는 전형 후보를 전부 모은 뒤 그 안에 학과까지 있는 후보를 우선한다.
 */
export function matchSelection(detail: UniversityRatioDetail, selection: TargetSelection): MatchResult {
  const candidates = detail.admissionTypes.filter((at) => fuzzyMatch(at.name, selection.admissionType));

  if (candidates.length === 0) {
    return { selection, admissionType: null, department: null };
  }

  for (const at of candidates) {
    const department = at.departments.find((d) => fuzzyMatch(d.name, selection.department));
    if (department) {
      return { selection, admissionType: at, department };
    }
  }

  // 이름은 맞는데 그 안에 학과가 없음 - 첫 후보를 보고해서 "확인 필요" 메시지에 어떤 전형이 걸렸는지 알 수 있게 한다.
  return { selection, admissionType: candidates[0], department: null };
}
