const appEl = document.getElementById("app");
const lastUpdatedEl = document.getElementById("last-updated");
const crawlStatusEl = document.getElementById("crawl-status");
const btnRun = document.getElementById("btn-run");
const btnStop = document.getElementById("btn-stop");

function fmt(dt) {
  if (!dt) return "-";
  const d = new Date(dt);
  return d.toLocaleString("ko-KR", { hour12: false, timeZone: "Asia/Seoul" });
}

function renderUniversities(universities) {
  if (universities.length === 0) {
    appEl.innerHTML = '<div class="empty">아직 크롤링된 대학이 없습니다. RUN 버튼을 눌러 시작하세요.</div>';
    return;
  }

  const rows = [];
  for (const u of universities) {
    for (const at of u.admissionTypes) {
      for (const d of at.departments) {
        rows.push(`
          <tr>
            <td class="col-univ">
              <a href="/university.html?id=${u.id}">${u.name}</a>
              <span class="univ-sub">${u.region ?? ""}</span>
            </td>
            <td>${at.name}</td>
            <td>${d.name}</td>
            <td>${d.capacityRaw}</td>
            <td>${d.applicants ?? "-"}</td>
            <td>${ratioBadgeHtml(d.ratio)}</td>
          </tr>
        `);
      }
    }
  }

  appEl.innerHTML = `
    <div class="badge-key" style="margin-bottom:10px;">
      <span class="badge badge-blue">5:1↑</span>
      <span class="badge badge-magenta">10:1↑</span>
      <span class="badge badge-orange">20:1↑</span>
      <span class="badge badge-red">30:1↑</span>
    </div>
    <div class="univ-card">
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>대학</th>
              <th>전형</th>
              <th>모집단위(학과)</th>
              <th>모집인원</th>
              <th>지원인원</th>
              <th>경쟁률</th>
            </tr>
          </thead>
          <tbody>${rows.join("")}</tbody>
        </table>
      </div>
    </div>
  `;
}

function renderCrawlStatus(status) {
  const badge = status.running
    ? '<span class="status-badge status-running">실행중</span>'
    : '<span class="status-badge status-stopped">정지됨</span>';
  let extra = "";
  if (status.inFlight) {
    extra = " (크롤링 진행중...)";
  } else if (status.running && status.isBeforeStart) {
    extra = ` (${fmt(status.crawlStartAt)} 시작 예정, 대기중)`;
  } else if (status.isAfterEnd) {
    extra = ` (${fmt(status.crawlEndAt)} 종료됨)`;
  }
  crawlStatusEl.innerHTML = `${badge}${extra}`;
  btnRun.disabled = status.running;
  btnStop.disabled = !status.running;
}

async function loadState() {
  const res = await fetch("/api/state");
  const data = await res.json();

  const last = data.lastCapturedAt ?? data.lastMappedAt;
  lastUpdatedEl.textContent = `마지막 업데이트: ${fmt(last)}`;

  renderUniversities(data.universities);
  renderCrawlStatus(data.crawlStatus);
}

btnRun.addEventListener("click", async () => {
  btnRun.disabled = true;
  await fetch("/api/crawl/start", { method: "POST" });
  await loadState();
});

btnStop.addEventListener("click", async () => {
  btnStop.disabled = true;
  await fetch("/api/crawl/stop", { method: "POST" });
  await loadState();
});

loadState();
setInterval(loadState, 15000);
