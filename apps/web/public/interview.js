const lastUpdatedEl = document.getElementById("last-updated");
const cardsEl = document.getElementById("interview-cards");
const viewToggleBtn = document.getElementById("view-toggle-btn");
const viewToggleLabel = document.getElementById("view-toggle-label");

const VIEW_MODE_KEY = "univgogo_interview_view_mode";
let viewMode = localStorage.getItem(VIEW_MODE_KEY) === "grid" ? "grid" : "carousel";
let lastRows = [];

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
 * 핵심 강조 박스(1차 합격자 발표/면접평가일) 전용 포맷터.
 * 날짜는 그대로 두고, 뒤에 붙는 "18시" 같은 시각 표기만 작고 옅은 글자로 줄여
 * 날짜가 먼저 눈에 들어오게 한다.
 */
function fmtKeyDate(value) {
  if (!value) return '<span class="sched-tbd">미정</span>';
  if (value === "없음") return '<span class="sched-none">없음</span>';
  const match = value.match(/^(.*?)(\s\d{1,2}시)$/);
  if (!match) return value;
  return `${match[1]}<span class="key-date-time">${match[2]}</span>`;
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

function buildCardHtml(r) {
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
          <span class="key-date-value">${fmtKeyDate(info.step1Announce)}</span>
        </div>
        <div class="key-date-box">
          <span class="key-date-label">면접평가일</span>
          <span class="key-date-value">${fmtKeyDate(info.interviewDate)}</span>
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
      ${
        info.homepageUrl || info.locationUrl
          ? `
        <div class="interview-links">
          ${info.homepageUrl ? `<a class="interview-homepage-link" href="${info.homepageUrl}" target="_blank" rel="noopener">입학처 홈페이지 &rarr;</a>` : ""}
          ${info.locationUrl ? `<a class="interview-location-link" href="${info.locationUrl}" target="_blank" rel="noopener">학교 위치 지도 &rarr;</a>` : ""}
        </div>
      `
          : ""
      }

      ${
        info.docScore || info.interviewScore
          ? `
        <div class="interview-score-box">
          <div class="score-row">
            <span class="score-label">서류 배점</span>
            <span class="score-value">${info.docScore ?? "-"}</span>
          </div>
          <div class="score-row">
            <span class="score-label">면접 배점</span>
            <span class="score-value">${info.interviewScore ?? "-"}</span>
          </div>
        </div>
      `
          : ""
      }
    </div>
  `;
}

function sortedCoreRows(rows) {
  return rows
    .filter((r) => r.core)
    .sort((a, b) => getInterviewInfo(a.university, a.department).step1SortKey - getInterviewInfo(b.university, b.department).step1SortKey);
}

/* ---------------- 카드형 스와이프 뷰 ---------------- */
let carouselCleanup = null;

function renderCarousel(coreRows) {
  const cardsHtml = coreRows.map((r) => `<div class="carousel-slide">${buildCardHtml(r)}</div>`).join("");
  cardsEl.className = "interview-carousel-wrap";
  cardsEl.innerHTML = `
    <div class="carousel-track" id="carousel-track">${cardsHtml}</div>
    <div class="carousel-dots" id="carousel-dots">
      ${coreRows.map((_, i) => `<span class="carousel-dot" data-idx="${i}"></span>`).join("")}
    </div>
  `;

  const track = document.getElementById("carousel-track");
  const dots = [...document.querySelectorAll(".carousel-dot")];
  let ticking = false;

  function updateTransforms() {
    ticking = false;
    const trackRect = track.getBoundingClientRect();
    const centerX = trackRect.left + trackRect.width / 2;
    let activeIdx = 0;
    let minDist = Infinity;

    [...track.children].forEach((slide, i) => {
      const r = slide.getBoundingClientRect();
      const slideCenter = r.left + r.width / 2;
      const dist = Math.abs(centerX - slideCenter);
      const norm = Math.min(dist / (trackRect.width / 2 + 1), 1);
      const scale = 1 - norm * 0.14;
      const opacity = 1 - norm * 0.55;
      slide.style.transform = `scale(${scale})`;
      slide.style.opacity = opacity;
      if (dist < minDist) {
        minDist = dist;
        activeIdx = i;
      }
    });

    dots.forEach((d, i) => d.classList.toggle("active", i === activeIdx));
  }

  function onScroll() {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(updateTransforms);
    }
  }

  track.addEventListener("scroll", onScroll, { passive: true });
  dots.forEach((d) => {
    d.addEventListener("click", () => {
      const idx = Number(d.dataset.idx);
      track.children[idx]?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    });
  });

  // 최초 진입 시 첫 카드가 중앙에 오도록 스크롤 위치를 맞추고, 스케일/투명도를 계산한다.
  requestAnimationFrame(() => {
    track.children[0]?.scrollIntoView({ behavior: "auto", inline: "center", block: "nearest" });
    updateTransforms();
  });

  carouselCleanup = () => track.removeEventListener("scroll", onScroll);
}

/* ---------------- 세로 카드 목록 뷰 ---------------- */
function renderGrid(coreRows) {
  cardsEl.className = "interview-grid";
  cardsEl.innerHTML = coreRows.map((r) => buildCardHtml(r)).join("");
}

function renderCards(rows) {
  if (carouselCleanup) {
    carouselCleanup();
    carouselCleanup = null;
  }

  // 1차 합격자 발표가 빠른 순으로 카드를 배치하고, 서류형처럼 1차 발표 자체가 없는
  // 전형(step1SortKey: Infinity)은 항상 맨 뒤로 보낸다.
  const coreRows = sortedCoreRows(rows);

  if (coreRows.length === 0) {
    cardsEl.className = "interview-grid";
    cardsEl.innerHTML = '<div class="empty">표시할 학교가 없습니다.</div>';
    return;
  }

  if (viewMode === "carousel") {
    renderCarousel(coreRows);
  } else {
    renderGrid(coreRows);
  }
}

function updateToggleButton() {
  if (viewMode === "carousel") {
    viewToggleLabel.textContent = "목록으로 보기";
    viewToggleBtn.classList.add("is-carousel");
  } else {
    viewToggleLabel.textContent = "카드로 보기";
    viewToggleBtn.classList.remove("is-carousel");
  }
}

viewToggleBtn.addEventListener("click", () => {
  viewMode = viewMode === "carousel" ? "grid" : "carousel";
  localStorage.setItem(VIEW_MODE_KEY, viewMode);
  updateToggleButton();
  renderCards(lastRows);
});

updateToggleButton();

async function load() {
  const res = await fetch("/api/board");
  const data = await res.json();
  lastRows = data.rows;

  const readyTimes = data.rows
    .filter((r) => r.core && r.status === "ready")
    .map((r) => new Date(r.capturedAt).getTime());
  const last = readyTimes.length ? new Date(Math.max(...readyTimes)) : null;
  lastUpdatedEl.textContent = `마지막 업데이트: ${fmt(last)}`;

  renderCards(lastRows);
}

load();
