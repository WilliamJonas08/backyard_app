/* Application controller: navigation, live polling, and view rendering.
   State is intentionally small and centralised; each render function reads from
   `state` and writes DOM. Data refreshes every POLL_MS while the results view
   is visible. */

(() => {
  const POLL_MS = 10000;
  const ME_KEY = "backyard_participant_id";
  const THEME_KEY = "backyard_theme";
  const WEIGHT_KEY = "backyard_weight_kg";

  const METRICS = [
    {
      key: "cumulative_distance_km",
      label: "Distance cumulée",
      unit: "km",
      format: (v) => `${v.toFixed(1)}`,
      caption: "Distance totale parcourue, boucle après boucle.",
    },
    {
      key: "total_time_seconds",
      label: "Temps total",
      unit: "",
      format: (v) => formatDuration(v),
      caption: "Temps cumulé passé à courir.",
    },
    {
      key: "loop_speed_kmh",
      label: "Vitesse / boucle",
      isSpeed: true,
      caption: "Vitesse moyenne sur chaque boucle.",
    },
    {
      key: "cumulative_speed_kmh",
      label: "Vitesse moyenne",
      isSpeed: true,
      caption: "Vitesse moyenne depuis le départ jusqu'à chaque boucle.",
    },
    {
      key: "gourmandise",
      label: "Gourmandise",
      isGourmandise: true,
      caption: "Ce que tes calories dépensées représentent.",
    },
  ];

  // Speed can be shown as pace (min/km, the runner-friendly default) or km/h.
  const SPEED_UNITS = {
    "min/km": {
      label: "min/km",
      // km/h -> minutes per km
      transform: (kmh) => 60 / kmh,
      // received value is already in minutes/km (decimal) -> "M:SS"
      format: (paceMin) => {
        const m = Math.floor(paceMin);
        const s = Math.round((paceMin - m) * 60);
        return s === 60 ? `${m + 1}:00` : `${m}:${String(s).padStart(2, "0")}`;
      },
    },
    "km/h": {
      label: "km/h",
      transform: (kmh) => kmh,
      format: (kmh) => kmh.toFixed(1),
    },
  };

  const state = {
    event: null,
    leaderboard: [],
    series: [],
    metricKey: METRICS[0].key,
    speedUnit: "min/km",
    gourmandiseProduct: GOURMANDISE.PRODUCTS[0].key,
    selectedId: null,
    loopType: null,
    nextLoop: null,
    pollTimer: null,
    currentView: "presentation",
    theme: "dark",
    weightKg: null,
    me: null,
  };

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  // Formatting helpers ------------------------------------------------------
  function formatDuration(totalSeconds) {
    const s = Math.round(totalSeconds || 0);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}h${String(m).padStart(2, "0")}`;
    return `${m}:${String(sec).padStart(2, "0")}`;
  }

  function toast(message, isError = false) {
    const t = $("#toast");
    t.textContent = message;
    t.classList.toggle("toast--error", isError);
    t.classList.add("is-visible");
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => t.classList.remove("is-visible"), 2600);
  }

  // Settings menu (theme + weight) ------------------------------------------
  function loadSettings() {
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

  function initMenu() {
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

  function renderMenuInitials() {
    $("#menu-initials").textContent = state.me ? state.me.initials : "⚙";
  }

  // Navigation --------------------------------------------------------------
  function switchView(target) {
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

  // Event / presentation ----------------------------------------------------
  async function loadEvent() {
    state.event = await API.getEvent();
    const ev = state.event;
    $("#event-name").textContent = ev.name;
    $("#hero-title").textContent = ev.name;
    $("#event-subtitle").textContent = ev.subtitle;
    $("#event-presentation").textContent = ev.presentation;

    const list = $("#event-todolist");
    list.innerHTML = "";
    ev.todolist.forEach((item) => {
      const li = document.createElement("li");
      li.textContent = item;
      list.appendChild(li);
    });

    buildLoopTypeControls();
    buildMetricTabs();
    buildSpeedUnitToggle();
    buildGourmandiseToggle();
    buildCourseMap();
  }

  // Course map: one button per loop type that has a map, switching the embedded
  // calculitineraires.fr route below. Map ids come from the event config.
  function buildCourseMap() {
    const wrap = $("#map-loop-type");
    const frame = $("#course-map");
    const loops = state.event.loop_types.filter((lt) => lt.map_id);
    wrap.innerHTML = "";
    if (loops.length === 0) return;

    const showMap = (mapId) => {
      frame.src =
        "https://www.calculitineraires.fr/serviceweb/carteweb.php?id=" +
        mapId +
        "&zoom=auto&type=plan&color=FF0000";
    };

    loops.forEach((loopType, index) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = loopType.label;
      if (index === 0) btn.classList.add("is-active");
      btn.addEventListener("click", () => {
        $$("#map-loop-type button").forEach((b) =>
          b.classList.toggle("is-active", b === btn)
        );
        showMap(loopType.map_id);
      });
      wrap.appendChild(btn);
    });

    showMap(loops[0].map_id);
  }

  function renderRegistration(participant) {
    state.me = participant || null;
    const hasMe = Boolean(participant);
    $("#register-form-wrap").classList.toggle("hidden", hasMe);
    $("#register-done").classList.toggle("hidden", !hasMe);
    if (hasMe) {
      $("#registered-name").textContent = participant.name;
      $("#registered-initials").textContent = participant.initials;
    }
    renderMenuInitials();
  }

  async function loadMe() {
    const id = localStorage.getItem(ME_KEY);
    if (!id) return renderRegistration(null);
    try {
      const me = await API.getParticipant(id);
      renderRegistration(me);
    } catch (_) {
      localStorage.removeItem(ME_KEY);
      renderRegistration(null);
    }
  }

  // Results -----------------------------------------------------------------
  async function refreshResults() {
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

  function renderLeaderboard() {
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
      } · ${formatDuration(entry.total_time_seconds)}${
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

  function buildMetricTabs() {
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

  function buildSpeedUnitToggle() {
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

  function buildGourmandiseToggle() {
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

  function renderChart() {
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

  // Registration events -----------------------------------------------------
  function initRegistration() {
    $("#register-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = $("#register-name").value.trim();
      $("#register-error").textContent = "";
      if (!name) return;
      try {
        const me = await API.register(name);
        localStorage.setItem(ME_KEY, me.id);
        renderRegistration(me);
        toast(`Bienvenue, ${me.name} !`);
      } catch (err) {
        $("#register-error").textContent = err.message;
      }
    });

    $("#btn-unregister").addEventListener("click", () => {
      localStorage.removeItem(ME_KEY);
      $("#register-name").value = "";
      renderRegistration(null);
    });
  }

  // Admin -------------------------------------------------------------------
  function buildLoopTypeControls() {
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

  function initAdmin() {
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

  async function refreshAdminIfLoggedIn() {
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

  // Utils -------------------------------------------------------------------
  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // Boot --------------------------------------------------------------------
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
})();
