/*
  app.js — holds the inputs, runs Module 1, and shows the results.
  All times in MINUTES, rates and percentages as decimals (1.7% = 0.017).
  calc.js works in minutes (to match the hand-calc); the readout and chart convert waits to hours.

  PLACEHOLDERS — DATA TO COLLECT for the tool group Peixuan chooses. Each item carries a `source`.
  Replace the value AND the source when the data changes. Anything with value null or an empty
  source shows up as "missing" in the "Data to collect" list on the page.
    1. Lot release: release interval and wafers per lot, for each product (and lot type) using the tool group
    2. Breakdowns: mean time to failure (MTTF) and mean time to repair (MTTR)
    3. Scheduled maintenance: how often (interval) and how long (duration) — used for availability
    4. Costs: $ per lot-hour of waiting, cost of an extra stepper, cost of a rework-reduction project
  Currently filled with Litho_FE_98 from the Dataset and Calculations docs; costs are not sourced yet.
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

  // 4. PLACEHOLDER — Cost assumptions. Not used in any calculation yet; fill in value and source.
  costs: {
    waitingPerLotHour: { label: "Cost of waiting",                 unit: "$ per lot-hour", value: null, source: "" },
    extraStepper:      { label: "Cost of an extra stepper",        unit: "$ per tool",     value: null, source: "" },
    reworkProject:     { label: "Cost of a rework-reduction project", unit: "$ per project", value: null, source: "" },
  },
};

const fmt = (x, digits = 4) =>
  Number.isFinite(x) ? Number(x.toPrecision(digits)).toString() : "∞";
const pct = x => Number.isFinite(x) ? `${fmt(x * 100, 3)}%` : "∞";
const hrs = min => min / 60;

// Wait vs. utilization, holding this tool group's te, ca2, ce2 and m fixed:
// the Sakasegawa utilization term made visible, with the current state marked. Waits shown in hours.
function curveSVG(r, widthPx) {
  const W = Math.round(Math.max(320, Math.min(widthPx || 720, 900)));
  const narrow = W < 520;
  const H = narrow ? 300 : 370, m = { l: 64, r: 18, t: 36, b: 58 };
  const x0 = 0.3, x1 = 0.98;
  const wait = rho => hrs(Calc.sakasegawaWq(inputs.caSq, r.ceSq, rho, r.te, inputs.m));
  const WqH = hrs(r.Wq);
  const yMax = Math.max(wait(0.95), r.stable ? WqH * 1.15 : 0);
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
    ticks += `<line class="grid" stroke="#c3c9d3" x1="${m.l}" x2="${W - m.r}" y1="${Y(w)}" y2="${Y(w)}"/>
      <text class="tick" fill="#4a5466" font-size="14" x="${m.l - 10}" y="${Y(w) + 5}" text-anchor="end">${w}</text>`;
  }
  for (let p = 30; p <= 90; p += narrow ? 20 : 10) {
    ticks += `<text class="tick" fill="#4a5466" font-size="14" x="${X(p / 100)}" y="${H - m.b + 24}" text-anchor="middle">${p}%</text>`;
  }

  let here = "";
  if (r.stable && r.rho >= x0 && r.rho <= x1) {
    const hx = X(r.rho), hy = Y(WqH);
    const end = hx > W * 0.6;
    const tx = hx + (end ? -16 : 16);
    here = `<line class="here-line" stroke="#131a26" stroke-dasharray="5 5" x1="${hx}" x2="${hx}" y1="${hy}" y2="${H - m.b}"/>
      <circle class="here" fill="#d99100" stroke="#131a26" stroke-width="2.5" cx="${hx}" cy="${hy}" r="9"/>
      <text class="here-label" fill="#131a26" font-size="16" font-weight="700" x="${tx}" y="${hy - 32}" text-anchor="${end ? "end" : "start"}">
        <tspan x="${tx}">${inputs.toolGroup}</tspan>
        <tspan x="${tx}" dy="20">${pct(r.rho)} busy, ${fmt(WqH, 3)} h wait</tspan></text>`;
  }

  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Average wait rises sharply as utilization approaches 100 percent; ${inputs.toolGroup} (${inputs.m} tools) is at ${pct(r.rho)} utilization with a ${fmt(WqH, 3)} hour wait.">
    <rect class="zone" fill="#fbe7b8" x="${X(0.85)}" y="${m.t}" width="${X(x1) - X(0.85)}" height="${H - m.t - m.b}"/>
    <text class="zone-label" fill="#4a5466" font-size="13" x="${X(x1)}" y="${m.t - 12}" text-anchor="end">${narrow ? "SMT2020 litho range" : "Where SMT2020’s lithography tools run"}</text>
    ${ticks}
    <line class="axis" stroke="#131a26" stroke-width="2" x1="${m.l}" x2="${W - m.r}" y1="${H - m.b}" y2="${H - m.b}"/>
    <line class="axis" stroke="#131a26" stroke-width="2" x1="${m.l}" x2="${m.l}" y1="${m.t}" y2="${H - m.b}"/>
    <path class="line" fill="none" stroke="#131a26" stroke-width="4" stroke-linecap="round" d="${path}"/>
    ${here}
    <text class="axis-label" fill="#131a26" font-size="15" font-weight="700" x="${(W + m.l) / 2}" y="${H - 10}" text-anchor="middle">Utilization ρ</text>
    <text class="axis-label" fill="#131a26" font-size="15" font-weight="700" transform="translate(18 ${(H - m.b + m.t) / 2}) rotate(-90)" text-anchor="middle">Average wait (hours)</text>
  </svg>`;
}

function routeHTML(r) {
  const stations = [
    ["Arrivals", `λ = ${fmt(r.lambdaPerHour, 3)} per h`, "Lot releases of every product and lot type, plus repeat visits from rework, for the whole tool group."],
    ["Job mix", `c₀² = ${fmt(r.c0Sq, 3)}`, "Steps take different times per lot (25 wafers plus load/unload), which adds variability."],
    ["Downtime", `A = ${pct(r.A)}, cₑ² = ${fmt(r.ceSq, 3)}`, "Breakdowns and weekly, monthly and quarterly PM stretch each job and make processing less predictable."],
    ["Utilization", `ρ = ${pct(r.rho)}`, `The share of time each of the ${inputs.m} tools is busy.`],
    ["Wait", `W<sub>q</sub> = ${fmt(hrs(r.Wq), 3)} h`, "The Sakasegawa G/G/m approximation combines variability, utilization, and processing time."]
  ];
  return stations.map(([t, v, d]) => `<li><h3>${t} <span>${v}</span></h3><p>${d}</p></li>`).join("");
}

// Every placeholder item from the "Data to collect" list, with its current value and source.
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
  for (const c of Object.values(inputs.costs || {})) items.push([c.label, c.value, c.unit, c.source]);
  return items;
}

function placeholderHTML() {
  const items = placeholderItems();
  const missing = items.filter(([, v, , src]) => v == null || !src).length;
  return `
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

function row(label, symbol, value, unit) {
  return `<tr><td>${label}</td><td class="sym">${symbol}</td><td class="num">${value}</td><td>${unit}</td></tr>`;
}

function render() {
  const $ = id => document.getElementById(id);
  try {
    const r = Calc.run(inputs);

    $("readout").innerHTML = `
      <div><dt>Utilization</dt><dd>${pct(r.rho)}</dd></div>
      <div class="key"><dt>Average wait in queue</dt><dd>${fmt(hrs(r.Wq), 3)} <small>hours</small></dd></div>
      <div><dt>Time at tool group</dt><dd>${fmt(hrs(r.cycleTime), 3)} <small>hours</small></dd></div>
      <div><dt>Lots waiting</dt><dd>${fmt(r.Lq, 3)} <small>lots</small></dd></div>`;

    $("curve").innerHTML = (r.stable ? "" :
      `<p class="warn">Utilization is ${pct(r.rho)}. At 100% or more the queue grows without limit, so the queueing formula doesn’t apply.</p>`)
      + curveSVG(r, $("curve").clientWidth);

    $("route").innerHTML = routeHTML(r);

    $("steps").innerHTML = `
      <table>
        <thead><tr><th>Product</th><th>Lot type</th><th>Step</th><th class="num">Release every (min)</th><th class="num">Wafers per lot</th>
          <th class="num">Wafer time (min)</th><th class="num">± Offset (min)</th><th class="num">Lot time (min)</th>
          <th class="num">Rework</th><th class="num">Visits per lot</th><th class="num">Visit rate λᵢ (per h)</th><th class="num">Share pᵢ</th></tr></thead>
        <tbody>${r.steps.map(s => `
          <tr><td>${s.product}</td><td>${s.lotType ?? ""}</td><td>${s.step ?? ""} ${s.name ?? ""}</td>
            <td class="num">${fmt(s.releaseIntervalMin, 7)}</td><td class="num">${s.wafersPerLot}</td>
            <td class="num">${fmt(s.tWaferMin)}</td><td class="num">${fmt(s.offsetMin)}</td><td class="num">${fmt(s.tLot)}</td>
            <td class="num">${pct(s.reworkProb ?? 0)}</td><td class="num">${fmt(s.expectedVisits, 6)}</td>
            <td class="num">${fmt(s.lambda * 60)}</td><td class="num">${fmt(s.share)}</td></tr>`).join("")}
        </tbody>
      </table>`;

    $("downtime").innerHTML = `
      <table>
        <thead><tr><th>Downtime source</th><th class="num">Interval m<sub>f</sub> (min)</th><th class="num">Duration m<sub>r</sub> (min)</th>
          <th class="num">Ratio r<sub>j</sub></th><th class="num">c<sub>r</sub>²</th><th class="num">K<sub>j</sub> (min)</th></tr></thead>
        <tbody>${r.interruptions.map(d => `
          <tr><td>${d.name}</td><td class="num">${fmt(d.mfMin, 6)}</td><td class="num">${fmt(d.mrMin, 6)}</td>
            <td class="num">${fmt(d.ratio)}</td><td class="num">${fmt(d.crSq)}</td><td class="num">${fmt(d.K)}</td></tr>`).join("")}
        </tbody>
      </table>`;

    // Results table in minutes, matching the hand-calc; waits also shown in hours.
    $("results").innerHTML = `
      <table>
        <thead><tr><th>Value</th><th>Symbol</th><th class="num">Result</th><th>Unit</th></tr></thead>
        <tbody>
          ${row("Number of tools", "m", inputs.m, "")}
          ${row("Arrival rate at this tool group", "λ", fmt(r.lambda, 8), `visits per min (${fmt(r.lambdaPerHour)} per h)`)}
          ${row("Average processing time (job mix)", "t̄<sub>0</sub>", fmt(r.t0bar, 8), "min per visit")}
          ${row("Processing variability (job mix)", "c<sub>0</sub>²", fmt(r.c0Sq, 8), "")}
          ${row("Availability", "A", fmt(r.A, 8), pct(r.A))}
          ${row("Downtime variability term", "K", fmt(r.K, 8), "min")}
          ${row("Effective processing time", "t<sub>e</sub>", fmt(r.te, 8), "min per visit")}
          ${row("Effective variability", "c<sub>e</sub>²", fmt(r.ceSq, 8), "")}
          ${row("Arrival variability (assumed)", "c<sub>a</sub>²", fmt(inputs.caSq), "")}
          ${row("Utilization", "ρ", fmt(r.rho, 8), pct(r.rho))}
          ${row("Average wait in queue", "W<sub>q</sub>", fmt(r.Wq, 8), `min (${fmt(hrs(r.Wq))} h)`)}
          ${row("Time at tool group (wait + processing)", "CT", fmt(r.cycleTime, 8), `min (${fmt(hrs(r.cycleTime))} h)`)}
          ${row("Average lots waiting", "L<sub>q</sub>", fmt(r.Lq), "lots")}
        </tbody>
      </table>`;

    $("placeholders").innerHTML = placeholderHTML();
  } catch (err) {
    ["readout", "curve", "route", "steps", "downtime", "placeholders", "results"].forEach(id => $(id).innerHTML = "");
    $("curve").innerHTML = `<p class="warn">The inputs in js/app.js need fixing:</p><pre>${err.message}</pre>`;
  }
}

let resizeTimer;
window.addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(render, 150); });

document.addEventListener("DOMContentLoaded", () => {
  render();
  if (typeof runSelfChecks === "function") runSelfChecks();
});
