/*
  app.js — holds the inputs, runs the capacity (Phase 1) and financial (Phase 2) calculations,
  the scenarios (Module 3) and the sliders (Module 4), and shows the results
  (pages: Explore, Scenarios, Costs, Data, Validation).
  All times in MINUTES, rates and percentages as decimals (1.7% = 0.017).
  calc.js works in minutes (to match the hand-calc); the readout and chart convert waits to hours.

  PLACEHOLDERS — DATA TO COLLECT for the tool group Peixuan chooses. Each item carries a `source`.
  Replace the value AND the source when the data changes. Anything with value null or an empty
  source shows up as "missing" in the "Data to collect" list on the page.
    1. Lot release: release interval and wafers per lot, for each product (and lot type) using the tool group
    2. Breakdowns: mean time to failure (MTTF) and mean time to repair (MTTR)
    3. Scheduled maintenance: how often (interval) and how long (duration) — used for availability
    4. Costs: $ per lot-hour of waiting, cost of an extra stepper, cost of a rework-reduction project
  Filled with Litho_FE_98 from the Dataset and Calculations docs, and costs from the Cost Assumptions doc.
*/
const inputs = {
  toolGroup: "Litho_FE_98",   // PLACEHOLDER: tool group Peixuan chooses
  m: 5,                       // parallel tools in the group (Toolgroups, row 66)
  loadMin: 1,                 // loading time per lot (Toolgroups, row 66)
  unloadMin: 1,               // unloading time per lot (Toolgroups, row 66)
  caSq: 1,                    // arrival variability (assumption A5; not observed)

  // 1. PLACEHOLDER — Lot release, per product and lot type. One lot per release event.
  products: {
    "Product 3": [
      { lotType: "Regular",   releaseIntervalMin: 51.69,    wafersPerLot: 25, source: "Calculations doc, Lot Release Data" },
      { lotType: "Hot",       releaseIntervalMin: 2016,     wafersPerLot: 25, source: "Calculations doc, Lot Release Data" },
      { lotType: "Super Hot", releaseIntervalMin: 27397.61, wafersPerLot: 25, source: "Calculations doc, Lot Release Data" },
    ],
    "Product 4": [
      { lotType: "Regular",   releaseIntervalMin: 51.69,    wafersPerLot: 25, source: "Calculations doc, Lot Release Data" },
      { lotType: "Hot",       releaseIntervalMin: 2016,     wafersPerLot: 25, source: "Calculations doc, Lot Release Data" },
    ],
  },

  // Litho steps on this tool group; uniform wafer time mean +/- offset (min).
  steps: [
    // Rework: Step 67 (074_Litho_Met) sends the whole lot back to Step 65 with probability 1.7%.
    { product: "Product 3", step: 65, name: "072_Litho", tWaferMin: 1.464, offsetMin: 0.0732, reworkProb: 0.017 },
    { product: "Product 3", step: 72, name: "079_Litho", tWaferMin: 3.300, offsetMin: 0.165 },
    { product: "Product 4", step: 68, name: "079_Litho", tWaferMin: 3.300, offsetMin: 0.170 },
  ],

  // 2 & 3. PLACEHOLDER — Downtime. mfMin = time between events, mrMin = how long each one lasts.
  //   Breakdown: mfMin = MTTF (uptime between failures). If the source gives MTBF instead,
  //   use MTTF = MTBF − MTTR. crSq = 1 means exponential repair times.
  //   PM: mfMin = how often (interval), mrMin = mean duration, offsetMin = uniform ± on the duration.
  interruptions: [
    { kind: "breakdown", name: "Breakdown",    mfMin: 10080,  mrMin: 705.59, crSq: 1,          source: "Calculations doc, BREAK_Litho" },
    { kind: "pm",        name: "Weekly PM",    mfMin: 10080,  mrMin: 399.0,  offsetMin: 79.8,  source: "Calculations doc, Scheduled Maintenance (7 d, 6.65 ± 1.33 h)" },
    { kind: "pm",        name: "Monthly PM",   mfMin: 43200,  mrMin: 797.4,  offsetMin: 159.6, source: "Calculations doc, Scheduled Maintenance (30 d, 13.29 ± 2.66 h)" },
    { kind: "pm",        name: "Quarterly PM", mfMin: 131040, mrMin: 1595.4, offsetMin: 319.2, source: "Calculations doc, Scheduled Maintenance (91 d, 26.59 ± 5.32 h)" },
  ],

  // 4. Cost assumptions — Litho Rework Cost Assumptions doc. Each has a base value and a low–high range.
  //    Bracketed numbers are that doc's source list.
  costs: {
    waitingPerLotHour: {
      label: "Holding cost rate", unit: "$/lot-h",
      // Derived, not published: wafers per lot x wafer cost x annual carrying rate / 8,760 h.
      // value, low and high ($ per lot-hour) are calculated from these parts when the page loads.
      parts: {
        base: { waferCost: 3000,  carryingRate: 0.25 },  // 28nm wafer [7], middle of the 20–30% rule of thumb [9]
        low:  { waferCost: 3000,  carryingRate: 0.20 },  // 28nm, 20%  -> $1.71
        high: { waferCost: 17000, carryingRate: 0.30 },  // advanced-node wafer [8], 30% -> $14.55
      },
      source: "Baseline $2.14 chosen by Isabella: 25 wafers × $3,000 (28nm [7]) × 25% annual holding rate (inventory carrying cost) [9], [10] ÷ 8,760 h. Range uses $3,000–$17,000 wafers [7], [8] and 20–30% holding rates.",
    },
    // Baselines chosen by Isabella (cost baselines and reasoning, Nov 2026).
    extraStepper: {
      label: "Cost of an extra stepper", unit: "$ per tool",
      value: 34e6, low: 7e6, high: 34e6,  // dry ArF [1]; range i-line to dry ArF
      annualOperatingCost: null,         // MISSING: yearly running/maintenance cost of a 6th tool, if any
      source: "Dry ArF ~$34M [1]: chosen by Isabella as the most verified and relevant cost. Range: i-line ~$7M to dry ArF ~$34M [1]. Excludes installation and qualification.",
    },
    reworkProject: {
      label: "Cost of a rework-reduction project", unit: "$ per project",
      value: 75000, low: 50000, high: 75000,  // Six Sigma worked examples [13]
      annualOperatingCost: null,             // MISSING: yearly cost to keep the improvement running, if any
      source: "$75,000 one-time: chosen by Isabella as the most supported value found ($50K–$75K examples [13]). A new resist would cost $2M–$5M [17].",
    },
  },

  // Module 3 scenarios.
  scenarios: {
    addSteppers: 1,             // 5 tools -> 6, rework stays at 1.7% (confirmed by Peixuan)
    reworkTarget: {             // Peixuan's target rework rate for 072_Litho (Product 3 Step 65), as a decimal
      value: 0.005,             // 1.7% -> 0.5%
      source: "Peixuan: the bottom of the SMT2020 rework range (0.5%–2%). Keeps 5 tools; the stepper scenario keeps rework at 1.7%.",
    },
  },

};

