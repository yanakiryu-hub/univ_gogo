const lastUpdatedEl = document.getElementById("last-updated");
const cardsEl = document.getElementById("interview-cards");

function fmt(dt) {
  if (!dt) return "-";
  return new Date(dt).toLocaleString("ko-KR", { hour12: false, timeZone: "Asia/Seoul" });
}

function fmtSchedule(value) {
  if (!value) return '<span class="sched-tbd">미정</span>';
  return value;
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

      const statsHtml =
        r.status === "ready"
          ? `
            <div class="interview-stats">
              <div class="stat"><span class="stat-label">모집인원</span><span class="stat-value">${r.capacityRaw ?? "-"}</span></div>
              <div class="stat"><span class="stat-label">지원인원</span><span class="stat-value">${r.applicants ?? "-"}</span></div>
              <div class="stat"><span class="stat-label">경쟁률</span>${ratioBadgeHtml(r.ratio)}</div>
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

          <div class="interview-schedule">
            <div class="sched-row">
              <span class="sched-label">1차 합격자 발표</span>
              <span class="sched-value">${fmtSchedule(info.firstAnnounce)}</span>
            </div>
            <div class="sched-row">
              <span class="sched-label">면접일시</span>
              <span class="sched-value">${fmtSchedule(info.interviewAt)}</span>
            </div>
            <div class="sched-row">
              <span class="sched-label">최종 발표</span>
              <span class="sched-value">${fmtSchedule(info.finalAnnounce)}</span>
            </div>
          </div>

          ${info.note ? `<div class="interview-note">${info.note}</div>` : ""}
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
