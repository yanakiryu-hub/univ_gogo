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

function ratioClass(ratio) {
  if (ratio === null || ratio === undefined) return "";
  if (ratio >= 5) return "ratio-high";
  if (ratio < 0.5) return "ratio-low";
  return "";
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
              <span class="univ-sub">${u.region ?? ""} · ${u.status}</span>
            </td>
            <td>${at.name}${at.quotaGroup ? ` <span class="univ-sub">(${at.quotaGroup})</span>` : ""}</td>
            <td>${d.college ? d.college + " · " : ""}${d.name}</td>
            <td>${d.capacityRaw}</td>
            <td>${d.applicants ?? "-"}</td>
            <td class="${ratioClass(d.ratio)}">${d.ratio !== null && d.ratio !== undefined ? d.ratio.toFixed(2) + " : 1" : "-"}</td>
          </tr>
        `);
      }
    }
  }

  appEl.innerHTML = `
    <div class="univ-card">
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
  `;
}

function renderCrawlStatus(status) {
  const badge = status.running
    ? '<span class="status-badge status-running">실행중</span>'
    : '<span class="status-badge status-stopped">정지됨</span>';
  let extra = "";
  if (status.inFlight) extra = " (크롤링 진행중...)";
  else if (status.running && status.inQuietHours) extra = ` (오전 ${status.quietHourBefore}시 이전이라 대기중)`;
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
