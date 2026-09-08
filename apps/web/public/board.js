const lastUpdatedEl = document.getElementById("last-updated");
const subTabsEl = document.getElementById("sub-tabs");
const statCardsEl = document.getElementById("stat-cards");
const tbodyEl = document.getElementById("board-tbody");
const trendWrapEl = document.getElementById("trend-wrap");
const trendLegendEl = document.getElementById("trend-legend");

const PALETTE = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"];

let allRows = [];
let scope = "core"; // "core" | "all"

function fmt(dt) {
  if (!dt) return "-";
  return new Date(dt).toLocaleString("ko-KR", { hour12: false, timeZone: "Asia/Seoul" });
}
function fmtShort(dt) {
  return new Date(dt).toLocaleString("ko-KR", {
    month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
    hour12: false, timeZone: "Asia/Seoul",
  });
}

function rowLabel(r) {
  return `${r.university} · ${r.department} (${r.admissionType})`;
}

function currentRows() {
  return scope === "core" ? allRows.filter((r) => r.core) : allRows;
}

/* ---------------- stat cards ---------------- */
function renderStatCards() {
  const rows = currentRows();
  const ready = rows.filter((r) => r.status === "ready" && r.ratio !== null && r.ratio !== undefined);

  if (ready.length === 0) {
    statCardsEl.innerHTML = `
      <div class="stat-card"><span class="label">평균 경쟁률</span><span class="value">-</span><span class="sub">아직 집계된 값 없음</span></div>
      <div class="stat-card"><span class="label">최고 경쟁률</span><span class="value">-</span><span class="sub">&nbsp;</span></div>
      <div class="stat-card"><span class="label">최저 경쟁률</span><span class="value">-</span><span class="sub">&nbsp;</span></div>
      <div class="stat-card"><span class="label">10:1 이상 전형</span><span class="value">0건</span><span class="sub">&nbsp;</span></div>
    `;
    return;
  }

  const avg = ready.reduce((s, r) => s + r.ratio, 0) / ready.length;
  const max = ready.reduce((m, r) => (r.ratio > m.ratio ? r : m), ready[0]);
  const min = ready.reduce((m, r) => (r.ratio < m.ratio ? r : m), ready[0]);
  const over10 = ready.filter((r) => r.ratio >= 10);

  statCardsEl.innerHTML = `
    <div class="stat-card">
      <span class="label">평균 경쟁률</span>
      <span class="value">${avg.toFixed(2)} : 1</span>
      <span class="sub">전형 ${ready.length}건 기준</span>
    </div>
    <div class="stat-card">
      <span class="label">최고 경쟁률</span>
      <span class="value">${max.ratio.toFixed(2)} : 1</span>
      <span class="sub">${rowLabel(max)}</span>
    </div>
    <div class="stat-card">
      <span class="label">최저 경쟁률</span>
      <span class="value">${min.ratio.toFixed(2)} : 1</span>
      <span class="sub">${rowLabel(min)}</span>
    </div>
    <div class="stat-card">
      <span class="label">10:1 이상 전형</span>
      <span class="value">${over10.length}건</span>
      <span class="sub">${over10.length ? over10.map(rowLabel).join(" · ") : "해당 없음"}</span>
    </div>
  `;
}

