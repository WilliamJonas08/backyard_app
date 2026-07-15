/* Results view: live leaderboard and the metric charts (including the personal
   "gourmandise" metric). Reads from `state`, draws with the Charts renderer. */

import { API } from "../api.js";
import { Charts } from "../charts.js";
import { GOURMANDISE } from "../gourmandise.js";
import { state, METRICS, SPEED_UNITS } from "../core/state.js";
import { $, toast, escapeHtml } from "../core/dom.js";

export async function refreshResults() {
  try {
    const [leaderboard, series] = await Promise.all([
      API.getLeaderboard(),
      API.getSeries(),
    ]);
    state.leaderboard = leaderboard;
    state.series = series;
    renderLeaderboard();
    renderChart();
    const now = new Date();
    $("#results-updated").textContent = `maj ${String(
      now.getHours()
    ).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  } catch (err) {
    toast(err.message, true);
  }
}

export function renderLeaderboard() {
  const list = $("#leaderboard");
  const empty = $("#leaderboard-empty");
  const entries = state.leaderboard.filter((e) => e.loops_completed > 0);
  empty.classList.toggle("hidden", entries.length > 0);
  list.innerHTML = "";

  entries.forEach((entry) => {
    const li = document.createElement("li");
    const row = document.createElement("button");
    row.className = `lb-row lb-row--${entry.rank}`;
    if (entry.participant.id === state.selectedId)
      row.classList.add("is-selected");
    row.innerHTML = `
      <span class="lb-row__rank">${entry.rank}</span>
      <span class="lb-row__badge">${entry.participant.initials}</span>
      <span class="lb-row__main">
        <span class="lb-row__name">${escapeHtml(entry.participant.name)}</span>
        <span class="lb-row__meta">${entry.loops_completed} boucle${
      entry.loops_completed > 1 ? "s" : ""
    }${
      entry.avg_speed_kmh ? " · " + entry.avg_speed_kmh.toFixed(1) + " km/h" : ""
    }</span>
      </span>
      <span class="lb-row__dist">${entry.total_distance_km.toFixed(1)}<small>km</small></span>
    `;
    row.addEventListener("click", () => {
      state.selectedId =
        state.selectedId === entry.participant.id
          ? null
          : entry.participant.id;
      renderLeaderboard();
      renderChart();
    });
    li.appendChild(row);
    list.appendChild(li);
  });
}

export function buildMetricTabs() {
  const wrap = $("#metric-tabs");
  wrap.innerHTML = "";
  METRICS.forEach((m) => {
    const btn = document.createElement("button");
    btn.className = "metric-tab" + (m.key === state.metricKey ? " is-active" : "");
    btn.textContent = m.label;
    btn.addEventListener("click", () => {
      state.metricKey = m.key;
      buildMetricTabs();
      renderChart();
    });
    wrap.appendChild(btn);
  });
}

export function buildSpeedUnitToggle() {
  const wrap = $("#speed-unit");
  wrap.innerHTML = "";
  Object.entries(SPEED_UNITS).forEach(([key, unit]) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = unit.label;
    btn.className = key === state.speedUnit ? "is-active" : "";
    btn.addEventListener("click", () => {
      state.speedUnit = key;
      buildSpeedUnitToggle();
      renderChart();
    });
    wrap.appendChild(btn);
  });
}

export function buildGourmandiseToggle() {
  const wrap = $("#gourmandise-product");
  wrap.innerHTML = "";
  GOURMANDISE.PRODUCTS.forEach((product) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = `${product.emoji} ${product.label}`;
    btn.className = product.key === state.gourmandiseProduct ? "is-active" : "";
    btn.addEventListener("click", () => {
      state.gourmandiseProduct = product.key;
      buildGourmandiseToggle();
      renderChart();
    });
    wrap.appendChild(btn);
  });
}

export function renderChart() {
  const metric = METRICS.find((m) => m.key === state.metricKey);
  const isSpeed = Boolean(metric.isSpeed);
  const isGourmandise = Boolean(metric.isGourmandise);

  // Each metric family reveals its own control.
  $("#unit-toggle").classList.toggle("hidden", !isSpeed);
  $("#gourmandise-toggle").classList.toggle("hidden", !isGourmandise);

  if (isGourmandise) {
    renderGourmandiseChart(metric);
    return;
  }

  let format = metric.format;
  let transform = null;
  let unitLabel = "";
  if (isSpeed) {
    const unit = SPEED_UNITS[state.speedUnit];
    transform = unit.transform;
    format = unit.format;
    unitLabel = ` (${unit.label})`;
  }

  Charts.render($("#chart"), {
    series: state.series,
    metricKey: metric.key,
    maxLoops: state.event ? state.event.max_loops : 10,
    formatY: (v) => format(v),
    transform,
    selectedId: state.selectedId,
  });
  $("#chart-caption").textContent = metric.caption + unitLabel;
}

// Gourmandise is a personal metric: it turns *your* burned calories
// (≈ weight × distance) into a count of treats. It needs the device runner's
// weight, so it only plots that runner and asks for the weight when missing.
function renderGourmandiseChart(metric) {
  const chart = $("#chart");
  const caption = $("#chart-caption");
  const product = GOURMANDISE.findProduct(state.gourmandiseProduct);

  if (!state.me || !state.weightKg) {
    const reason = state.me
      ? "Renseigne ton poids"
      : "Inscris-toi puis renseigne ton poids";
    chart.innerHTML = `<p class="empty">${reason} dans le menu (en haut à gauche) pour afficher cette métrique.</p>`;
    caption.textContent = metric.caption;
    return;
  }

  const mySeries = state.series.filter(
    (s) => s.participant.id === state.me.id
  );
  Charts.render(chart, {
    series: mySeries,
    metricKey: "cumulative_distance_km",
    maxLoops: state.event ? state.event.max_loops : 10,
    formatY: (v) => v.toFixed(1),
    transform: (distanceKm) =>
      GOURMANDISE.caloriesBurned(state.weightKg, distanceKm) / product.kcal,
    selectedId: null,
  });
  caption.textContent = `Équivalent en ${product.emoji} ${product.label} de tes calories dépensées (≈ ${state.weightKg} kg × distance).`;
}
