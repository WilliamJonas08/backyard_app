/* Settings menu (top-left): light/dark theme and the runner's weight, both
   persisted in localStorage. The weight feeds the personal "gourmandise" chart,
   so changing it re-renders the results chart when it is visible. */

import { state, THEME_KEY, WEIGHT_KEY } from "../core/state.js";
import { $ } from "../core/dom.js";
import { renderChart } from "./results.js";

export function loadSettings() {
  const savedTheme = localStorage.getItem(THEME_KEY);
  applyTheme(savedTheme === "light" ? "light" : "dark");
  const savedWeight = parseFloat(localStorage.getItem(WEIGHT_KEY));
  state.weightKg =
    Number.isFinite(savedWeight) && savedWeight > 0 ? savedWeight : null;
}

function applyTheme(theme) {
  state.theme = theme;
  document.documentElement.setAttribute("data-theme", theme);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "light" ? "#f4f5f7" : "#0b0b0f");
}

export function initMenu() {
  const menu = $("#menu");
  const btn = $("#menu-btn");
  const panel = $("#menu-panel");
  const setOpen = (open) => {
    panel.classList.toggle("hidden", !open);
    btn.setAttribute("aria-expanded", open ? "true" : "false");
  };
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    setOpen(panel.classList.contains("hidden"));
  });
  // Clicks inside the panel must not bubble up to the outside-click handler.
  panel.addEventListener("click", (e) => e.stopPropagation());
  document.addEventListener("click", (e) => {
    if (!menu.contains(e.target)) setOpen(false);
  });

  buildThemeToggle();
  initWeightInput();
  renderMenuAlert();
}

function buildThemeToggle() {
  const wrap = $("#theme-toggle");
  wrap.innerHTML = "";
  const themes = [
    ["dark", "Sombre"],
    ["light", "Clair"],
  ];
  themes.forEach(([key, label]) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = label;
    btn.className = key === state.theme ? "is-active" : "";
    btn.addEventListener("click", () => {
      applyTheme(key);
      localStorage.setItem(THEME_KEY, key);
      buildThemeToggle();
    });
    wrap.appendChild(btn);
  });
}

function initWeightInput() {
  const input = $("#weight-input");
  if (state.weightKg) input.value = state.weightKg;
  input.addEventListener("change", () => {
    const value = parseFloat(input.value);
    if (Number.isFinite(value) && value > 0) {
      state.weightKg = value;
      localStorage.setItem(WEIGHT_KEY, String(value));
    } else {
      state.weightKg = null;
      localStorage.removeItem(WEIGHT_KEY);
      input.value = "";
    }
    renderMenuAlert();
    if (state.currentView === "results") renderChart();
  });
}

// Red dot on the menu button when a useful setting (weight) is still missing.
function renderMenuAlert() {
  $("#menu-alert").classList.toggle("hidden", state.weightKg !== null);
}

export function renderMenuInitials() {
  $("#menu-initials").textContent = state.me ? state.me.initials : "⚙";
}