/* ---------------- table ---------------- */
function renderTable() {
  // 주기적으로 다시 그릴 때 가로 스크롤 위치가 리셋되지 않도록 기억했다가 복원한다.
  const scrollEl = tbodyEl.closest(".table-scroll");
  const prevScroll = scrollEl?.scrollLeft ?? 0;

  const rows = currentRows();
  if (rows.length === 0) {
    tbodyEl.innerHTML = '<tr><td colspan="7" class="pending-note">표시할 항목이 없습니다.</td></tr>';
    return;
  }

  tbodyEl.innerHTML = rows
    .map((r) => {
      if (r.status !== "ready") {
        return `
          <tr>
            <td class="col-univ">${r.university}</td>
            <td>${r.admissionType}</td>
            <td>${r.department}</td>
            <td colspan="4" class="pending-note">대기중</td>
          </tr>
        `;
      }
      return `
        <tr>
          <td class="col-univ">
            <a href="/university.html?id=${r.universityId ?? ""}">${r.university}</a>
          </td>
          <td>${r.admissionTypeName}</td>
          <td>${r.departmentName}</td>
          <td>${r.capacityRaw ?? "-"}</td>
          <td>${r.applicants ?? "-"}</td>
          <td>${ratioBadgeHtml(r.ratio)}</td>
          <td>${updateCycleHtml(r.detailSource)}</td>
        </tr>
      `;
    })
    .join("");

  if (scrollEl) scrollEl.scrollLeft = prevScroll;
}

