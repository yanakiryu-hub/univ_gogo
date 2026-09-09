/**
 * 경쟁률 배지 공용 로직. 홈/경쟁률보드 양쪽에서 사용한다.
 * 5:1 이상 파랑 · 10:1 이상 진한핑크 · 20:1 이상 주황 · 30:1 이상 빨강, 그 아래는 중립.
 */
function ratioBadgeHtml(ratio) {
  if (ratio === null || ratio === undefined) {
    return '<span class="badge badge-neutral">-</span>';
  }
  const text = `${ratio.toFixed(2)} : 1`;
  let cls = "badge-neutral";
  if (ratio >= 30) cls = "badge-red";
  else if (ratio >= 20) cls = "badge-orange";
  else if (ratio >= 10) cls = "badge-magenta";
  else if (ratio >= 5) cls = "badge-blue";
  return `<span class="badge ${cls}">${text}</span>`;
}

/**
 * 경쟁률 배지와 같은 구간 규칙으로 대학명 텍스트 색상 클래스를 반환한다.
 */
function ratioColorClass(ratio) {
  if (ratio === null || ratio === undefined) return "";
  if (ratio >= 30) return "rate-red";
  if (ratio >= 20) return "rate-orange";
  if (ratio >= 10) return "rate-magenta";
  if (ratio >= 5) return "rate-blue";
  return "";
}

/**
 * 대학 사이트 자체가 마지막으로 값을 갱신한 시각(capturedAt)을 표시한다.
 * (우리가 몇 분마다 크롤링하는지가 아니라, 사이트에 찍힌 실제 갱신 시각 - 대학마다 다르다)
 */
function fmtUpdatedAt(dt) {
  if (!dt) return "-";
  return new Date(dt).toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Seoul",
  });
}
