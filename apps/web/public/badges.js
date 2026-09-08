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
 * 대학의 경쟁률 크롤링 주기를 소스별로 표시한다.
 * uwayapply: Railway 서버가 10분마다 자동 크롤링
 * jinhakapply: 해외 IP 차단 때문에 로컬(한국 IP)에서 10분마다 크롤링해 전송
 */
function updateCycleHtml(detailSource) {
  if (detailSource === "uwayapply") {
    return `10분마다 <span class="univ-sub">(유웨이)</span>`;
  }
  if (detailSource === "jinhakapply") {
    return `10분마다 <span class="univ-sub">(진학사)</span>`;
  }
  return "-";
}
