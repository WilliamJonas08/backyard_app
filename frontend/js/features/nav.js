/* Top-level navigation between views, plus the live polling that refreshes the
   results while that view is visible. */

import { state, POLL_MS } from "../core/state.js";
import { $$ } from "../core/dom.js";
import { refreshResults } from "./results.js";
import { refreshAdminIfLoggedIn } from "./admin.js";

export function switchView(target) {
  state.currentView = target;
  $$(".view").forEach((v) =>
    v.classList.toggle("hidden", v.dataset.view !== target)
  );
  $$(".tab").forEach((t) =>
    t.classList.toggle("is-active", t.dataset.target === target)
  );
  if (target === "results") {
    refreshResults();
    startPolling();
  } else {
    stopPolling();
  }
  if (target === "admin") refreshAdminIfLoggedIn();
}

function startPolling() {
  stopPolling();
  state.pollTimer = setInterval(refreshResults, POLL_MS);
}

function stopPolling() {
  if (state.pollTimer) clearInterval(state.pollTimer);
  state.pollTimer = null;
}
