const lastUpdatedEl = document.getElementById("last-updated");
const subTabsEl = document.getElementById("sub-tabs");
const statCardsEl = document.getElementById("stat-cards");
const tbodyEl = document.getElementById("board-tbody");
const trendCanvas = document.getElementById("trend-chart");

const PALETTE = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"];

let allRows = [];
let scope = "core"; // "core" | "all"
let trendChart = null;

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

// 그래프 라인 끝 라벨용 통상 줄임 표현. 같은 줄임말을 쓰는 대학(예: 외대)은 학과로 한 글자 더 구분한다.
const UNIV_SHORT_NAME = {
  "숙명여자대학교": "숙대",
  "한국외국어대학교": "외대",
  "숭실대학교": "숭실대",
  "건국대학교(서울)": "건대",
  "국민대학교": "국민대",
  "경희대학교": "경희대",
  "경기대학교": "경기대",
  "명지대학교": "명지대",
  "광운대학교": "광운대",
  "성신여자대학교": "성신여대",
  "가천대학교": "가천대",
  "중앙대학교": "중앙대",
  "서울여자대학교": "서울여대",
  "인하대학교": "인하대",
  "인천대학교": "인천대",
};

function shortLabelFor(university, department) {
  const base = UNIV_SHORT_NAME[university] || university;
  if (university === "한국외국어대학교") {
    if (department.includes("태국")) return `${base}(태)`;
    if (department.includes("이란") || department.includes("페르시아")) return `${base}(페)`;
  }
  return base;
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
    tbodyEl.innerHTML = '<tr><td colspan="8" class="pending-note">표시할 항목이 없습니다.</td></tr>';
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
            <td colspan="5" class="pending-note">대기중</td>
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
          <td>${fmtUpdatedAt(r.capturedAt)}</td>
          <td class="notice-cell">${r.updateNotice ?? "-"}</td>
        </tr>
      `;
    })
    .join("");

  if (scrollEl) scrollEl.scrollLeft = prevScroll;
}

/* ---------------- trend chart (Chart.js) ---------------- */
function renderChart() {
  const rows = currentRows().filter((r) => r.status === "ready" && r.snapshots && r.snapshots.length > 0);

  if (trendChart) {
    trendChart.destroy();
    trendChart = null;
  }

  if (rows.length === 0) {
    const ctx = trendCanvas.getContext("2d");
    ctx.clearRect(0, 0, trendCanvas.width, trendCanvas.height);
    return;
  }

  // 공통 타임라인: 등장하는 모든 capturedAt을 합쳐 정렬
  const timeSet = new Set();
  rows.forEach((r) => r.snapshots.forEach((s) => timeSet.add(s.capturedAt)));
  const times = [...timeSet].sort();

  const isMobile = window.innerWidth < 500;
  const labelFont = isMobile ? "600 10px -apple-system, BlinkMacSystemFont, sans-serif" : "600 11px -apple-system, BlinkMacSystemFont, sans-serif";

  const datasets = rows.map((r, i) => {
    const byTime = Object.fromEntries(r.snapshots.map((s) => [s.capturedAt, s.ratio]));
    const color = PALETTE[i % PALETTE.length];
    return {
      label: `${r.university} · ${r.department}`,
      shortLabel: shortLabelFor(r.university, r.department),
      data: times.map((t) => (t in byTime ? byTime[t] : null)),
      borderColor: color,
      backgroundColor: color,
      borderWidth: isMobile ? 2 : 2.5,
      spanGaps: true,
      tension: 0.25,
      pointRadius: isMobile ? 2 : 3,
      pointHoverRadius: 5,
    };
  });

  // 오른쪽 여백은 가장 긴 라벨 폭 + 여유만큼 확보한다 (짧은 대학명은 잘리지 않도록).
  const measureCtx = trendCanvas.getContext("2d");
  measureCtx.save();
  measureCtx.font = labelFont;
  const maxLabelWidth = datasets.reduce((m, ds) => Math.max(m, measureCtx.measureText(ds.shortLabel).width), 0);
  measureCtx.restore();
  const rightPadding = Math.min(150, Math.max(70, maxLabelWidth + 26));

  // 범례만으로는 어떤 선이 어느 대학인지 찾기 번거로우니, 각 선의 끝에 대학명을 직접 표시한다.
  // 값이 서로 가까워 라벨이 겹치는 경우, 세로로 밀어내고(collision avoidance) 원래 위치까지 얇은 안내선을 그려준다.
  const endLabelPlugin = {
    id: "endLabel",
    afterDatasetsDraw(chart) {
      const { ctx, chartArea } = chart;
      const pad = 3;
      const lineHeight = isMobile ? 15 : 16;

      const entries = [];
      chart.data.datasets.forEach((ds, i) => {
        const meta = chart.getDatasetMeta(i);
        if (meta.hidden) return;
        let lastIdx = -1;
        for (let j = ds.data.length - 1; j >= 0; j--) {
          if (ds.data[j] !== null && ds.data[j] !== undefined) {
            lastIdx = j;
            break;
          }
        }
        if (lastIdx === -1) return;
        const point = meta.data[lastIdx];
        if (!point) return;
        entries.push({
          anchorX: point.x,
          anchorY: point.y,
          y: point.y,
          text: ds.shortLabel || ds.label,
          color: ds.borderColor,
        });
      });
      if (entries.length === 0) return;

      entries.sort((a, b) => a.y - b.y);
      for (let i = 1; i < entries.length; i++) {
        if (entries[i].y - entries[i - 1].y < lineHeight) {
          entries[i].y = entries[i - 1].y + lineHeight;
        }
      }
      const bottomLimit = chartArea.bottom - pad;
      if (entries[entries.length - 1].y > bottomLimit) {
        entries[entries.length - 1].y = bottomLimit;
        for (let i = entries.length - 2; i >= 0; i--) {
          if (entries[i + 1].y - entries[i].y < lineHeight) {
            entries[i].y = entries[i + 1].y - lineHeight;
          }
        }
      }

      ctx.save();
      ctx.font = labelFont;
      ctx.textBaseline = "middle";
      const labelX = chartArea.right + 8;

      entries.forEach((e) => {
        if (Math.abs(e.y - e.anchorY) > 2) {
          ctx.save();
          ctx.strokeStyle = e.color;
          ctx.globalAlpha = 0.5;
          ctx.lineWidth = 1;
          ctx.setLineDash([2, 2]);
          ctx.beginPath();
          ctx.moveTo(e.anchorX, e.anchorY);
          ctx.lineTo(labelX - 4, e.y);
          ctx.stroke();
          ctx.restore();
        }
      });

      entries.forEach((e) => {
        const textWidth = ctx.measureText(e.text).width;
        ctx.fillStyle = e.color;
        ctx.beginPath();
        ctx.arc(labelX - 4, e.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = e.color;
        ctx.fillText(e.text, labelX + 2, e.y);
        void textWidth;
      });

      ctx.restore();
    },
  };

  trendChart = new Chart(trendCanvas, {
    type: "line",
    data: {
      labels: times.map(fmtShort),
      datasets,
    },
    plugins: [endLabelPlugin],
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: { right: rightPadding, top: 6 },
      },
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          titleFont: { size: 12 },
          bodyFont: { size: 12 },
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y === null ? "-" : ctx.parsed.y.toFixed(2) + " : 1"}`,
          },
        },
      },
      scales: {
        x: {
          grid: { color: "rgba(0,0,0,0.05)" },
          ticks: {
            font: { size: 11 },
            maxRotation: 45,
            minRotation: 0,
            autoSkip: true,
            maxTicksLimit: isMobile ? 5 : 10,
          },
        },
        y: {
          beginAtZero: true,
          grid: { color: "rgba(0,0,0,0.05)" },
          title: { display: true, text: "경쟁률 (:1)", font: { size: 12 } },
          ticks: { font: { size: 11 }, callback: (v) => Number(v).toFixed(1) },
        },
      },
    },
  });

  // 색상-대학 매칭을 위한 범례는 표 밑 캡션으로 대체한다 (선 끝 라벨과 중복되지 않도록 컴팩트하게).
  renderChartLegend(datasets);
}

function renderChartLegend(datasets) {
  let legendEl = document.getElementById("chart-legend");
  if (!legendEl) {
    legendEl = document.createElement("div");
    legendEl.id = "chart-legend";
    legendEl.className = "chart-legend";
    trendCanvas.closest(".chart-canvas-wrap").insertAdjacentElement("afterend", legendEl);
  }
  legendEl.innerHTML = datasets
    .map((ds) => `<span class="chart-legend-item"><i style="background:${ds.borderColor}"></i>${ds.label}</span>`)
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
