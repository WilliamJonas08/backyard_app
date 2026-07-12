/* Central application state and configuration constants.
   State is intentionally small and centralised: every feature module imports
   this single `state` object (same reference) and reads/writes it directly. */

import { GOURMANDISE } from "../gourmandise.js";
import { formatDuration } from "./dom.js";

export const POLL_MS = 10000;
export const ME_KEY = "backyard_participant_id";
export const THEME_KEY = "backyard_theme";
export const WEIGHT_KEY = "backyard_weight_kg";

export const METRICS = [
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
export const SPEED_UNITS = {
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

export const state = {
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
