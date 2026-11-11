/*
  app.js — holds the inputs, runs Module 1, and shows the results.
  PLACEHOLDER NUMBERS: replace the values below with Peixuan's SMT2020 data
  (Data Spec doc, "Data to collect"). Times in hours, rates as decimals.
*/
const inputs = {
  lotIntervalMin: 50.68,   // minutes between new lots (SMT2020 paper; confirm per product)
  N: 3,                    // steppers sharing the dedicated lots (placeholder)
  A: 0.862,                // litho availability (SMT2020 paper)
  mttrHours: 4,            // mean time to repair (placeholder)
  crSq: 1,                 // repair-time variability; 1 = exponential
  caSq: 1,                 // arrival variability (our assumption)
  c0StepSq: 0.0008,        // per-step processing noise: uniform +/-5% -> 0.1^2 / 12
  steps: [                 // litho steps on Product 4's route that use this stepper (placeholders)
    { name: "Layer A", t0Hours: 0.40, p: 0.02 },
    { name: "Layer B", t0Hours: 0.55, p: 0.01 },
    { name: "Layer C", t0Hours: 0.30, p: 0.00 },
    { name: "Layer D", t0Hours: 0.70, p: 0.005 }
  ]
};

const fmt = (x, digits = 4) =>
  Number.isFinite(x) ? Number(x.toPrecision(digits)).toString() : "∞";
const pct = x => Number.isFinite(x) ? `${fmt(x * 100, 3)}%` : "∞";

