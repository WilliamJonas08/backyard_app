/* Small DOM and formatting helpers shared by every feature module.
   Pure and dependency-free so they can be imported anywhere without cycles. */

export const $ = (sel) => document.querySelector(sel);
export const $$ = (sel) => Array.from(document.querySelectorAll(sel));

export function formatDuration(totalSeconds) {
  const s = Math.round(totalSeconds || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h${String(m).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export function toast(message, isError = false) {
  const t = $("#toast");
  t.textContent = message;
  t.classList.toggle("toast--error", isError);
  t.classList.add("is-visible");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => t.classList.remove("is-visible"), 2600);
}

export function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
