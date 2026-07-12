/* Admin and super-admin panels: recording a runner's next loop, plus the
   super-admin record editing (correct / delete) and database reset. */

import { API } from "../api.js";
import { state } from "../core/state.js";
import { $, $$, formatDuration, toast, escapeHtml } from "../core/dom.js";
import { refreshResults } from "./results.js";

// Loop-type buttons in the record form. Exported because the event loader
// rebuilds them once the event config is known.
export function buildLoopTypeControls() {
  const wrap = $("#result-loop-type");
  wrap.innerHTML = "";
  state.event.loop_types.forEach((lt, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = lt.label;
    btn.dataset.key = lt.key;
    if (i === 0) {
      btn.classList.add("is-active");
      state.loopType = lt.key;
    }
    btn.addEventListener("click", () => {
      state.loopType = lt.key;
      $$("#result-loop-type button").forEach((b) =>
        b.classList.toggle("is-active", b === btn)
      );
    });
    wrap.appendChild(btn);
  });
}

async function populateParticipantSelect() {
  const select = $("#result-participant");
  const current = select.value;
  const participants = await API.getParticipants();
  select.innerHTML = '<option value="" disabled>— choisir —</option>';
  participants.forEach((p) => {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.name;
    select.appendChild(opt);
  });
  if (current && participants.some((p) => String(p.id) === current))
    select.value = current;
  else select.selectedIndex = 0;
  await refreshNextLoop();
}

// Fetch the runner's next unvalidated loop and reflect it in the UI. Admins
// never pick the loop — the server always records this one.
async function refreshNextLoop() {
  const banner = $("#next-loop-banner");
  const value = $("#next-loop-value");
  const submit = $("#result-form").querySelector('button[type="submit"]');
  const participantId = parseInt($("#result-participant").value, 10);

  if (!participantId) {
    state.nextLoop = null;
    banner.classList.remove("next-loop--done");
    value.textContent = "—";
    submit.disabled = true;
    return;
  }
  try {
    const info = await API.getNextLoop(participantId);
    state.nextLoop = info.next_loop;
    if (info.next_loop === null) {
      banner.classList.add("next-loop--done");
      value.textContent = `Terminé (${info.max_loops}/${info.max_loops})`;
      submit.disabled = true;
    } else {
      banner.classList.remove("next-loop--done");
      value.textContent = `Boucle ${info.next_loop} / ${info.max_loops}`;
      submit.disabled = false;
    }
  } catch (err) {
    toast(err.message, true);
  }
}

export function initAdmin() {
  // Toggle participation fields
  const participated = $("#result-participated");
  participated.addEventListener("change", () => {
    $("#participation-fields").classList.toggle("hidden", !participated.checked);
  });

  // Selecting a runner reveals which loop will be recorded next.
  $("#result-participant").addEventListener("change", refreshNextLoop);

  // Admin login
  $("#admin-login").addEventListener("submit", async (e) => {
    e.preventDefault();
    const pw = $("#admin-password").value;
    $("#admin-error").textContent = "";
    API.setAdminPw(pw);
    try {
      await API.checkAdmin();
      showAdminPanel();
    } catch (err) {
      API.clearAdminPw();
      $("#admin-error").textContent = err.message;
    }
  });

  $("#btn-admin-logout").addEventListener("click", () => {
    API.clearAdminPw();
    API.clearSuperPw();
    $("#admin-panel").classList.add("hidden");
    $("#admin-gate").classList.remove("hidden");
    $("#admin-password").value = "";
  });

  // Record a result (server picks the loop = next unvalidated one)
  $("#result-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    $("#result-msg").textContent = "";
    const participantId = parseInt($("#result-participant").value, 10);
    if (!participantId) {
      $("#result-msg").textContent = "Choisis un coureur.";
      return;
    }
    if (state.nextLoop === null) {
      $("#result-msg").textContent =
        "Toutes les boucles de ce coureur sont déjà enregistrées.";
      return;
    }
    const didRun = $("#result-participated").checked;
    const body = {
      participant_id: participantId,
      participated: didRun,
      loop_type: didRun ? state.loopType : null,
      time_seconds: didRun ? readTimeInput() : null,
    };
    if (didRun && body.time_seconds === null) {
      $("#result-msg").textContent = "Renseigne le temps réalisé.";
      return;
    }
    try {
      await API.recordResult(body);
      toast("Boucle enregistrée ✓");
      $("#result-minutes").value = "";
      $("#result-seconds").value = "";
      $("#result-participated").checked = true;
      $("#participation-fields").classList.remove("hidden");
      await refreshNextLoop(); // advances the banner to the following loop
      refreshSuperRecordsIfVisible();
    } catch (err) {
      $("#result-msg").textContent = err.message;
    }
  });

  // Super-admin login
  $("#super-login").addEventListener("submit", async (e) => {
    e.preventDefault();
    const pw = $("#super-password").value;
    $("#super-error").textContent = "";
    API.setSuperPw(pw);
    try {
      await API.checkSuper();
      $("#super-gate").classList.add("hidden");
      $("#super-panel").classList.remove("hidden");
      renderRecords();
    } catch (err) {
      API.clearSuperPw();
      $("#super-error").textContent = err.message;
    }
  });

  // Super-admin: wipe the whole database (clean slate before the event).
  $("#btn-reset-db").addEventListener("click", async () => {
    const confirmed = confirm(
      "Réinitialiser toute la base ?\n\n" +
        "Tous les coureurs et tous les résultats seront définitivement " +
        "supprimés. Cette action est irréversible."
    );
    if (!confirmed) return;
    try {
      await API.resetDatabase();
      toast("Base de données réinitialisée ✓");
      renderRecords();
      populateParticipantSelect();
      if (state.currentView === "results") refreshResults();
    } catch (err) {
      toast(err.message, true);
    }
  });
}