// Wait vs. utilization, holding this stepper's te, ca2 and ce2 fixed:
// Kingman's rho / (1 - rho) term made visible, with the current state marked.
function curveSVG(r, widthPx) {
  const W = Math.round(Math.max(320, Math.min(widthPx || 720, 900)));
  const narrow = W < 520;
  const H = narrow ? 300 : 370, m = { l: 64, r: 18, t: 36, b: 58 };
  const x0 = 0.3, x1 = 0.98;
  const wait = rho => ((inputs.caSq + r.ceSq) / 2) * (rho / (1 - rho)) * r.te;
  const yMax = Math.max(wait(0.95), r.stable ? r.Wq * 1.15 : 0);
  const X = rho => m.l + (rho - x0) / (x1 - x0) * (W - m.l - m.r);
  const Y = w => H - m.b - Math.min(w, yMax) / yMax * (H - m.t - m.b);

  const pts = [];
  for (let rho = x0; rho <= x1 + 1e-9; rho += 0.005) {
    if (wait(rho) > yMax) { pts.push([X(rho), Y(yMax)]); break; }
    pts.push([X(rho), Y(wait(rho))]);
  }
  const path = "M" + pts.map(p => p.map(v => v.toFixed(1)).join(" ")).join(" L");

  const step = yMax > 40 ? 10 : yMax > 16 ? 5 : yMax > 6 ? 2 : 1;
  let ticks = "";
  for (let w = 0; w <= yMax; w += step) {
    ticks += `<line class="grid" x1="${m.l}" x2="${W - m.r}" y1="${Y(w)}" y2="${Y(w)}"/>
      <text class="tick" x="${m.l - 10}" y="${Y(w) + 5}" text-anchor="end">${w}</text>`;
  }
  for (let p = 30; p <= 90; p += narrow ? 20 : 10) {
    ticks += `<text class="tick" x="${X(p / 100)}" y="${H - m.b + 24}" text-anchor="middle">${p}%</text>`;
  }

  let here = "";
  if (r.stable && r.rho >= x0 && r.rho <= x1) {
    const hx = X(r.rho), hy = Y(r.Wq);
    const end = hx > W * 0.6;
    const tx = hx + (end ? -16 : 16);
    here = `<line class="here-line" x1="${hx}" x2="${hx}" y1="${hy}" y2="${H - m.b}"/>
      <circle class="here" cx="${hx}" cy="${hy}" r="9"/>
      <text class="here-label" x="${tx}" y="${hy - 32}" text-anchor="${end ? "end" : "start"}">
        <tspan x="${tx}">This stepper</tspan>
        <tspan x="${tx}" dy="20">${pct(r.rho)} busy, ${fmt(r.Wq, 3)} h wait</tspan></text>`;
  }

  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Average wait rises sharply as utilization approaches 100 percent; this stepper is at ${pct(r.rho)} utilization with a ${fmt(r.Wq, 3)} hour wait.">
    <rect class="zone" x="${X(0.85)}" y="${m.t}" width="${X(x1) - X(0.85)}" height="${H - m.t - m.b}"/>
    <text class="zone-label" x="${X(x1)}" y="${m.t - 12}" text-anchor="end">${narrow ? "SMT2020 litho range" : "Where SMT2020’s lithography tools run"}</text>
    ${ticks}
    <line class="axis" x1="${m.l}" x2="${W - m.r}" y1="${H - m.b}" y2="${H - m.b}"/>
    <line class="axis" x1="${m.l}" x2="${m.l}" y1="${m.t}" y2="${H - m.b}"/>
    <path class="line" d="${path}"/>
    ${here}
    <text class="axis-label" x="${(W + m.l) / 2}" y="${H - 10}" text-anchor="middle">Utilization ρ</text>
    <text class="axis-label" transform="translate(18 ${(H - m.b + m.t) / 2}) rotate(-90)" text-anchor="middle">Average wait (hours)</text>
  </svg>`;
}

function routeHTML(r) {
  const stations = [
    ["Arrivals", `λ = ${fmt(r.lambda, 3)} per h`, "Lots per hour, plus an extra pass for each rework, split across the steppers."],
    ["Job mix", `c₀² = ${fmt(r.c0Sq, 3)}`, "Different lithography steps take different times, which adds variability."],
    ["Breakdowns", `cₑ² = ${fmt(r.ceSq, 3)}`, "Downtime stretches each job and makes processing less predictable."],
    ["Utilization", `ρ = ${pct(r.rho)}`, "The share of time the stepper is busy."],
    ["Wait", `W<sub>q</sub> = ${fmt(r.Wq, 3)} h`, "Kingman’s equation combines variability, utilization, and processing time."]
  ];
  return stations.map(([t, v, d]) => `<li><h3>${t} <span>${v}</span></h3><p>${d}</p></li>`).join("");
}

function row(label, symbol, value, unit) {
  return `<tr><td>${label}</td><td class="sym">${symbol}</td><td class="num">${value}</td><td>${unit}</td></tr>`;
}

function render() {
  const $ = id => document.getElementById(id);
  try {
    const r = Calc.run(inputs);

    $("readout").innerHTML = `
      <div><dt>Utilization</dt><dd>${pct(r.rho)}</dd></div>
      <div class="key"><dt>Average wait in queue</dt><dd>${fmt(r.Wq, 3)} <small>hours</small></dd></div>
      <div><dt>Time at stepper</dt><dd>${fmt(r.cycleTime, 3)} <small>hours</small></dd></div>
      <div><dt>Lots waiting</dt><dd>${fmt(r.Lq, 3)} <small>lots</small></dd></div>`;

    $("curve").innerHTML = (r.stable ? "" :
      `<p class="warn">Utilization is ${pct(r.rho)}. At 100% or more the queue grows without limit, so Kingman’s equation doesn’t apply.</p>`)
      + curveSVG(r, $("curve").clientWidth);

    $("route").innerHTML = routeHTML(r);

    $("steps").innerHTML = `
      <table>
        <thead><tr><th>Step</th><th class="num">Processing time (h)</th><th class="num">Rework rate</th><th class="num">Arrival rate λᵢ (per h)</th></tr></thead>
        <tbody>${r.steps.map(s => `
          <tr><td>${s.name}</td><td class="num">${fmt(s.t0Hours)}</td><td class="num">${pct(s.p)}</td><td class="num">${fmt(s.lambda)}</td></tr>`).join("")}
        </tbody>
      </table>`;

    $("results").innerHTML = `
      <table>
        <thead><tr><th>Value</th><th>Symbol</th><th class="num">Result</th><th>Unit</th></tr></thead>
        <tbody>
          ${row("Lot arrival rate", "λ<sub>lot</sub>", fmt(r.lambdaLot), "lots per hour")}
          ${row("Arrival rate at this stepper", "λ", fmt(r.lambda), "visits per hour")}
          ${row("Average processing time (job mix)", "t̄<sub>0</sub>", fmt(r.t0bar), "hours")}
          ${row("Processing variability (job mix)", "c<sub>0</sub>²", fmt(r.c0Sq), "")}
          ${row("Effective processing time", "t<sub>e</sub>", fmt(r.te), "hours")}
          ${row("Effective variability", "c<sub>e</sub>²", fmt(r.ceSq), "")}
          ${row("Utilization", "ρ", pct(r.rho), "")}
          ${row("Average wait in queue", "W<sub>q</sub>", fmt(r.Wq), "hours")}
          ${row("Time at stepper (wait + processing)", "CT", fmt(r.cycleTime), "hours")}
          ${row("Average lots waiting", "L<sub>q</sub>", fmt(r.Lq), "lots")}
        </tbody>
      </table>`;
  } catch (err) {
    ["readout", "curve", "route", "steps", "results"].forEach(id => $(id).innerHTML = "");
    $("curve").innerHTML = `<p class="warn">The inputs in js/app.js need fixing:</p><pre>${err.message}</pre>`;
  }
}

let resizeTimer;
window.addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(render, 150); });

document.addEventListener("DOMContentLoaded", () => {
  render();
  if (typeof runSelfChecks === "function") runSelfChecks();
});
