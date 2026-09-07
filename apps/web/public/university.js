const params = new URLSearchParams(location.search);
const universityId = params.get("id");

const titleEl = document.getElementById("univ-title");
const selAt = document.getElementById("select-admission-type");
const selDept = document.getElementById("select-department");
const canvas = document.getElementById("ratio-chart");

let university = null;
let chart = null;

function fmtTime(dt) {
  const d = new Date(dt);
  return d.toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Seoul",
  });
}

function populateAdmissionTypes() {
  selAt.innerHTML = university.admissionTypes
    .map((at) => `<option value="${at.id}">${at.name}${at.quotaGroup ? ` (${at.quotaGroup})` : ""}</option>`)
    .join("");
}

function populateDepartments() {
  const at = university.admissionTypes.find((a) => a.id === selAt.value);
  if (!at) return;
  selDept.innerHTML = at.departments
    .map((d) => `<option value="${d.id}">${d.college ? d.college + " · " : ""}${d.name}</option>`)
    .join("");
}

function renderChart() {
  const at = university.admissionTypes.find((a) => a.id === selAt.value);
  const dept = at?.departments.find((d) => d.id === selDept.value);
  if (!dept) return;

  const labels = dept.snapshots.map((s) => fmtTime(s.capturedAt));
  const ratios = dept.snapshots.map((s) => s.ratio);
  const applicants = dept.snapshots.map((s) => s.applicants);

  if (chart) chart.destroy();
  chart = new Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "경쟁률",
          data: ratios,
          borderColor: "#3457d5",
          backgroundColor: "rgba(52,87,213,0.1)",
          tension: 0.25,
          yAxisID: "y",
        },
        {
          label: "지원인원",
          data: applicants,
          borderColor: "#e14e4e",
          backgroundColor: "rgba(225,78,78,0.08)",
          tension: 0.25,
          yAxisID: "y1",
        },
      ],
    },
    options: {
      responsive: true,
      interaction: { mode: "index", intersect: false },
      scales: {
        y: { type: "linear", position: "left", title: { display: true, text: "경쟁률 (:1)" } },
        y1: { type: "linear", position: "right", title: { display: true, text: "지원인원" }, grid: { drawOnChartArea: false } },
      },
    },
  });
}

async function main() {
  if (!universityId) {
    titleEl.textContent = "대학이 지정되지 않았습니다.";
    return;
  }

  const res = await fetch(`/api/universities/${universityId}/history`);
  if (!res.ok) {
    titleEl.textContent = "대학 정보를 찾을 수 없습니다.";
    return;
  }
  university = await res.json();

  titleEl.textContent = `${university.name} — 경쟁률 추이`;
  populateAdmissionTypes();
  populateDepartments();
  renderChart();

  selAt.addEventListener("change", () => {
    populateDepartments();
    renderChart();
  });
  selDept.addEventListener("change", renderChart);
}

main();
