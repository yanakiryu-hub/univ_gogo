/**
 * 크롤링/노출 대상을 (대학, 전형, 학과) 단위로 지정한다.
 * 유웨이 목록 페이지에 쓰이는 정식 대학명을 university에 적어야 fetchMapping 결과와 매칭된다.
 * admissionType/department는 실제 사이트 표기와 완전히 같지 않아도 되고,
 * matchSelection.ts에서 공백/괄호 등을 정규화해 부분일치로 찾는다.
 */
export interface TargetSelection {
  university: string;
  department: string;
  admissionType: string;
  /** 대시보드 "핵심 6개 학과" 탭에 노출할 항목인지 (숙명여대·건국대·한국외대 2건·국민대·숭실대) */
  core?: boolean;
}

export const TARGET_SELECTIONS: TargetSelection[] = [
  { university: "숙명여자대학교", department: "일본학과", admissionType: "숙명인재(면접형)", core: true },
  { university: "한국외국어대학교", department: "태국학과", admissionType: "면접형", core: true },
  { university: "숭실대학교", department: "일어일문", admissionType: "SSU미래인재(면접형)", core: true },
  { university: "건국대학교(서울)", department: "일어교육과", admissionType: "KU자기추천", core: true },
  { university: "국민대학교", department: "동아시아국제학부", admissionType: "국민프런티어", core: true },
  { university: "한국외국어대학교", department: "이란학과", admissionType: "서류형", core: true },
  { university: "경희대학교", department: "일본어학과", admissionType: "네오르네상스" },
  { university: "경기대학교", department: "글로벌어문학부", admissionType: "KGU학생부종합전형" },
  { university: "명지대학교", department: "일어일문전공", admissionType: "명지인재면접형" },
  { university: "광운대학교", department: "동북아문화산업", admissionType: "광운참빛인재전형 I (면접형)" },
  { university: "성신여자대학교", department: "일본어문·문화", admissionType: "자기주도인재" },
  { university: "가천대학교", department: "AI인문대학", admissionType: "가천바람개비" },
  { university: "중앙대학교", department: "아시아문화(일본어문)", admissionType: "CAU탐구인재" },
  { university: "서울여자대학교", department: "일어일문학과", admissionType: "바롬인재" },
  { university: "인하대학교", department: "일본언어문화학과", admissionType: "인하미래인재 면접형" },
  { university: "인천대학교", department: "일본지역문화학과", admissionType: "자기추천전형" },
];

export const TARGET_UNIVERSITIES = [...new Set(TARGET_SELECTIONS.map((s) => s.university))];
