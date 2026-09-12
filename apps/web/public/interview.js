const lastUpdatedEl = document.getElementById("last-updated");
const cardsEl = document.getElementById("interview-cards");

function fmt(dt) {
  if (!dt) return "-";
  return new Date(dt).toLocaleString("ko-KR", { hour12: false, timeZone: "Asia/Seoul" });
}

function fmtSchedule(value) {
  if (!value) return '<span class="sched-tbd">미정</span>';
  if (value === "없음") return '<span class="sched-none">없음</span>';
  return value;
}

/**
 * 1차(서류) 경쟁률: 지원인원을 "모집인원 × 1차 합격 배수" 로 나눈 값.
 * 실제로 면접까지 올라가는 좁은 문 기준의 체감 경쟁률을 보여준다.
 * 배수 정보가 없는 전형(예: 서류형 단일 평가)은 계산하지 않는다.
 */
function stage1Ratio(applicants, capacity, multiplier) {
  if (!multiplier || !capacity || applicants === null || applicants === undefined) return null;
  return applicants / (capacity * multiplier);
}

function renderCards(rows) {
  const coreRows = rows.filter((r) => r.core);

  if (coreRows.length === 0) {
    cardsEl.innerHTML = '<div class="empty">표시할 학교가 없습니다.</div>';
    return;
  }

  cardsEl.innerHTML = coreRows
    .map((r) => {
      const info = getInterviewInfo(r.university, r.department);
      const rateClass = r.status === "ready" ? ratioColorClass(r.ratio) : "";

      const ratio1 = r.status === "ready" ? stage1Ratio(r.applicants, r.capacity, info.multiplier) : null;
      const stage1Label = info.multiplier ? `1차 경쟁률 (${info.multiplier}배수)` : "1차 경쟁률";

      const statsHtml =
        r.status === "ready"
          ? `
            <div class="interview-stats">
              <div class="stat"><span class="stat-label">모집인원</span><span class="stat-value">${r.capacityRaw ?? "-"}</span></div>
              <div class="stat"><span class="stat-label">지원인원</span><span class="stat-value">${r.applicants ?? "-"}</span></div>
              <div class="stat"><span class="stat-label">경쟁률</span>${ratioBadgeHtml(r.ratio)}</div>
              <div class="stat"><span class="stat-label">${stage1Label}</span>${
              ratio1 !== null ? ratioBadgeHtml(ratio1) : '<span class="badge badge-neutral">해당없음</span>'
            }</div>
            </div>
          `
          : `<div class="interview-stats"><span class="pending-note">대기중</span></div>`;

      return `
        <div class="interview-card ${rateClass}">
          <div class="interview-card-head">
            <div>
              <div class="interview-univ">${r.university}</div>
              <div class="interview-dept">${r.department}</div>
            </div>
            <span class="interview-type-badge">${r.admissionType}</span>
          </div>

          ${statsHtml}

          <!-- 가장 궁금해할 두 날짜(1차 합격자 발표/면접평가일)를 큼직하게 먼저 보여주고,
               나머지 절차성 정보는 작은 글씨의 목록으로 아래에 배치해 시각적 위계를 나눈다. -->
          <div class="interview-key-dates">
            <div class="key-date-box">
              <span class="key-date-label">1차 합격자 발표</span>
              <span class="key-date-value">${fmtSchedule(info.step1Announce)}</span>
            </div>
            <div class="key-date-box">
              <span class="key-date-label">면접평가일</span>
              <span class="key-date-value">${fmtSchedule(info.interviewDate)}</span>
            </div>
          </div>

          <div class="interview-proc-list">
            <div class="proc-row">
              <span class="proc-label">2단계 전형료 납부</span>
              <span class="proc-value">${fmtSchedule(info.step2Payment)}</span>
            </div>
            <div class="proc-row">
              <span class="proc-label">시험장 안내</span>
              <span class="proc-value">${fmtSchedule(info.examRoomNotice)}</span>
            </div>
            <div class="proc-row">
              <span class="proc-label">합격자 발표</span>
              <span class="proc-value">${fmtSchedule(info.finalAnnounce)}</span>
            </div>
            <div class="proc-row">
              <span class="proc-label">추가 합격자 발표</span>
              <span class="proc-value">${fmtSchedule(info.additionalAnnounce)}</span>
            </div>
          </div>

          ${info.note ? `<div class="interview-note">${info.note}</div>` : ""}
          ${info.homepageUrl ? `<a class="interview-homepage-link" href="${info.homepageUrl}" target="_blank" rel="noopener">입학처 홈페이지 &rarr;</a>` : ""}
        </div>
      `;
    })
    .join("");
}

async function load() {
  const res = await fetch("/api/board");
  const data = await res.json();

  const readyTimes = data.rows
    .filter((r) => r.core && r.status === "ready")
    .map((r) => new Date(r.capturedAt).getTime());
  const last = readyTimes.length ? new Date(Math.max(...readyTimes)) : null;
  lastUpdatedEl.textContent = `마지막 업데이트: ${fmt(last)}`;

  renderCards(data.rows);
}

load();
