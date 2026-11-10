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

function row(label, symbol, value, unit) {
  return `<tr><td>${label}</td><td class="sym">${symbol}</td><td class="num">${value}</td><td>${unit}</td></tr>`;
}

function render() {
  const out = document.getElementById("results");
  const stepsOut = document.getElementById("steps");
  try {
    const r = Calc.run(inputs);

    stepsOut.innerHTML = `
      <table>
        <thead><tr><th>Step</th><th class="num">Processing time (h)</th><th class="num">Rework rate</th><th class="num">Arrival rate λᵢ (per h)</th></tr></thead>
        <tbody>${r.steps.map(s => `
          <tr><td>${s.name}</td><td class="num">${fmt(s.t0Hours)}</td><td class="num">${fmt(s.p * 100, 3)}%</td><td class="num">${fmt(s.lambda)}</td></tr>`).join("")}
        </tbody>
      </table>`;

    out.innerHTML = `
      ${r.stable ? "" : `<p class="warn">Utilization is ${fmt(r.rho * 100, 3)}%. At 100% or more the queue grows without limit, so Kingman's equation doesn't apply. Lower the arrival rate or add a stepper.</p>`}
      <table>
        <thead><tr><th>Result</th><th>Symbol</th><th class="num">Value</th><th>Unit</th></tr></thead>
        <tbody>
          ${row("Lot arrival rate", "λ<sub>lot</sub>", fmt(r.lambdaLot), "lots per hour")}
          ${row("Arrival rate at this stepper", "λ", fmt(r.lambda), "visits per hour")}
          ${row("Average processing time (job mix)", "t̄<sub>0</sub>", fmt(r.t0bar), "hours")}
          ${row("Processing variability (job mix)", "c<sub>0</sub>²", fmt(r.c0Sq), "")}
          ${row("Effective processing time", "t<sub>e</sub>", fmt(r.te), "hours")}
          ${row("Effective variability", "c<sub>e</sub>²", fmt(r.ceSq), "")}
          ${row("Utilization", "ρ", fmt(r.rho * 100, 4) + "%", "")}
          ${row("Average wait in queue", "W<sub>q</sub>", fmt(r.Wq), "hours")}
          ${row("Time at stepper (wait + processing)", "CT", fmt(r.cycleTime), "hours")}
          ${row("Average lots waiting", "L<sub>q</sub>", fmt(r.Lq), "lots")}
        </tbody>
      </table>`;
  } catch (err) {
    stepsOut.innerHTML = "";
    out.innerHTML = `<p class="warn">The inputs in js/app.js need fixing:</p><pre>${err.message}</pre>`;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  render();
  if (typeof runSelfChecks === "function") runSelfChecks();
});
