/* Presentation view: loads the event config, builds the course maps, and
   handles participant registration. Loading the event also seeds the controls
   owned by the results and admin features (metric tabs, loop-type buttons). */

import { API } from "../api.js";
import { state, ME_KEY } from "../core/state.js";
import { $, $$, toast } from "../core/dom.js";
import {
  buildMetricTabs,
  buildSpeedUnitToggle,
  buildGourmandiseToggle,
} from "./results.js";
import { buildLoopTypeControls } from "./admin.js";
import { renderMenuInitials } from "./settings.js";

export async function loadEvent() {
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

export async function loadMe() {
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

export function initRegistration() {
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