function readTimeInput() {
  const min = parseInt($("#result-minutes").value, 10);
  const sec = parseInt($("#result-seconds").value, 10);
  if (Number.isNaN(min) && Number.isNaN(sec)) return null;
  return (Number.isNaN(min) ? 0 : min) * 60 + (Number.isNaN(sec) ? 0 : sec);
}

function showAdminPanel() {
  $("#admin-gate").classList.add("hidden");
  $("#admin-panel").classList.remove("hidden");
  populateParticipantSelect();
}

export async function refreshAdminIfLoggedIn() {
  if (!API.getAdminPw()) return;
  try {
    await API.checkAdmin();
    showAdminPanel();
    if (API.getSuperPw()) {
      try {
        await API.checkSuper();
        $("#super-gate").classList.add("hidden");
        $("#super-panel").classList.remove("hidden");
        renderRecords();
      } catch (_) {
        API.clearSuperPw();
      }
    }
  } catch (_) {
    API.clearAdminPw();
  }
}

function refreshSuperRecordsIfVisible() {
  if (!$("#super-panel").classList.contains("hidden")) renderRecords();
}

// Super-admin record editing ---------------------------------------------
async function renderRecords() {
  const container = $("#records-list");
  const empty = $("#records-empty");
  try {
    const [results, participants] = await Promise.all([
      API.listResults(),
      API.getParticipants(),
    ]);
    const nameById = Object.fromEntries(
      participants.map((p) => [p.id, p.name])
    );
    empty.classList.toggle("hidden", results.length > 0);
    container.innerHTML = "";
    results
      .sort((a, b) =>
        a.participant_id === b.participant_id
          ? a.loop_number - b.loop_number
          : (nameById[a.participant_id] || "").localeCompare(
              nameById[b.participant_id] || ""
            )
      )
      .forEach((r) => container.appendChild(renderRecordRow(r, nameById)));
  } catch (err) {
    toast(err.message, true);
  }
}

function renderRecordRow(record, nameById) {
  const div = document.createElement("div");
  div.className = "record";

  const detail = record.participated
    ? `Boucle ${record.loop_number} · ${record.loop_type} · ${formatDuration(
        record.time_seconds
      )}`
    : `Boucle ${record.loop_number} · non couru`;

  const loopOptions = state.event.loop_types
    .map(
      (lt) =>
        `<option value="${lt.key}" ${
          lt.key === record.loop_type ? "selected" : ""
        }>${lt.label}</option>`
    )
    .join("");

  const min = record.time_seconds ? Math.floor(record.time_seconds / 60) : "";
  const sec = record.time_seconds ? record.time_seconds % 60 : "";

  div.innerHTML = `
    <div class="record__top">
      <div>
        <div class="record__who">${escapeHtml(
          nameById[record.participant_id] || "?"
        )}</div>
        <div class="record__detail">${detail}</div>
      </div>
    </div>
    <div class="record__actions">
      <button class="icon-btn" data-act="edit">Modifier</button>
      <button class="icon-btn icon-btn--danger" data-act="delete">Supprimer</button>
    </div>
    <div class="record__edit">
      <select class="input" data-field="loop_type">${loopOptions}</select>
      <div class="time-input">
        <input class="input" type="number" min="0" data-field="min" value="${min}" placeholder="min" />
        <span class="time-input__sep">:</span>
        <input class="input" type="number" min="0" max="59" data-field="sec" value="${sec}" placeholder="sec" />
      </div>
      <button class="icon-btn" data-act="save">Enregistrer</button>
      <button class="icon-btn" data-act="cancel">Annuler</button>
    </div>
  `;

  div.querySelector('[data-act="edit"]').addEventListener("click", () =>
    div.classList.add("is-editing")
  );
  div.querySelector('[data-act="cancel"]').addEventListener("click", () =>
    div.classList.remove("is-editing")
  );
  div.querySelector('[data-act="delete"]').addEventListener("click", async () => {
    if (!confirm("Supprimer cet enregistrement ?")) return;
    try {
      await API.deleteResult(record.id);
      toast("Enregistrement supprimé");
      renderRecords();
    } catch (err) {
      toast(err.message, true);
    }
  });
  div.querySelector('[data-act="save"]').addEventListener("click", async () => {
    const loopType = div.querySelector('[data-field="loop_type"]').value;
    const m = parseInt(div.querySelector('[data-field="min"]').value, 10) || 0;
    const s = parseInt(div.querySelector('[data-field="sec"]').value, 10) || 0;
    try {
      await API.updateResult(record.id, {
        loop_type: loopType,
        time_seconds: m * 60 + s,
      });
      toast("Correction enregistrée ✓");
      renderRecords();
    } catch (err) {
      toast(err.message, true);
    }
  });

  return div;
}