/* ---------- Derived cost values ---------- */
// The holding cost rate is calculated from wafer cost and annual holding rate, so it is filled in here.
(() => {
  const w = inputs.costs.waitingPerLotHour;
  const calc = c => Calc.carryingCostPerLotHour(inputs.products[Object.keys(inputs.products)[0]][0].wafersPerLot, c.waferCost, c.carryingRate);
  w.value = calc(w.parts.base); w.low = calc(w.parts.low); w.high = calc(w.parts.high);
})();

/* ---------- Formatting ---------- */
const fmt = (x, digits = 4) =>
  Number.isFinite(x) ? Number(x.toPrecision(digits)).toString() : "∞";
const pct = (x, digits = 3) => Number.isFinite(x) ? `${fmt(x * 100, digits)}%` : "∞";
const hrs = min => min / 60;
const hfmt = min => Number.isFinite(min) ? hrs(min).toFixed(2) : "∞";        // queue and cycle time: 2 decimals, in hours
const p1 = x => Number.isFinite(x) ? `${(x * 100).toFixed(1)}%` : "∞";       // utilization, availability, rework: 1 decimal
const wipFmt = x => Number.isFinite(x) ? x.toFixed(2) : "∞";                 // WIP in queue: 2 decimals
const $ = id => document.getElementById(id);
const moneyFmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const money = x => x == null ? "—" : !Number.isFinite(x) ? "∞" : Math.abs(x) < 100 ? `$${x.toFixed(2)}` : moneyFmt.format(x);
const yearsFmt = y => y == null ? "—" : !Number.isFinite(y) ? "Never"
  : y < 1 / 12 ? `${fmt(y * 52.14, 2)} weeks` : y < 1 ? `${fmt(y * 12, 3)} months` : `${fmt(y, 3)} years`;
const ordinal = n => n + (["th", "st", "nd", "rd"][((n % 100) - 20) % 10] || ["th", "st", "nd", "rd"][n % 100] || "th");
const reworkStep = inputs.steps.find(s => s.reworkProb != null);
// The gold dot marks the current inputs on the chart and in its legend.
const WAFER_KEY = `<span class="key-here"></span>`;
// Labels for the ends of each slider and its data-value tick.
const RANGE_FMT = {
  reworkProb: x => `${(x * 100).toFixed(1)}%`,
  m: x => `${x}`,
  availability: x => `${Math.round(x * 100)}%`,
  caSq: x => x.toFixed(1),
};
let currentPage = "explore";
const PAGES = ["explore", "scenarios", "costs", "data", "check"];
let base = null;   // the baseline: SMT2020 data as given, the validated hand-calc run
let state = null;  // slider and cost-box values on the Explore page

/* ---------- Hand calculation (Calculations doc, Litho_FE_98) ---------- */
// Values copied from the hand calc, in minutes. get() pulls the matching value from the code's results.
const HAND_CALC = [
  ["Visit rate, Step 65 (with rework)", "λ<sub>65</sub>", 0.02022241408, "visits/min", r => step(r, 65).lambda],
  ["Visit rate, Step 72", "λ<sub>72</sub>", 0.01987863304, "visits/min", r => step(r, 72).lambda],
  ["Visit rate, Step 68", "λ<sub>68</sub>", 0.01984213351, "visits/min", r => step(r, 68).lambda],
  ["Total arrival rate", "λ", 0.05994318063, "visits/min", r => r.lambda],
  ["Weight, Step 65", "p<sub>65</sub>", 0.33735971079, "", r => step(r, 65).share],
  ["Weight, Step 72", "p<sub>72</sub>", 0.33162459570, "", r => step(r, 72).share],
  ["Weight, Step 68", "p<sub>68</sub>", 0.33101569351, "", r => step(r, 68).share],
  ["Mean processing time", "t̄<sub>0</sub>", 69.01518927, "min/visit", r => r.t0bar],
  ["Second moment", "E[S<sub>0</sub>²]", 5234.23982047, "min²", r => r.secondMoment],
  ["Processing-time variance", "Var(S<sub>0</sub>)", 471.14346982, "min²", r => r.variance],
  ["Processing variability", "c<sub>0</sub>²", 0.09891538, "", r => r.c0Sq],
  ["Sum of downtime ratios", "R", 0.14021558, "", r => r.R],
  ["Availability", "A", 0.87702713, "", r => r.A],
  ["Downtime variability term", "K", 149.38378119, "min", r => r.K],
  ["Effective processing time", "t<sub>e</sub>", 78.69219428, "min/visit", r => r.te],
  ["Effective variability", "c<sub>e</sub>²", 1.76380260, "", r => r.ceSq],
  ["Utilization", "ρ", 0.94341208, "", r => r.rho],
  ["Queue time", "W<sub>q</sub>", 332.94824720, "min", r => r.Wq],
  ["Cycle time (queue + processing)", "CT", 411.64044148, "min", r => r.cycleTime],
];
const step = (r, n) => r.stepSummary.find(s => s.step === n);
// The hand calc rounds to about 8 significant figures, so a relative difference under 1e-7 counts as a match.
const MATCH_TOL = 1e-7;

/* ---------- Chart ---------- */
function niceStep(range) {
  const raw = range / 5, p = 10 ** Math.floor(Math.log10(raw)), n = raw / p;
  return (n < 1.5 ? 1 : n < 3.5 ? 2 : n < 7.5 ? 5 : 10) * p;
}

