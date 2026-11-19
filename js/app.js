/*
  app.js — holds the inputs, runs the capacity (Phase 1) and financial (Phase 2) calculations,
  and shows the results (pages: Results, Costs, Data, Check against hand calc).
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
      label: "Cost of waiting", unit: "$ per lot-hour",
      // Derived, not published: wafers per lot x wafer cost x annual carrying rate / 8,760 h.
      // value, low and high ($ per lot-hour) are calculated from these parts when the page loads.
      parts: {
        base: { waferCost: 3000,  carryingRate: 0.25 },  // 28nm wafer [7], middle of the 20–30% rule of thumb [9]
        low:  { waferCost: 3000,  carryingRate: 0.20 },  // 28nm, 20%  -> $1.71
        high: { waferCost: 17000, carryingRate: 0.30 },  // advanced-node wafer [8], 30% -> $14.55
      },
      source: "Derived: 25 wafers × wafer cost ($3,000 at 28nm [7]; $17,000 advanced [8]) × 20–30% carrying rate [9], [10] ÷ 8,760 h",
    },
    // The next two are used for payback and ROI once scenarios are added (later module).
    extraStepper: {
      label: "Cost of an extra stepper", unit: "$ per tool",
      value: 14e6, low: 7e6, high: 34e6,  // KrF; i-line; dry ArF [1]. Tool speed fits these older classes.
      source: "Industry estimates [1]: i-line ~$7M, KrF ~$14M, dry ArF ~$34M. Excludes installation and qualification.",
    },
    reworkProject: {
      label: "Cost of a rework-reduction project", unit: "$ per project",
      value: 62500, low: 50000, high: 75000,  // Six Sigma worked examples [13]; $2–5M if a new resist is needed [17]
      source: "Illustrative Six Sigma examples, $50K–$75K [13]. A new resist would cost $2M–$5M [17].",
    },
  },
};

/* ---------- Derived cost values ---------- */
// The cost of waiting is calculated from wafer cost and carrying rate, so it is filled in here.
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
const hfmt = min => Number.isFinite(min) ? fmt(hrs(min), 3) : "∞";
const $ = id => document.getElementById(id);
const moneyFmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const money = x => x == null ? "—" : !Number.isFinite(x) ? "∞" : Math.abs(x) < 100 ? `$${x.toFixed(2)}` : moneyFmt.format(x);
const PAGES = ["results", "costs", "data", "check"];
let base = null;

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
  ["Average wait in queue", "W<sub>q</sub>", 332.94824720, "min", r => r.Wq],
  ["Time at tool group (wait + processing)", "CT", 411.64044148, "min", r => r.cycleTime],
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
    return `${drop}<circle class="${p.cls}" cx="${px}" cy="${py}" r="${p.cls === "here" ? 9 : 7}"/>${label}`;
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