/* ---------------- trend chart ---------------- */
function renderChart() {
  const rows = currentRows().filter((r) => r.status === "ready" && r.snapshots && r.snapshots.length > 0);

  if (rows.length === 0) {
    trendWrapEl.innerHTML = '<div class="pending-note">아직 시간대별 데이터가 쌓이지 않았습니다.</div>';
    trendLegendEl.innerHTML = "";
    return;
  }

  // 공통 타임라인: 등장하는 모든 capturedAt을 합쳐 정렬
  const timeSet = new Set();
  rows.forEach((r) => r.snapshots.forEach((s) => timeSet.add(s.capturedAt)));
  const times = [...timeSet].sort();
  const n = times.length;

  const series = rows.map((r, i) => {
    const byTime = Object.fromEntries(r.snapshots.map((s) => [s.capturedAt, s.ratio]));
    return {
      label: `${r.university} · ${r.department}`,
      color: PALETTE[i % PALETTE.length],
      values: times.map((t) => (t in byTime ? byTime[t] : null)),
    };
  });

  const yMax = Math.max(1, ...series.flatMap((s) => s.values.filter((v) => v !== null))) * 1.15;

  const W = 900, H = 420;
  const M = { top: 20, right: 130, bottom: 40, left: 44 };
  const plotW = W - M.left - M.right;
  const plotH = H - M.top - M.bottom;
  const x = (i) => (n <= 1 ? M.left : M.left + (i * plotW) / (n - 1));
  const y = (v) => M.top + plotH - (v / yMax) * plotH;
  const yTicks = 4;

  let svg = `<svg class="trend-chart" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">`;

  for (let t = 0; t <= yTicks; t++) {
    const v = (yMax / yTicks) * t;
    svg += `<line class="gridline" x1="${M.left}" x2="${W - M.right}" y1="${y(v)}" y2="${y(v)}" />`;
    svg += `<text class="axis-label" x="${M.left - 8}" y="${y(v) + 4}" text-anchor="end">${v.toFixed(1)}</text>`;
  }
  svg += `<text class="axis-title" x="12" y="${M.top - 4}">경쟁률 (:1)</text>`;
  svg += `<line class="baseline" x1="${M.left}" x2="${W - M.right}" y1="${y(0)}" y2="${y(0)}" />`;

  times.forEach((t, i) => {
    if (n > 8 && i % Math.ceil(n / 8) !== 0 && i !== n - 1) return;
    const anchor = i === 0 ? "start" : i === n - 1 ? "end" : "middle";
    svg += `<text class="axis-label" x="${x(i)}" y="${H - M.bottom + 18}" text-anchor="${anchor}">${fmtShort(t)}</text>`;
  });

  series.forEach((s) => {
    const pts = s.values.map((v, i) => (v === null ? null : [x(i), y(v)]));
    const segs = [];
    let cur = [];
    pts.forEach((p) => {
      if (p === null) {
        if (cur.length) segs.push(cur);
        cur = [];
      } else {
        cur.push(p);
      }
    });
    if (cur.length) segs.push(cur);

    segs.forEach((seg) => {
      const d = seg.map((p, i) => `${i === 0 ? "M" : "L"}${p[0]},${p[1]}`).join(" ");
      svg += `<path class="series-line" d="${d}" stroke="${s.color}" />`;
    });
    pts.forEach((p) => {
      if (p) svg += `<circle class="series-dot" cx="${p[0]}" cy="${p[1]}" r="3" fill="${s.color}" />`;
    });

    const lastIdx = [...s.values].reverse().findIndex((v) => v !== null);
    if (lastIdx !== -1) {
      const idx = s.values.length - 1 - lastIdx;
      svg += `<text class="end-label" x="${x(idx) + 8}" y="${y(s.values[idx]) + 4}" fill="${s.color}">${s.label.split(" · ")[0].replace("대학교", "")}</text>`;
    }
  });

  svg += `<g id="crosshair-group"></g>`;
  svg += `</svg>`;

  trendWrapEl.innerHTML = svg;

  const svgEl = trendWrapEl.querySelector("svg");
  const crosshairGroup = svgEl.querySelector("#crosshair-group");
  let tooltipEl = null;

  svgEl.addEventListener("mousemove", (e) => {
    const rect = svgEl.getBoundingClientRect();
    const scaleX = W / rect.width;
    const px = (e.clientX - rect.left) * scaleX;
    let idx = Math.round(((px - M.left) / plotW) * (n - 1));
    idx = Math.max(0, Math.min(n - 1, idx));

    crosshairGroup.innerHTML = `<line class="crosshair" x1="${x(idx)}" x2="${x(idx)}" y1="${M.top}" y2="${H - M.bottom}" />`;

    const entries = series
      .map((s) => ({ label: s.label, color: s.color, v: s.values[idx] }))
      .filter((e) => e.v !== null)
      .sort((a, b) => b.v - a.v);

    if (!tooltipEl) {
      tooltipEl = document.createElement("div");
      tooltipEl.className = "trend-tooltip";
      trendWrapEl.appendChild(tooltipEl);
    }
    const leftPct = (x(idx) / W) * 100;
    const flip = leftPct > 58;
    tooltipEl.style.left = flip ? "" : `calc(${leftPct}% + 14px)`;
    tooltipEl.style.right = flip ? `calc(${100 - leftPct}% + 14px)` : "";
    tooltipEl.innerHTML =
      `<div class="time">${fmtShort(times[idx])}</div>` +
      entries
        .map(
          (e) =>
            `<div class="row"><span class="name"><span class="dot" style="background:${e.color}"></span>${e.label}</span><span class="val">${e.v.toFixed(2)} : 1</span></div>`
        )
        .join("");
  });
  svgEl.addEventListener("mouseleave", () => {
    crosshairGroup.innerHTML = "";
    if (tooltipEl) tooltipEl.remove();
    tooltipEl = null;
  });

  trendLegendEl.innerHTML = series
    .map((s) => `<span class="item"><span class="swatch" style="background:${s.color}"></span>${s.label}</span>`)
    .join("");
}

/* ---------------- glue ---------------- */
function renderAll() {
  renderStatCards();
  renderTable();
  renderChart();
}

subTabsEl.addEventListener("click", (e) => {
  const btn = e.target.closest(".sub-tab");
  if (!btn) return;
  scope = btn.dataset.scope;
  [...subTabsEl.querySelectorAll(".sub-tab")].forEach((b) => b.classList.toggle("active", b === btn));
  renderAll();
});

async function load() {
  const res = await fetch("/api/board");
  const data = await res.json();
  allRows = data.rows;

  const readyTimes = allRows.filter((r) => r.status === "ready").map((r) => new Date(r.capturedAt).getTime());
  const last = readyTimes.length ? new Date(Math.max(...readyTimes)) : null;
  lastUpdatedEl.textContent = `마지막 업데이트: ${fmt(last)}`;

  renderAll();
}

load();
setInterval(load, 15000);