// A line chart in SVG. series: [{ fn, cls }], points: [{ x, y, cls, label: [line1, line2] }].
function lineChart(o) {
  const W = Math.round(Math.max(320, Math.min(o.width || 720, 900)));
  const narrow = W < 520;
  const H = narrow ? 290 : 350, M = { l: 60, r: 20, t: 40, b: 56 };
  const X = x => M.l + (x - o.xMin) / (o.xMax - o.xMin) * (W - M.l - M.r);

  // Sample each series once; the y range comes from the samples and the points.
  const n = o.samples || 140;
  const sampled = o.series.map(s => {
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const x = o.xMin + (o.xMax - o.xMin) * i / n;
      pts.push([x, s.fn(x)]);
    }
    return { ...s, pts };
  });
  const cap = o.yCapAt != null ? o.yCapAt : Infinity;
  let top = 0;
  sampled.forEach(s => s.pts.forEach(([x, y]) => { if (Number.isFinite(y) && x <= cap) top = Math.max(top, y); }));
  (o.points || []).forEach(p => { if (Number.isFinite(p.y)) top = Math.max(top, p.y * 1.15); });
  if (!(top > 0)) top = 1;
  const step = niceStep(top);
  const yMax = Math.ceil(top / step) * step;
  const Y = y => H - M.b - Math.min(Math.max(y, 0), yMax) / yMax * (H - M.t - M.b);

  const paths = sampled.map(s => {
    const d = [];
    for (const [x, y] of s.pts) {
      if (!Number.isFinite(y) || y > yMax) { d.push([X(x), Y(yMax)]); break; }
      d.push([X(x), Y(y)]);
    }
    return d.length > 1 ? `<path class="${s.cls}" d="M${d.map(p => p.map(v => v.toFixed(1)).join(" ")).join(" L")}"/>` : "";
  }).join("");

  let ticks = "";
  for (let w = 0; w <= yMax + 1e-9; w += step) {
    ticks += `<line class="grid" x1="${M.l}" x2="${W - M.r}" y1="${Y(w)}" y2="${Y(w)}"/>
      <text class="tick" x="${M.l - 10}" y="${Y(w) + 5}" text-anchor="end">${fmt(w, 3)}</text>`;
  }
  for (const x of (narrow && o.xTicksNarrow) ? o.xTicksNarrow : o.xTicks) {
    ticks += `<text class="tick" x="${X(x)}" y="${H - M.b + 24}" text-anchor="middle">${o.xFmt(x)}</text>`;
  }

  const zone = o.zone ? `<rect class="zone" x="${X(o.zone.x0)}" y="${M.t}" width="${X(o.zone.x1) - X(o.zone.x0)}" height="${H - M.t - M.b}"/>
    <text class="zone-label" x="${X(o.zone.x1) - 4}" y="${M.t - 12}" text-anchor="end">${narrow ? o.zone.short : o.zone.label}</text>` : "";

  const dots = (o.points || []).filter(p => Number.isFinite(p.y) && p.x >= o.xMin && p.x <= o.xMax).map(p => {
    const px = X(p.x), py = Y(p.y);
    let label = "";
    if (p.label) {
      const end = px > W * 0.55, tx = px + (end ? -16 : 16);
      const ty = Math.max(M.t + 18, py - 30);
      label = `<text class="here-label" x="${tx}" y="${ty}" text-anchor="${end ? "end" : "start"}">
        ${p.label.map((t, i) => `<tspan x="${tx}" dy="${i ? 20 : 0}">${t}</tspan>`).join("")}</text>`;
    }
    const drop = p.cls === "here" ? `<line class="here-line" x1="${px}" x2="${px}" y1="${py}" y2="${H - M.b}"/>` : "";
    const dot = `<circle class="${p.cls}" cx="${px}" cy="${py}" r="${p.cls === "here" ? 5.5 : 4.5}"/>`;
    return `${drop}${dot}${label}`;
  }).join("");

  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${o.aria}">
    ${zone}${ticks}
    <line class="axis" x1="${M.l}" x2="${W - M.r}" y1="${H - M.b}" y2="${H - M.b}"/>
    <line class="axis" x1="${M.l}" x2="${M.l}" y1="${M.t}" y2="${H - M.b}"/>
    ${paths}${dots}
    <text class="axis-label" x="${(W + M.l) / 2}" y="${H - 10}" text-anchor="middle">${o.xLabel}</text>
    <text class="axis-label" transform="translate(16 ${(H - M.b + M.t) / 2}) rotate(-90)" text-anchor="middle">${o.yLabel}</text>
  </svg>`;
}

/* ---------- Explore (Module 4): sliders and instant results ---------- */
function defaults() {
  return {
    reworkProb: reworkStep ? reworkStep.reworkProb : 0,
    m: inputs.m,
    availability: base.A,
    caSq: inputs.caSq,
    waitCost: inputs.costs.waitingPerLotHour.value,
    stepperCost: inputs.costs.extraStepper.value,
    projectCost: inputs.costs.reworkProject.value,
  };
}
const sliderSettings = (extra = {}) =>
  ({ m: state.m, reworkProb: state.reworkProb, availability: state.availability, caSq: state.caSq, ...extra });
const runWith = extra => Calc.run(Calc.applyWhatIf(inputs, sliderSettings(extra)));
function atDefaults() {
  const d = defaults();
  return state.m === d.m && Math.abs(state.reworkProb - d.reworkProb) < 1e-9 &&
    Math.abs(state.availability - d.availability) < 5e-4 && Math.abs(state.caSq - d.caSq) < 1e-9 &&
    state.waitCost === d.waitCost;
}

function renderExplore() {
  const cur = runWith();
  const changed = !atDefaults();

  $("out-rework").textContent = p1(state.reworkProb);
  $("out-m").textContent = state.m;
  $("out-A").textContent = `${(state.availability * 100).toFixed(1)}%`;
  $("out-ca").textContent = state.caSq.toFixed(2);
  const d = defaults();
  const costHint = (v, dv) => v == null ? "Enter a value" : Math.abs(v - dv) < 1e-9 ? "Baseline" : `Baseline: ${money(dv)}`;
  $("hint-wait").textContent = costHint(state.waitCost, d.waitCost);
  $("hint-stepper").textContent = costHint(state.stepperCost, d.stepperCost);
  $("hint-project").textContent = costHint(state.projectCost, d.projectCost);

  // Decision banner: a status badge plus something the headline numbers don't already say.
  const badge = !cur.stable ? `<span class="label-tag bad">Capacity alert</span>`
    : changed ? `<span class="label-tag">What-if</span>` : `<span class="label-tag">Baseline</span>`;
  let insight;
  if (!cur.stable) {
    insight = `At ${p1(cur.rho)} utilization, ${state.m} stepper${state.m > 1 ? "s" : ""} can’t keep up: the queue grows without limit. Add capacity or raise availability.`;
  } else if (cur.rho > 0.90) {
    const at85 = Calc.sakasegawaWq(state.caSq, cur.ceSq, 0.85, cur.te, state.m);
    insight = `<strong>${(cur.rho * 100 - 90).toFixed(1)} points above</strong> the 75–90% target band: queue time is <strong>${(cur.Wq / at85).toFixed(1)}×</strong> what it would be at 85% utilization.`;
  } else if (cur.rho >= 0.75) {
    insight = `Inside the 75–90% target band: lots spend <strong>${Math.round(cur.Wq / cur.cycleTime * 100)}%</strong> of their cycle time here in queue rather than processing.`;
  } else {
    insight = `Below the 75–90% target band: spare capacity, and lots spend only <strong>${Math.round(cur.Wq / cur.cycleTime * 100)}%</strong> of their cycle time here in queue.`;
  }
  $("answer").innerHTML = `${badge} ${insight}`;

  // Instrument strip: one bar, five readings.
  const was = v => changed ? `<p class="was">baseline ${v}</p>` : "";
  const item = (label, value, unit, wasText, key) =>
    `<div${key ? ' class="key"' : ""}><dt>${label}</dt><dd>${value}${unit ? `<small>${unit}</small>` : ""}</dd>${wasText}</div>`;
  const yearly = Calc.annualWaitCost(cur, state.waitCost);
  const yearlyBase = Calc.annualWaitCost(base, inputs.costs.waitingPerLotHour.value);
  $("readout").innerHTML =
    item("Utilization", p1(cur.rho), "", was(p1(base.rho))) +
    item("Queue time", hfmt(cur.Wq), "h", was(`${hfmt(base.Wq)} h`), true) +
    item("Cycle time", hfmt(cur.cycleTime), "h", was(`${hfmt(base.cycleTime)} h`)) +
    item("WIP in queue", wipFmt(cur.Lq), "lots", was(`${wipFmt(base.Lq)} lots`)) +
    item("Holding cost / yr", money(yearly), "", was(money(yearlyBase)));
  fitReadout();

  // Chart: the curve for these settings, a moving dot, and a hollow dot for the data as given.
  $("chart-meta").textContent = `${inputs.toolGroup} · m = ${state.m} · ${state.m === 1 ? "Kingman G/G/1" : `Sakasegawa G/G/${state.m}`}`;
  const el = $("curve");
  const wait = rho => hrs(Calc.sakasegawaWq(state.caSq, cur.ceSq, rho, cur.te, state.m));
  const points = [];
  if (changed && base.stable) points.push({ x: base.rho, y: hrs(base.Wq), cls: "ghost" });
  if (cur.stable) points.push({ x: cur.rho, y: hrs(cur.Wq), cls: "here",
    label: [changed ? "Your inputs" : "Baseline", `${p1(cur.rho)} · ${hfmt(cur.Wq)} h`] });
  el.innerHTML = (cur.stable ? "" : `<p class="warn">Utilization is ${p1(cur.rho)}. At 100% or more the queue grows without limit, so there is no average queue time.</p>`) +
    lineChart({
      width: el.clientWidth, xMin: 0.3, xMax: 0.99, yCapAt: 0.95,
      xTicks: [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9], xTicksNarrow: [0.3, 0.5, 0.7, 0.9], xFmt: x => `${Math.round(x * 100)}%`,
      xLabel: "Utilization ρ", yLabel: "Queue time Wq (h)",
      zone: { x0: 0.75, x1: 0.90, label: "Target fab operating band (75–90%)", short: "Target 75–90%" },
      series: [{ fn: wait, cls: "line" }], points,
      aria: `Queue time rises sharply as utilization approaches 100 percent. These settings: ${p1(cur.rho)} utilization, ${hfmt(cur.Wq)} hour queue time.`,
    });
  $("chart-legend").innerHTML = `<span class="item">${WAFER_KEY}${changed ? "Your inputs" : "Baseline (SMT2020 data)"}</span>` +
    (changed && base.stable ? `<span class="item"><span class="key-ghost"></span>Baseline</span>` : "");

  // Payback for each fix, starting from these settings. The winner gets a tag, nothing else.
  const target = inputs.scenarios.reworkTarget.value;
  const add = runWith({ m: state.m + inputs.scenarios.addSteppers });
  const eAdd = Calc.fixEconomics(cur, add, state.stepperCost, state.waitCost, 5, inputs.costs.extraStepper.annualOperatingCost || 0);
  const why = { "current-unstable": "Over capacity now", "fix-unstable": "Still over capacity",
    "no-wait-cost": "Enter the holding cost rate", "no-fix-cost": "Enter the cost of the fix" };
  const cut = target == null ? null : runWith({ reworkProb: target });
  const eCut = cut && Calc.fixEconomics(cur, cut, state.projectCost, state.waitCost, 5, inputs.costs.reworkProject.annualOperatingCost || 0);
  const bestFix = eCut && eAdd.status === "ok" && eCut.status === "ok"
    ? (eAdd.paybackYears <= eCut.paybackYears ? "add" : "cut") : null;
  const line = (key, title, change, e, extra) => `
    <div class="payback-row">
      <div><strong>${title}</strong>${bestFix === key ? ` <span class="label-tag">Pays back sooner</span>` : ""}<span>${change}</span></div>
      <div class="payback-value">${e.status === "ok" ? yearsFmt(e.paybackYears) : `<span class="muted">${why[e.status]}</span>`}</div>
      ${e.status === "ok" ? `<p class="muted">Saves ${money(e.annualSavings)}/yr${extra}</p>` : ""}
    </div>`;
  let html = line("add", "Add a stepper", `${state.m} → ${state.m + inputs.scenarios.addSteppers} · ${money(state.stepperCost)}`, eAdd,
    add.stable ? ` · queue time ${hfmt(add.Wq)} h` : "");
  if (target == null) {
    html += `<div class="payback-row"><div><strong>Cut rework</strong><span>Target rework rate not configured</span></div>
      <div class="payback-value"><span class="muted">—</span></div></div>`;
  } else {
    html += line("cut", "Cut rework", `${p1(state.reworkProb)} → ${p1(target)} · ${money(state.projectCost)}`, eCut,
      cut.stable ? ` · queue time ${hfmt(cut.Wq)} h` : "");
  }
  $("paybacks").innerHTML = `<div class="payback-list">${html}</div>`;

  const chain = [
    ["Arrival rate", "λ = Σ r<sub>i</sub> · E[N<sub>i</sub>]", `${cur.lambdaPerHour.toFixed(3)} /h`],
    ["Job mix", "c<sub>0</sub>² = Var(S<sub>0</sub>) / t̄<sub>0</sub>²", cur.c0Sq.toFixed(3)],
    ["Availability", "A = 1 / (1 + Σ m<sub>r</sub>/m<sub>f</sub>)", p1(cur.A)],
    ["Effective time", "t<sub>e</sub> = t̄<sub>0</sub> / A", `${cur.te.toFixed(2)} min`],
    ["Effective SCV", "c<sub>e</sub>² = c<sub>0</sub>² + A²K / t̄<sub>0</sub>", cur.ceSq.toFixed(3)],
    ["Utilization", `ρ = λ t<sub>e</sub> / m, m = ${state.m}`, p1(cur.rho)],
    ["Queue time", "W<sub>q</sub> = ½(c<sub>a</sub>² + c<sub>e</sub>²) · ρ<sup>√(2(m+1))−1</sup> / m(1−ρ) · t<sub>e</sub>", `${hfmt(cur.Wq)} h`],
    ["WIP in queue", "L<sub>q</sub> = λ W<sub>q</sub>", `${wipFmt(cur.Lq)} lots`],
  ];
  $("route").innerHTML = chain.map(([name, eq, v]) =>
    `<li><span class="chain-name">${name}</span><span class="eq">${eq}</span><span class="val">${v}</span></li>`).join("");
}

// One status line under the tabs, shared by every page.
function renderStatus() {
  const fixedPage = currentPage === "data" || currentPage === "check";
  const d = defaults(), diffs = [];
  if (state.m !== d.m) diffs.push(`${state.m} steppers`);
  if (Math.abs(state.reworkProb - d.reworkProb) > 1e-9) diffs.push(`rework ${p1(state.reworkProb)}`);
  if (Math.abs(state.availability - d.availability) >= 5e-4) diffs.push(`A ${p1(state.availability)}`);
  if (Math.abs(state.caSq - d.caSq) > 1e-9) diffs.push(`cₐ² ${state.caSq.toFixed(2)}`);
  if (state.waitCost !== d.waitCost) diffs.push(`holding cost rate ${money(state.waitCost)}/lot-h`);
  if (state.stepperCost !== d.stepperCost) diffs.push(`stepper ${money(state.stepperCost)}`);
  if (state.projectCost !== d.projectCost) diffs.push(`project ${money(state.projectCost)}`);
  const modified = diffs.length > 0 && !fixedPage;
  $("status-text").innerHTML = fixedPage
    ? `<span class="status-key">Inputs</span> Baseline (SMT2020 data) · Explore inputs don’t apply on this tab`
    : modified
      ? `<span class="status-key modified">Modified</span> ${diffs.join(" · ")}`
      : `<span class="status-key">Inputs</span> Baseline (SMT2020 data)`;
  $("status-reset").hidden = !modified;
}

// Shrinks the headline numbers together, only as far as the longest one on screen needs to fit its cell.
function fitReadout() {
  const box = $("readout"), dds = [...box.querySelectorAll("dd")];
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
  let size = 2.2 * rem;
  const min = 1.1 * rem;
  box.style.setProperty("--readout-size", `${size}px`);
  while (size > min && dds.some(d => d.scrollWidth > d.clientWidth + 1)) {
    size -= 1;
    box.style.setProperty("--readout-size", `${size}px`);
  }
}

function syncControls() {
  document.querySelectorAll("[data-key]").forEach(el => {
    const v = state[el.dataset.key];
    const scale = Number(el.dataset.scale || 1);
    el.value = v == null ? "" : (el.type === "number" ? Number((v / scale).toFixed(scale > 1 ? 1 : 2)) : v);
    el.removeAttribute("aria-invalid");
  });
  // Each slider gets its min and max at the ends and a tick at the SMT2020 data value.
  const d = defaults();
  document.querySelectorAll('input[type="range"]').forEach(el => {
    let sc = el.nextElementSibling;
    if (!sc || !sc.classList.contains("range-scale")) {
      sc = document.createElement("div");
      sc.className = "range-scale";
      sc.setAttribute("aria-hidden", "true");
      el.after(sc);
    }
    const key = el.dataset.key, min = Number(el.min), max = Number(el.max);
    const f = RANGE_FMT[key] || (x => x);
    const p = Math.min(1, Math.max(0, (d[key] - min) / (max - min)));
    sc.innerHTML = `<span>${f(min)}</span><span class="range-mark" style="left: calc(${(p * 100).toFixed(2)}% + ${(6 - 12 * p).toFixed(2)}px)" title="Data: ${f(d[key])}"></span><span>${f(max)}</span>`;
  });
  $("hint-A").textContent = "Scales breakdown and PM frequency";
}

function onInput(e) {
  const el = e.target, key = el.dataset.key;
  if (el.type === "range") {
    state[key] = key === "m" ? parseInt(el.value, 10) : Number(el.value);
  } else {
    const v = el.value.trim(), n = Number(v);
    const ok = v !== "" && Number.isFinite(n) && n >= 0;
    el.toggleAttribute("aria-invalid", v !== "" && !ok);
    state[key] = ok ? n * Number(el.dataset.scale || 1) : null;
  }
  safeRenderExplore();
}

function safeRenderExplore() {
  try { renderExplore(); renderScenarios(); renderCosts(); renderStatus(); }
  catch (err) { $("answer").innerHTML = `<span class="warn-text">These settings can’t be calculated:</span> ${err.message}`; }
}

/* ---------- Data and Checks (baseline only; sliders don't change these) ---------- */
function placeholderItems() {
  const items = [];
  for (const [product, lotTypes] of Object.entries(inputs.products)) {
    for (const lt of lotTypes) {
      const who = `${product} ${lt.lotType ?? ""}`.trim();
      items.push([`${who}: release interval`, lt.releaseIntervalMin, "min", lt.source]);
      items.push([`${who}: wafers per lot`, lt.wafersPerLot, "wafers", lt.source]);
    }
  }
  for (const d of inputs.interruptions) {
    if (d.kind === "breakdown") {
      items.push([`${d.name}: mean time to failure`, d.mfMin, "min", d.source]);
      items.push([`${d.name}: mean time to repair`, d.mrMin, "min", d.source]);
    } else {
      items.push([`${d.name}: how often`, d.mfMin, "min", d.source]);
      items.push([`${d.name}: how long`, d.mrMin, "min", d.source]);
    }
  }
  for (const c of Object.values(inputs.costs || {})) items.push([`${c.label} (baseline)`, c.value, c.unit, c.source]);
  items.push(["Target rework rate, 072_Litho", inputs.scenarios.reworkTarget.value, "%", inputs.scenarios.reworkTarget.source]);
  items.push(["Yearly operating cost of the extra stepper", inputs.costs.extraStepper.annualOperatingCost, "$ per year",
    inputs.costs.extraStepper.annualOperatingCost != null ? "Team" : ""]);
  items.push(["Yearly operating cost of the rework project", inputs.costs.reworkProject.annualOperatingCost, "$ per year",
    inputs.costs.reworkProject.annualOperatingCost != null ? "Team" : ""]);
  return items;
}

// Data tab values in the same format they have everywhere else: money as money, rates as percents.
function inputValueFmt(v, unit) {
  if (v == null) return "—";
  if (unit.startsWith("$")) return money(v);
  if (unit === "%") return p1(v);
  return v.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function renderData() {
  $("steps").innerHTML = `
    <table>
      <thead><tr><th>Product</th><th>Step</th><th>Lot type</th><th class="num">Release every (min)</th><th class="num">Wafers</th>
        <th class="num">Lot time ± SD (min)</th><th class="num">Rework</th><th class="num">Visits per h</th><th class="num">Share</th></tr></thead>
      <tbody>${base.steps.map(s => `
        <tr><td>${s.product}</td><td>${s.step ?? ""} ${s.name ?? ""}</td><td>${s.lotType ?? ""}</td>
          <td class="num">${s.releaseIntervalMin.toLocaleString("en-US", { maximumFractionDigits: 2 })}</td><td class="num">${s.wafersPerLot}</td>
          <td class="num">${s.tLot.toFixed(1)} ± ${Math.sqrt(s.varLot).toFixed(2)}</td><td class="num">${p1(s.reworkProb ?? 0)}</td>
          <td class="num">${(s.lambda * 60).toFixed(3)}</td><td class="num">${p1(s.share)}</td></tr>`).join("")}
      </tbody>
    </table>`;

  $("downtime").innerHTML = `
    <table>
      <thead><tr><th>Source</th><th class="num">Every (min)</th><th class="num">Lasts (min)</th>
        <th class="num">Share of time down</th><th class="num">c<sub>r</sub>²</th><th class="num">K<sub>j</sub> (min)</th></tr></thead>
      <tbody>${base.interruptions.map(d => `
        <tr><td>${d.name}</td><td class="num">${d.mfMin.toLocaleString("en-US", { maximumFractionDigits: 2 })}</td><td class="num">${d.mrMin.toLocaleString("en-US", { maximumFractionDigits: 2 })}</td>
          <td class="num">${p1(d.ratio / (1 + base.R))}</td><td class="num">${d.crSq.toFixed(3)}</td><td class="num">${d.K.toFixed(2)}</td></tr>`).join("")}
      </tbody>
    </table>`;

  const items = placeholderItems();
  const missing = items.filter(([, v, , src]) => v == null || !src).length;
  $("placeholders").innerHTML = `
    <p>${missing ? `${missing} of ${items.length} items still need a value or a source.` : "Every item has a value and a source."}</p>
    <table>
      <thead><tr><th>Item</th><th class="num">Value</th><th>Unit</th><th>Source</th><th>Status</th></tr></thead>
      <tbody>${items.map(([label, v, unit, src]) => {
        const ok = v != null && !!src;
        return `<tr${ok ? "" : ' class="missing"'}><td>${label}</td><td class="num">${inputValueFmt(v, unit)}</td><td>${unit}</td>
          <td class="src">${src || "—"}</td><td class="${ok ? "pass" : "fail"}">${ok ? "Filled" : "Missing"}</td></tr>`;
      }).join("")}
      </tbody>
    </table>`;

}

/* ---------- Costs (Phase 2: holding cost of the queue) ---------- */
// Costs follows the Explore settings: WIP in queue from the sliders, holding cost rate from the cost field.
// The assumptions table always shows the sourced baselines.
function renderCosts() {
  const r = runWith();
  const wait = inputs.costs.waitingPerLotHour;
  const c$ = state.waitCost;                       // holding cost rate in use ($/lot-h, cost box)
  const isBaseline = c$ != null && Math.abs(c$ - wait.value) < 1e-9;

  $("cost-answer").innerHTML = !r.stable
    ? `Over capacity: the queue and its cost grow without limit.`
    : c$ == null
      ? `WIP in queue: <strong>${wipFmt(r.Lq)} lots</strong>. Enter a holding cost rate on <a href="#explore">Explore</a>.`
      : `Holding cost: <strong>${money(Calc.annualWaitCost(r, c$))}/yr</strong>, from ${wipFmt(r.Lq)} lots of WIP in queue at a holding cost rate of ${money(c$)}/lot-h.`;

  $("cost-worked").innerHTML = r.stable && c$ != null ? `
    <ol class="worked-steps">
      <li><span>WIP in queue (Little’s Law)</span>
        <code>L<sub>q</sub> = λ × W<sub>q</sub> = ${r.lambdaPerHour.toFixed(3)} /h × ${hfmt(r.Wq)} h = ${wipFmt(r.Lq)} lots</code></li>
      <li><span>Holding cost rate</span>
        <code>${isBaseline
          ? `25 wafers × ${money(wait.parts.base.waferCost)} × ${Math.round(wait.parts.base.carryingRate * 100)}% ÷ 8,760 h = ${money(c$)}/lot-h (baseline)`
          : `${money(c$)}/lot-h, entered on Explore (baseline: ${money(wait.value)}/lot-h)`}</code></li>
      <li><span>Holding cost / yr</span>
        <code>${wipFmt(r.Lq)} lots × ${money(c$)}/lot-h × ${Calc.HOURS_PER_YEAR.toLocaleString("en-US")} h = ${money(Calc.annualWaitCost(r, c$))}</code></li>
    </ol>` : "";

  const cases = [
    ["28nm wafer, 20% holding rate", wait.low],
    ["28nm wafer, 25% holding rate (baseline)", wait.value],
    ["28nm wafer, 30% holding rate", Calc.carryingCostPerLotHour(25, wait.parts.low.waferCost, wait.parts.high.carryingRate)],
    ["Advanced wafer, 20% holding rate", Calc.carryingCostPerLotHour(25, wait.parts.high.waferCost, wait.parts.low.carryingRate)],
    ["Advanced wafer, 30% holding rate", wait.high],
  ];
  if (c$ != null && !cases.some(([, v]) => Math.abs(v - c$) < 0.005)) cases.push(["Your value on Explore", c$]);
  cases.sort((x, y) => x[1] - y[1]);
  $("cost-range").innerHTML = `
    <table>
      <thead><tr><th>Case</th><th class="num">Holding cost rate</th><th class="num">Holding cost / yr</th></tr></thead>
      <tbody>${cases.map(([label, c]) => {
        const inUse = c$ != null && Math.abs(c - c$) < 0.005;
        return `<tr${inUse ? ' class="in-use"' : ""}><td>${label}${inUse ? ' <span class="label-tag in-use-label">in use</span>' : ""}</td><td class="num">${money(c)}/lot-h</td><td class="num">${money(Calc.annualWaitCost(r, c))}</td></tr>`;
      }).join("")}</tbody>
    </table>`;

  const c = inputs.costs;
  const rangeTxt = x => `${money(x.low)} – ${money(x.high)}`;
  $("cost-assumptions").innerHTML = `
    <table>
      <thead><tr><th>Assumption</th><th class="num">Base</th><th class="num">Range</th><th>Basis</th></tr></thead>
      <tbody>
        ${[c.waitingPerLotHour, c.extraStepper, c.reworkProject].map(x =>
          `<tr><td>${x.label} <span class="muted">(${x.unit})</span></td><td class="num">${money(x.value)}</td><td class="num">${rangeTxt(x)}</td><td class="src">${x.source}</td></tr>`).join("")}
        <tr><td>Hours per year</td><td class="num">${Calc.HOURS_PER_YEAR.toLocaleString("en-US")}</td><td class="num">—</td><td class="src">The SMT2020 fab runs around the clock (H = 365 × 24 in the Detailed Calculations).</td></tr>
      </tbody>
    </table>`;
}

/* ---------- Scenarios (Module 3): one comparison table ---------- */

// Scenarios start from the Explore settings (sliders and cost boxes). At the defaults, the
// current state is the validated hand calculation.
function renderScenarios() {
  const target = inputs.scenarios.reworkTarget.value;
  const mNew = state.m + inputs.scenarios.addSteppers;
  const stepName = reworkStep ? reworkStep.name : "the rework step";
  const fromRate = state.reworkProb;
  const atTarget = target != null && fromRate <= target + 1e-12;

  const list = [
    { key: "current", title: "No change", sub: `${state.m} steppers`, whatIf: sliderSettings() },
    { key: "add", title: "Add a stepper", sub: `${state.m} → ${mNew} steppers`, whatIf: sliderSettings({ m: mNew }),
      cost: state.stepperCost, op: inputs.costs.extraStepper.annualOperatingCost },
  ];
  if (target != null) list.push({ key: "cut", title: "Cut rework", sub: `${stepName} ${p1(fromRate)} → ${p1(target)}`,
    whatIf: sliderSettings({ reworkProb: target }), cost: state.projectCost, op: inputs.costs.reworkProject.annualOperatingCost });
  const cols = Calc.runScenarios(inputs, list);
  const cur = cols[0].result;
  for (const c of cols.slice(1)) {
    c.econ = (c.key === "cut" && atTarget) ? { status: "at-target" } : Calc.fixEconomics(cur, c.result, c.cost, state.waitCost, 5, c.op || 0);
  }
  if (target == null) cols.push({ key: "cut", title: "Cut rework", sub: "Target rework rate not configured", pending: true });
  const fixes = cols.filter(c => c.econ && c.econ.status === "ok");
  const best = fixes.length === 2 ? fixes.reduce((x, y) => (x.econ.paybackYears <= y.econ.paybackYears ? x : y)).key : null;

  // Table: metrics as rows, scenarios as columns, change vs. current under each fix value.
  const minus = s => s.replace("-", "−");
  const rel = (v, c) => (Number.isFinite(v) && Number.isFinite(c) && c !== 0) ? minus(`${v >= c ? "+" : ""}${Math.round((v / c - 1) * 100)}%`) : "";
  const why = { "current-unstable": "Current over capacity", "fix-unstable": "Still over capacity",
    "no-wait-cost": "Enter holding cost rate", "no-fix-cost": "Enter fix cost", "at-target": "Already at target" };
  const yearly = c => Calc.annualWaitCost(c.result, state.waitCost);
  const rows = [
    ["Rework rate", c => p1(c.result.steps.find(s => s.reworkProb != null)?.reworkProb ?? 0), null],
    ["Utilization", c => p1(c.result.rho), c => minus(`${((c.result.rho - cur.rho) * 100) >= 0 ? "+" : ""}${((c.result.rho - cur.rho) * 100).toFixed(1)} pts`)],
    ["Queue time", c => `${hfmt(c.result.Wq)} h`, c => rel(c.result.Wq, cur.Wq)],
    ["WIP in queue", c => `${wipFmt(c.result.Lq)} lots`, c => rel(c.result.Lq, cur.Lq)],
    ["Holding cost / yr", c => money(yearly(c)), c => rel(yearly(c), yearly(cols[0]))],
    ["Savings / yr", c => c.econ ? (c.econ.status === "ok" ? money(c.econ.annualSavings) : "—") : "", null],
    ["One-time cost", c => c.econ ? money(c.cost) : "", null],
    [inputs.costs.extraStepper.annualOperatingCost == null ? "Payback, pre-opex" : "Payback",
      c => !c.econ ? "" : c.econ.status === "ok" ? yearsFmt(c.econ.paybackYears) : `<span class="reason">${why[c.econ.status]}</span>`, null],
  ];
  const cell = (c, f, df) => {
    if (c.pending) return `<td class="num muted">—</td>`;
    const v = f(c), dlt = df && c.key !== "current" ? df(c) : "";
    const tip = v && c.econ?.status === "ok" && f === rows[rows.length - 1][1]
      ? ` title="${money(c.cost)} ÷ ${money(c.econ.annualSavings)}/yr"` : "";
    return `<td class="num"${tip}>${v}${dlt ? `<span class="delta">${dlt}</span>` : ""}</td>`;
  };
  $("scenario-cards").innerHTML = `
    <table class="compare">
      <thead><tr><th>Metric</th>${cols.map(c => `<th class="num">${c.title}${best === c.key ? ` <span class="label-tag">Pays back sooner</span>` : ""}<span class="th-sub">${c.sub}</span></th>`).join("")}</tr></thead>
      <tbody>${rows.map(([label, f, df]) => `<tr><td>${label}</td>${cols.map(c => cell(c, f, df)).join("")}</tr>`).join("")}</tbody>
    </table>`;
  $("scenario-meta").textContent = `${inputs.toolGroup} · holding cost rate ${money(state.waitCost)}/lot-h`;

  // Two-line conclusion above the table, then the key limits in one line.
  const add = cols.find(c => c.key === "add"), cutC = cols.find(c => c.key === "cut");
  const lines = [];
  if (!cur.stable) {
    lines.push(`${state.m} steppers at ${p1(cur.rho)} utilization: over capacity. ${add.result.stable ? `A ${ordinal(mNew)} stepper brings it back under.` : "One more stepper isn’t enough."}`);
  } else {
    lines.push(`A ${ordinal(mNew)} stepper cuts queue time ${rel(add.result.Wq, cur.Wq).replace("−", "")} (${hfmt(cur.Wq)} → <strong>${hfmt(add.result.Wq)} h</strong>)${add.econ.status === "ok" ? ` and pays back in <strong>${yearsFmt(add.econ.paybackYears)}</strong>` : ""}.`);
    if (cutC?.pending) lines.push("Rework scenario: target rework rate not configured.");
    else if (atTarget) lines.push(`Rework is already at the ${p1(target)} target.`);
    else if (cutC) lines.push(`Cutting rework to ${p1(target)} only reaches ${hfmt(cutC.result.Wq)} h${cutC.econ.status !== "ok" ? ""
      : best === "cut" ? `, but pays back sooner: <strong>${yearsFmt(cutC.econ.paybackYears)}</strong>`
      : ` and takes <strong>${yearsFmt(cutC.econ.paybackYears)}</strong> to pay back`}.`);
  }
  const opexMissing = inputs.costs.extraStepper.annualOperatingCost == null || inputs.costs.reworkProject.annualOperatingCost == null;
  $("scenario-summary").innerHTML = lines.map(l => `<p>${l}</p>`).join("") +
    `<p class="muted small">Limits: holding cost only, so lost output isn’t counted${opexMissing ? "; paybacks are pre-opex until operating costs are provided" : ""}. <a href="#check">All assumptions</a></p>`;
}

/* ---------- Validation: sanity checks against theory, and the model's limits (baseline) ---------- */
const LIMITS = [
  "Arrival variability cₐ² = 1 is assumed, not measured. It has a large effect on queue time.",
  "Scheduled PMs are treated as random interruptions; the real PM calendar is not modeled.",
  "Availability uses A = 1/(1 + Σ mᵣ/m_f) = 87.7%; multiplying PM and breakdown availability gives about 86.9%.",
  "Hot-lot priority and lot-to-lens restrictions are not modeled; the tool gives average queue times.",
  "Batching and setups are not modeled: lithography processes one lot at a time, and the dataset has no setup times.",
  "Sakasegawa is an approximation, most accurate at high utilization. Next step: validate against an SMT2020 simulation run.",
  "Holding cost only: lost output at a near-bottleneck is not included, so the stepper’s value is understated.",
  "Yearly operating costs for both fixes are still pending, so paybacks are pre-opex.",
  "Rework only returns lots to Step 65, so cutting it changes this tool group’s load very little.",
];

function renderValidationExtras() {
  const r = base, m = inputs.m;
  const add = Calc.run(Calc.applyWhatIf(inputs, { m: m + 1 }));
  const V = (inputs.caSq + r.ceSq) / 2;
  const alpha = Math.sqrt(2 * (m + 1)) - 1;
  const U = r.rho ** alpha / (m * (1 - r.rho));
  const markov = Calc.sakasegawaWq(1, 1, r.rho, r.te, m);
  const kingmanOk = Math.abs(Calc.sakasegawaWq(1.3, 0.8, 0.7, 50, 1) - (1.05 * (0.7 / 0.3) * 50)) < 1e-9;
  const checks = [
    ["Stable: ρ < 1", p1(r.rho), r.rho < 1],
    ["VUT adds up: V × U × tₑ = Wq", `${V.toFixed(3)} × ${U.toFixed(3)} × ${r.te.toFixed(2)} min = ${(V * U * r.te).toFixed(2)} min`, Math.abs(V * U * r.te - r.Wq) < 1e-6],
    ["Little’s Law: Lq ÷ λ = Wq", `${(r.Lq / r.lambda).toFixed(2)} min`, Math.abs(r.Lq / r.lambda - r.Wq) < 1e-6],
    ["Downtime only adds variability: cₑ² ≥ c₀²", `${r.ceSq.toFixed(3)} ≥ ${r.c0Sq.toFixed(3)}`, r.ceSq >= r.c0Sq],
    ["Sakasegawa = Kingman at m = 1", kingmanOk ? "Equal" : "Different", kingmanOk],
    ["More capacity, same work: a 6th stepper scales ρ by 5/6", `${p1(r.rho)} → ${p1(add.rho)}`, Math.abs(add.rho - r.rho * m / (m + 1)) < 1e-9],
    ["Variability matters: queue time vs. an M/M/5 assumption (V = 1)", `${hfmt(r.Wq)} h vs ${hfmt(markov)} h (+${Math.round((r.Wq / markov - 1) * 100)}%)`, r.Wq > markov],
  ];
  $("ov-checks").innerHTML = `<table><thead><tr><th>Check</th><th>Result</th><th></th></tr></thead><tbody>${
    checks.map(([c, v, ok]) => `<tr><td class="wrap">${c}</td><td class="wrap">${v}</td><td class="${ok ? "pass" : "fail"}">${ok ? "Pass" : "Fail"}</td></tr>`).join("")
  }</tbody></table>`;
  $("ov-limits").innerHTML = LIMITS.map(l => `<li>${l}</li>`).join("");
}

/* ---------- Check against the hand calculation ---------- */
function renderCheck() {
  const rows = HAND_CALC.map(([label, sym, hand, unit, get]) => {
    const site = get(base);
    const rel = Math.abs(site - hand) / Math.abs(hand);
    return { label, sym, hand, unit, site, rel, ok: rel < MATCH_TOL };
  });
  const matched = rows.filter(x => x.ok).length;
  $("check-summary").innerHTML = matched === rows.length
    ? `<strong>All ${rows.length} values match the hand calculation.</strong>`
    : `<span class="warn-text">${rows.length - matched} of ${rows.length} values don’t match the hand calculation.</span>`;
  $("comparison").innerHTML = `
    <table>
      <thead><tr><th>Value</th><th>Symbol</th><th class="num">Hand calc</th><th class="num">Site</th><th class="num">Difference</th><th>Unit</th><th>Match</th></tr></thead>
      <tbody>${rows.map(x => `
        <tr${x.ok ? "" : ' class="missing"'}><td>${x.label}</td><td class="sym">${x.sym}</td>
          <td class="num">${x.hand}</td><td class="num">${fmt(x.site, 11)}</td>
          <td class="num">${x.rel === 0 ? "0" : `${x.rel.toExponential(1)}`}</td><td>${x.unit}</td>
          <td><span class="label-tag ${x.ok ? "ok" : "bad"}">${x.ok ? "Yes" : "No"}</span></td></tr>`).join("")}
      </tbody>
    </table>
    <p class="muted">Difference is relative: |site − hand calc| ÷ hand calc. The hand calc is rounded to about 8 significant figures, so anything under 1e-7 counts as a match.
    WIP in queue (L<sub>q</sub> = λ × W<sub>q</sub> = ${wipFmt(base.Lq)} lots) comes from Little’s Law and isn’t in the hand calc.</p>`;
}

/* ---------- Pages ---------- */
function showPage() {
  const name = location.hash.slice(1);
  const page = PAGES.includes(name) ? name : "explore";
  currentPage = page;
  PAGES.forEach(p => { $(`page-${p}`).hidden = p !== page; });
  if (state) renderStatus();
  document.querySelectorAll(".tabs a").forEach(a => {
    if (a.dataset.page === page) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  if (base && page === "explore") safeRenderExplore(); // the chart sizes itself to the visible page
}

let resizeTimer;
window.addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => base && safeRenderExplore(), 150); });
window.addEventListener("hashchange", () => { showPage(); window.scrollTo(0, 0); });

document.addEventListener("DOMContentLoaded", () => {
  try {
    base = Calc.run(inputs);
  } catch (err) {
    $("answer").innerHTML = `<span class="warn-text">The inputs in js/app.js need fixing:</span>`;
    $("readout").innerHTML = `<pre>${err.message}</pre>`;
    showPage();
    return;
  }
  renderData();
  renderCheck();
  renderValidationExtras();

  state = defaults();
  syncControls();
  document.querySelectorAll("[data-key]").forEach(el => el.addEventListener("input", onInput));
  const resetAll = () => { state = defaults(); syncControls(); safeRenderExplore(); };
  $("reset").addEventListener("click", resetAll);
  $("status-reset").addEventListener("click", resetAll);
  safeRenderExplore();   // fills Explore and Scenarios, whichever tab the page opens on
  // Refit the headline numbers when the strip changes size (window resize, browser zoom) and once the fonts load.
  if (window.ResizeObserver) {
    let raf = 0;
    new ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(fitReadout); }).observe($("readout"));
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitReadout);

  showPage();
  if (typeof runSelfChecks === "function") runSelfChecks();
});