/* ---------- Results ---------- */
function renderResults() {
  const r = base;
  $("answer").innerHTML = r.stable
    ? `At ${inputs.toolGroup}, a lot waits about <strong>${hfmt(r.Wq)} hours</strong> for one of the ${inputs.m} steppers, which are busy <strong>${pct(r.rho)}</strong> of the time. With processing, a visit takes ${hfmt(r.cycleTime)} hours.`
    : `The ${inputs.m} steppers would need to be ${pct(r.rho)} busy, which isn’t possible, so the line would grow without limit.`;

  const item = (label, value, unit, key) =>
    `<div${key ? ' class="key"' : ""}><dt>${label}</dt><dd>${value}${unit ? ` <small>${unit}</small>` : ""}</dd></div>`;
  $("readout").innerHTML =
    item("Utilization", pct(r.rho), "") +
    item("Wait in queue", hfmt(r.Wq), "hours", true) +
    item("Time at tool group", hfmt(r.cycleTime), "hours") +
    item("Lots waiting", fmt(r.Lq, 3), "lots") +
    item("Weekly delay cost", money(Calc.weeklyWaitCost(r, inputs.costs.waitingPerLotHour.value)), "");

  const el = $("curve");
  const wait = rho => hrs(Calc.sakasegawaWq(inputs.caSq, r.ceSq, rho, r.te, inputs.m));
  el.innerHTML = (r.stable ? "" : `<p class="warn">Utilization is ${pct(r.rho)}. At 100% or more the queue grows without limit.</p>`) +
    lineChart({
      width: el.clientWidth, xMin: 0.3, xMax: 0.99, yCapAt: 0.95,
      xTicks: [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9], xTicksNarrow: [0.3, 0.5, 0.7, 0.9], xFmt: x => `${Math.round(x * 100)}%`,
      xLabel: "Utilization ρ", yLabel: "Average wait (hours)",
      series: [{ fn: wait, cls: "line" }],
      points: r.stable ? [{ x: r.rho, y: hrs(r.Wq), cls: "here", label: [inputs.toolGroup, `${pct(r.rho)} busy, ${hfmt(r.Wq)} h wait`] }] : [],
      aria: `Average wait rises sharply as utilization approaches 100 percent. ${inputs.toolGroup} is at ${pct(r.rho)} utilization with a ${hfmt(r.Wq)} hour wait.`,
    });

  const stations = [
    ["Arrivals", `λ = ${fmt(r.lambdaPerHour, 3)} per h`, "Lot releases of every product and lot type, plus repeat visits from rework at Step 65."],
    ["Job mix", `c₀² = ${fmt(r.c0Sq, 3)}`, "Steps take different times per lot (25 wafers plus load and unload), which adds variability."],
    ["Downtime", `A = ${pct(r.A)}, cₑ² = ${fmt(r.ceSq, 3)}`, "Breakdowns and weekly, monthly and quarterly maintenance stretch each job and make processing less predictable."],
    ["Utilization", `ρ = ${pct(r.rho)}`, `The share of time each of the ${inputs.m} steppers is busy: λ × tₑ ÷ ${inputs.m}.`],
    ["Wait", `W<sub>q</sub> = ${hfmt(r.Wq)} h`, "Variability × utilization × processing time (Sakasegawa’s G/G/m version of Kingman’s equation)."],
  ];
  $("route").innerHTML = stations.map(([t, v, d]) => `<li><h3>${t} <span>${v}</span></h3><p>${d}</p></li>`).join("");
}

/* ---------- Data and Checks (data as given; sliders don't change these) ---------- */
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
  for (const c of Object.values(inputs.costs || {})) items.push([`${c.label} (base)`, c.value, c.unit, c.source]);
  return items;
}

function renderData() {
  $("steps").innerHTML = `
    <table>
      <thead><tr><th>Product</th><th>Step</th><th>Lot type</th><th class="num">Release every (min)</th><th class="num">Wafers</th>
        <th class="num">Lot time ± SD (min)</th><th class="num">Rework</th><th class="num">Visits per h</th><th class="num">Share</th></tr></thead>
      <tbody>${base.steps.map(s => `
        <tr><td>${s.product}</td><td>${s.step ?? ""} ${s.name ?? ""}</td><td>${s.lotType ?? ""}</td>
          <td class="num">${fmt(s.releaseIntervalMin, 7)}</td><td class="num">${s.wafersPerLot}</td>
          <td class="num">${fmt(s.tLot)} ± ${fmt(Math.sqrt(s.varLot), 2)}</td><td class="num">${pct(s.reworkProb ?? 0)}</td>
          <td class="num">${fmt(s.lambda * 60)}</td><td class="num">${pct(s.share)}</td></tr>`).join("")}
      </tbody>
    </table>`;

  $("downtime").innerHTML = `
    <table>
      <thead><tr><th>Source</th><th class="num">Every (min)</th><th class="num">Lasts (min)</th>
        <th class="num">Share of time down</th><th class="num">c<sub>r</sub>²</th><th class="num">K<sub>j</sub> (min)</th></tr></thead>
      <tbody>${base.interruptions.map(d => `
        <tr><td>${d.name}</td><td class="num">${fmt(d.mfMin, 6)}</td><td class="num">${fmt(d.mrMin, 6)}</td>
          <td class="num">${pct(d.ratio / (1 + base.R))}</td><td class="num">${fmt(d.crSq)}</td><td class="num">${fmt(d.K)}</td></tr>`).join("")}
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
        return `<tr${ok ? "" : ' class="missing"'}><td>${label}</td><td class="num">${v == null ? "—" : fmt(v, 8)}</td><td>${unit}</td>
          <td class="src">${src || "—"}</td><td class="${ok ? "pass" : "fail"}">${ok ? "Filled" : "Missing"}</td></tr>`;
      }).join("")}
      </tbody>
    </table>`;

}

