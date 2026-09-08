/**
 * 26학년도(전년도) 수시 경쟁률 참고값. 크롤링으로 자동 수집되는 값이 아니라
 * 사람이 조사해서 직접 입력한 고정 참고자료다 (2026-09-08 기준 사용자 제공).
 */
const PREV_YEAR_RATIO = [
  { univ: "숙명여자대학교", match: () => true, ratio: 11.31 },
  { univ: "한국외국어대학교", match: (dept) => dept.includes("태국"), ratio: 10.3 },
  { univ: "한국외국어대학교", match: (dept) => dept.includes("이란") || dept.includes("페르시아"), ratio: 7.2 },
  { univ: "숭실대학교", match: () => true, ratio: 27.4 },
  { univ: "건국대학교(서울)", match: () => true, ratio: 9.69 },
  { univ: "국민대학교", match: () => true, ratio: 13.56 },
  { univ: "경희대학교", match: () => true, ratio: 16.2 },
  { univ: "경기대학교", match: () => true, ratio: 16.38 },
  { univ: "명지대학교", match: () => true, ratio: 38.5 },
  { univ: "광운대학교", match: () => true, ratio: 22.7 },
  { univ: "성신여자대학교", match: () => true, ratio: 8.38 },
  { univ: "가천대학교", match: () => true, ratio: 34.36 },
  { univ: "중앙대학교", match: () => true, ratio: 16.1 },
  { univ: "서울여자대학교", match: () => true, ratio: 16.6 },
  { univ: "인하대학교", match: () => true, ratio: 14.2 },
  { univ: "인천대학교", match: () => true, ratio: 11.09 },
];

function getPrevYearRatio(universityName, departmentName) {
  const uni = (universityName || "").replace(/\s*U$/, "").trim();
  const dept = departmentName || "";
  const entry = PREV_YEAR_RATIO.find((e) => e.univ === uni && e.match(dept));
  return entry ? entry.ratio : null;
}

function prevYearRatioHtml(universityName, departmentName) {
  const ratio = getPrevYearRatio(universityName, departmentName);
  if (ratio === null || ratio === undefined) return '<span class="univ-sub">미확인</span>';
  return `${ratio.toFixed(2)} : 1`;
}
