/**
 * 면접대비 페이지에서 쓰는 일정 정보. 크롤링 대상이 아니라 사람이 직접 조사해서 입력하는
 * 고정 참고자료다 (대학 공지사항/모집요강 확인 후 채워 넣을 것).
 * 아직 값을 못 채운 항목은 null로 두면 카드에 "미정" 으로 표시된다.
 */
const INTERVIEW_INFO = [
  {
    university: "숙명여자대학교",
    department: "일본학과",
    firstAnnounce: null, // 1차 합격자 발표일시
    interviewAt: null, // 면접일시
    finalAnnounce: null, // 최종 발표일시
    note: null, // 비고
  },
  {
    university: "한국외국어대학교",
    department: "태국학과",
    firstAnnounce: null,
    interviewAt: null,
    finalAnnounce: null,
    note: null,
  },
  {
    university: "숭실대학교",
    department: "일어일문",
    firstAnnounce: null,
    interviewAt: null,
    finalAnnounce: null,
    note: null,
  },
  {
    university: "건국대학교(서울)",
    department: "일어교육과",
    firstAnnounce: null,
    interviewAt: null,
    finalAnnounce: null,
    note: null,
  },
  {
    university: "국민대학교",
    department: "동아시아국제학부",
    firstAnnounce: null,
    interviewAt: null,
    finalAnnounce: null,
    note: null,
  },
  {
    university: "한국외국어대학교",
    department: "이란학과",
    firstAnnounce: null,
    interviewAt: null,
    finalAnnounce: null,
    note: "서류형 전형 - 면접 없음",
  },
];

function getInterviewInfo(university, department) {
  const uni = (university || "").replace(/\s*U$/, "").trim();
  return (
    INTERVIEW_INFO.find((e) => e.university === uni && department.includes(e.department)) || {
      firstAnnounce: null,
      interviewAt: null,
      finalAnnounce: null,
      note: null,
    }
  );
}
