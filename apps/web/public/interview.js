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
              <span class="sched-value">${fmtSchedule(info.step1Announce)}</span>
            </div>
            <div class="sched-row">
              <span class="sched-label">2단계 전형료 납부</span>
              <span class="sched-value">${fmtSchedule(info.step2Payment)}</span>
            </div>
            <div class="sched-row">
              <span class="sched-label">시험장 안내</span>
              <span class="sched-value">${fmtSchedule(info.examRoomNotice)}</span>
            </div>
            <div class="sched-row sched-row-highlight">
              <span class="sched-label">면접평가일</span>
              <span class="sched-value">${fmtSchedule(info.interviewDate)}</span>
            </div>
            <div class="sched-row sched-row-highlight">
              <span class="sched-label">합격자 발표</span>
              <span class="sched-value">${fmtSchedule(info.finalAnnounce)}</span>
            </div>
            <div class="sched-row">
              <span class="sched-label">추가 합격자 발표</span>
              <span class="sched-value">${fmtSchedule(info.additionalAnnounce)}</span>
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
