/* Application entry point: wires the feature modules together on boot.
   Each feature owns its own state slice and DOM; this file only orchestrates
   their initialisation and the initial data load. */

import { $$, toast } from "./core/dom.js";
import { switchView } from "./features/nav.js";
import { initMenu, loadSettings } from "./features/settings.js";
import { initRegistration, loadEvent, loadMe } from "./features/event.js";
import { initAdmin } from "./features/admin.js";

async function init() {
  loadSettings();
  $$(".tab").forEach((tab) =>
    tab.addEventListener("click", () => switchView(tab.dataset.target))
  );
  initRegistration();
  initAdmin();
  initMenu();
  try {
    await loadEvent();
    await loadMe();
  } catch (err) {
    toast("Impossible de charger l'événement.", true);
  }
  // Optional deep-link to a tab, e.g. /?tab=results
  const tab = new URLSearchParams(location.search).get("tab");
  if (["presentation", "results", "admin"].includes(tab)) switchView(tab);
}

document.addEventListener("DOMContentLoaded", init);