/* ---------- Costs (Phase 2: delay cost of the current state) ---------- */
function renderCosts() {
  const r = base, HPW = Calc.HOURS_PER_WEEK;
  const wait = inputs.costs.waitingPerLotHour;
  const weekly = Calc.weeklyWaitCost(r, wait.value);

  $("cost-answer").innerHTML = r.stable
    ? `On average about <strong>${fmt(r.Lq, 3)} lots</strong> are waiting at ${inputs.toolGroup}. At ${money(wait.value)} per lot-hour, that waiting costs about <strong>${money(weekly)} a week</strong> (${money(weekly * 52)} a year) in holding cost.`
    : `The steppers are over capacity, so the queue and its cost grow without limit.`;

  $("cost-worked").innerHTML = r.stable ? `
    <ol class="worked-steps">
      <li><span>Lots waiting, from Little’s Law</span>
        <code>L<sub>q</sub> = λ × W<sub>q</sub> = ${fmt(r.lambda, 6)} visits/min × ${fmt(r.Wq, 6)} min = ${fmt(r.Lq, 6)} lots</code></li>
      <li><span>Cost of waiting per lot-hour</span>
        <code>25 wafers × ${money(wait.parts.base.waferCost)} × ${pct(wait.parts.base.carryingRate, 2)} ÷ 8,760 h = ${money(wait.value)}</code></li>
      <li><span>Weekly delay cost</span>
        <code>${fmt(r.Lq, 6)} lots × ${HPW} h × ${money(wait.value)} = ${money(weekly)}</code></li>
    </ol>` : "";

  const cases = [
    ["28nm wafer, 20% carrying", wait.low],
    ["28nm wafer, 25% (base)", wait.value],
    ["28nm wafer, 30% carrying", Calc.carryingCostPerLotHour(25, wait.parts.low.waferCost, wait.parts.high.carryingRate)],
    ["Advanced wafer, 20% carrying", Calc.carryingCostPerLotHour(25, wait.parts.high.waferCost, wait.parts.low.carryingRate)],
    ["Advanced wafer, 30% carrying", wait.high],
  ];
  $("cost-range").innerHTML = `
    <table>
      <thead><tr><th>Cost of waiting</th><th class="num">$ per lot-hour</th><th class="num">Weekly delay cost</th><th class="num">Yearly delay cost</th></tr></thead>
      <tbody>${cases.map(([label, c]) => {
        const w = Calc.weeklyWaitCost(r, c);
        return `<tr><td>${label}</td><td class="num">${money(c)}</td><td class="num">${money(w)}</td><td class="num">${money(w * 52)}</td></tr>`;
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
        <tr><td>Hours per week</td><td class="num">${HPW}</td><td class="num">—</td><td class="src">The SMT2020 fab runs around the clock.</td></tr>
      </tbody>
    </table>`;
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
          <td class="${x.ok ? "pass" : "fail"}">${x.ok ? "Yes" : "No"}</td></tr>`).join("")}
      </tbody>
    </table>
    <p class="muted">Difference is relative: |site − hand calc| ÷ hand calc. The hand calc is rounded to about 8 significant figures, so anything under 1e-7 counts as a match.
    Lots waiting (L<sub>q</sub> = λ × W<sub>q</sub> = ${fmt(base.Lq, 6)}) comes from Little’s Law and isn’t in the hand calc.</p>`;
}

/* ---------- Pages ---------- */
function showPage() {
  const name = location.hash.slice(1);
  const page = PAGES.includes(name) ? name : "results";
  PAGES.forEach(p => { $(`page-${p}`).hidden = p !== page; });
  document.querySelectorAll(".tabs a").forEach(a => {
    if (a.dataset.page === page) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  if (base && page === "results") renderResults(); // the chart sizes itself to the visible page
}

let resizeTimer;
window.addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => base && renderResults(), 150); });
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
  renderCosts();
  showPage();
  renderResults();
  if (typeof runSelfChecks === "function") runSelfChecks();
});
