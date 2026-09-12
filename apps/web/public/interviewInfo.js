/**
 * 면접대비 페이지에서 쓰는 일정 정보. 크롤링 대상이 아니라 사람이 각 대학 모집요강/입학처
 * 공지를 직접 확인해서 입력하는 고정 참고자료다 (2026-09-12 기준 사용자 제공).
 * 값이 없는 항목은 null로 두면 카드에 "미정" 으로 표시되고, 대학이 명시적으로 해당 단계가
 * 없다고 안내한 경우는 문자열 "없음"을 그대로 넣어 구분한다.
 */
const INTERVIEW_INFO = [
  {
    university: "숙명여자대학교",
    department: "일본학과",
    homepageUrl: "https://admission.sookmyung.ac.kr/admission/html/main/main.asp",
    step1Announce: "11월 19일(목) 18시",
    step2Payment: "11월 20일(금) 17시 (25,000원)",
    examRoomNotice: "11월 24일(화) 17시",
    interviewDate: "11월 28일(토)",
    finalAnnounce: "12월 18일(금) 17시",
    additionalAnnounce: "12월 24일(목) ~ 12월 29일(화) 18시",
    note: null,
  },
  {
    university: "한국외국어대학교",
    department: "태국학과",
    homepageUrl: "https://adms.hufs.ac.kr/index.do",
    step1Announce: "11월 16일(월)",
    step2Payment: "없음 (1차 탈락시 10,000원 환불됨)",
    examRoomNotice: "11월 16일(월)",
    interviewDate: "11월 21일(토)",
    finalAnnounce: "12월 18일(금)",
    additionalAnnounce: "12월 29일(화)까지",
    note: null,
  },
  {
    university: "숭실대학교",
    department: "일어일문",
    homepageUrl: "https://iphak.ssu.ac.kr/",
    step1Announce: "11월 23일(월)",
    step2Payment: "없음 (1차 탈락시 20,000원 환불됨)",
    examRoomNotice: "없음",
    interviewDate: "11월 27일(금)",
    finalAnnounce: "12월 18일(금) 10시",
    additionalAnnounce: "12월 24일(목) ~ 12월 29일(화)",
    note: null,
  },
  {
    university: "건국대학교(서울)",
    department: "일어교육과",
    homepageUrl: "https://www.konkuk.ac.kr/admission/37857/subview.do",
    step1Announce: "11월 20일(금) 14시",
    step2Payment: "11월 23일(월) 14시 (25,000원)",
    examRoomNotice: "없음",
    interviewDate: "12월 5일(토)",
    finalAnnounce: "12월 18일(금) 14시",
    additionalAnnounce: "12월 24일(목) 10시 ~ 12월 29일(화) 18시",
    note: null,
  },
  {
    university: "국민대학교",
    department: "동아시아국제학부",
    homepageUrl: null,
    step1Announce: "11월 17일(화) 14시",
    step2Payment: "없음 (1차 탈락시 20,000원 환불됨)",
    examRoomNotice: "없음",
    interviewDate: "11월 22일(일)",
    finalAnnounce: "12월 18일(금) 17시",
    additionalAnnounce: "12월 24일(목) ~ 12월 29일(화) 18시",
    note: null,
  },
  {
    university: "한국외국어대학교",
    department: "이란학과",
    homepageUrl: "https://adms.hufs.ac.kr/index.do",
    step1Announce: "없음",
    step2Payment: "없음",
    examRoomNotice: "없음",
    interviewDate: "없음",
    finalAnnounce: "12월 18일(금)",
    additionalAnnounce: "12월 29일(화)까지",
    note: "서류형 전형 - 면접 없음",
  },
];

function getInterviewInfo(university, department) {
  const uni = (university || "").replace(/\s*U$/, "").trim();
  return (
    INTERVIEW_INFO.find((e) => e.university === uni && department.includes(e.department)) || {
      homepageUrl: null,
      step1Announce: null,
      step2Payment: null,
      examRoomNotice: null,
      interviewDate: null,
      finalAnnounce: null,
      additionalAnnounce: null,
      note: null,
    }
  );
}
