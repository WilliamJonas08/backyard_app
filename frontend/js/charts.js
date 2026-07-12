/* Minimalist SVG line chart, hand-rolled to get exactly the look we want:
   a thin line per runner, a small dot at every loop step, and a larger dot on
   each runner's latest record with their initials in the middle.
   Identity is carried by those initials labels — not by per-runner colours —
   so every line shares one accent hue and the selected runner is emphasised. */

const Charts = (() => {
  const NS = "http://www.w3.org/2000/svg";
  const W = 640;
  const H = 300;
  const PAD = { top: 20, right: 34, bottom: 34, left: 46 };

  const el = (name, attrs = {}, text) => {
    const node = document.createElementNS(NS, name);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    if (text !== undefined) node.textContent = text;
    return node;
  };

  const niceMax = (value) => {
    if (value <= 0) return 1;
    const pow = Math.pow(10, Math.floor(Math.log10(value)));
    const n = value / pow;
    const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
    return step * pow;
  };

  /**
   * @param {HTMLElement} container
   * @param {Object} opts
   *   series: [{participant, points}]
   *   metricKey: field on each point to plot
   *   maxLoops: number of loops on the x-axis
   *   formatY: (value) => string  (axis + caption)
   *   transform: (rawValue) => value  optional unit conversion (default identity)
   *   selectedId: participant id to emphasise (or null)
   */
  function render(container, opts) {
    const { series, metricKey, maxLoops, formatY, selectedId } = opts;
    const transform = opts.transform || ((v) => v);
    container.innerHTML = "";

    // Collect (loop, value) pairs per runner, dropping null metric values.
    const runners = series
      .map((s) => ({
        participant: s.participant,
        pts: s.points
          .filter((p) => p[metricKey] !== null && p[metricKey] !== undefined)
          .map((p) => ({ x: p.loop_number, y: transform(p[metricKey]) })),
      }))
      .filter((r) => r.pts.length > 0);

    if (runners.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty";
      empty.textContent = "Pas encore de données pour ce graphique.";
      container.appendChild(empty);
      return;
    }

    const maxY = niceMax(
      Math.max(...runners.flatMap((r) => r.pts.map((p) => p.y)))
    );
    const xMax = Math.max(maxLoops, 1);

    const plotW = W - PAD.left - PAD.right;
    const plotH = H - PAD.top - PAD.bottom;
    const sx = (x) => PAD.left + (xMax <= 1 ? plotW / 2 : ((x - 1) / (xMax - 1)) * plotW);
    const sy = (y) => PAD.top + plotH - (y / maxY) * plotH;

    const svg = el("svg", {
      viewBox: `0 0 ${W} ${H}`,
      preserveAspectRatio: "xMidYMid meet",
      role: "img",
    });

    // Horizontal gridlines + y labels
    const GRID_LINES = 4;
    for (let i = 0; i <= GRID_LINES; i++) {
      const value = (maxY / GRID_LINES) * i;
      const y = sy(value);
      svg.appendChild(
        el("line", {
          class: "ch-grid",
          x1: PAD.left,
          x2: W - PAD.right,
          y1: y,
          y2: y,
        })
      );
      svg.appendChild(
        el(
          "text",
          { class: "ch-ylabel", x: PAD.left - 8, y: y + 3, "text-anchor": "end" },
          formatY(value, true)
        )
      );
    }

    // X ticks (loop numbers)
    for (let loop = 1; loop <= xMax; loop++) {
      svg.appendChild(
        el(
          "text",
          {
            class: "ch-xlabel",
            x: sx(loop),
            y: H - PAD.bottom + 18,
            "text-anchor": "middle",
          },
          loop
        )
      );
    }
    svg.appendChild(
      el(
        "text",
        {
          class: "ch-axis-title",
          x: PAD.left + plotW / 2,
          y: H - 2,
          "text-anchor": "middle",
        },
        "Boucle n°"
      )
    );

    // Draw unselected runners first, then the selected one on top.
    const ordered = [...runners].sort((a, a2) => {
      const aSel = a.participant.id === selectedId ? 1 : 0;
      const bSel = a2.participant.id === selectedId ? 1 : 0;
      return aSel - bSel;
    });

    for (const runner of ordered) {
      const selected = runner.participant.id === selectedId;
      const dim = selectedId !== null && !selected;
      const cls = selected ? "ch-line ch-line--sel" : "ch-line";
      const pts = runner.pts;

      // Line
      if (pts.length > 1) {
        const d = pts
          .map((p, i) => `${i === 0 ? "M" : "L"}${sx(p.x)},${sy(p.y)}`)
          .join(" ");
        svg.appendChild(
          el("path", { class: cls, d, opacity: dim ? 0.18 : 1 })
        );
      }

      // Small dot at every step (all but the last)
      pts.slice(0, -1).forEach((p) => {
        svg.appendChild(
          el("circle", {
            class: selected ? "ch-dot ch-dot--sel" : "ch-dot",
            cx: sx(p.x),
            cy: sy(p.y),
            r: 2.6,
            opacity: dim ? 0.18 : 1,
          })
        );
      });

      // Larger endpoint dot with initials
      const last = pts[pts.length - 1];
      const g = el("g", { opacity: dim ? 0.28 : 1 });
      g.appendChild(
        el("circle", {
          class: selected ? "ch-end ch-end--sel" : "ch-end",
          cx: sx(last.x),
          cy: sy(last.y),
          r: 11,
        })
      );
      g.appendChild(
        el(
          "text",
          {
            class: selected ? "ch-initials ch-initials--sel" : "ch-initials",
            x: sx(last.x),
            y: sy(last.y) + 3.5,
            "text-anchor": "middle",
          },
          runner.participant.initials
        )
      );
      svg.appendChild(g);
    }

    container.appendChild(svg);
  }

  return { render };
})();
