/*
  tests.js — self-checks for Module 1 against answers you can work out by hand.
  Runs on the page (bottom section) and in Node: node js/tests.js
  All times in MINUTES, matching calc.js.
*/
const CalcRef = (typeof Calc !== "undefined") ? Calc : require("./calc.js");

// One lot type released every `interval` minutes with `wafers` wafers per lot.
const lots = (interval, wafers = 1) => [{ lotType: "Regular", releaseIntervalMin: interval, wafersPerLot: wafers }];

// Simplest possible tool group: 1 tool, 1 wafer per lot, no load/unload, no downtime,
// one step of exactly 60 min (offset 0 -> c0^2 = 0), one lot every 120 min (rho = 0.5).
function baseCase(overrides = {}) {
  return {
    m: 1, loadMin: 0, unloadMin: 0, caSq: 1,
    products: { P: lots(120) },
    steps: [{ product: "P", name: "One step", tWaferMin: 60, offsetMin: 0 }],
    interruptions: [],
    ...overrides,
  };
}

function checks() {
  const close = (a, b, tol = 1e-9) => Math.abs(a - b) < tol;
  const rel = (a, b, tol = 1e-8) => Math.abs(a - b) <= tol * Math.abs(b);
  const results = [];

  // 1. Single tool with V = (ca2 + ce2)/2 = 1 (ca2 = 2, ce2 = 0): Sakasegawa at m = 1 has exponent
  //    sqrt(4) - 1 = 1, so Wq = rho/(1-rho) * te, the M/M/1 shape. rho = 0.5, te = 60 -> Wq = 60 min.
  const single = CalcRef.run(baseCase({ caSq: 2 }));
  results.push({ name: "Single tool, V = 1: ρ = 0.5 and Wq = 60 min", pass: close(single.rho, 0.5) && close(single.Wq, 60) });

  // 2. At m = 1, Sakasegawa matches Kingman exactly.
  const kingman = (ca, ce, rho, te) => ((ca + ce) / 2) * (rho / (1 - rho)) * te;
  const cases = [[1, 1, 0.5, 60], [0.5, 1.76, 0.9, 78.7], [2, 0.1, 0.3, 10]];
  results.push({ name: "m = 1: Sakasegawa equals Kingman",
    pass: cases.every(([ca, ce, rho, te]) => close(CalcRef.sakasegawaWq(ca, ce, rho, te, 1), kingman(ca, ce, rho, te))) });

  // 3. Utilization: wait more than doubles from rho 0.80 -> 0.90 and again 0.90 -> 0.95.
  const atRho = rho => CalcRef.run(baseCase({ products: { P: lots(60 / rho) } })).Wq;
  const w80 = atRho(0.80), w90 = atRho(0.90), w95 = atRho(0.95);
  results.push({ name: "Wait more than doubles from 80% → 90% → 95% utilization", pass: w90 > 2 * w80 && w95 > 2 * w90 });

  // 4. Release rate: one lot per event, summed over lot types (1/60 + 1/120 + 1/240 = 7/240 per min).
  const threeTypes = [60, 120, 240].map(x => ({ releaseIntervalMin: x, wafersPerLot: 1 }));
  results.push({ name: "Release rate sums 1/interval over lot types",
    pass: close(CalcRef.productReleaseRate(threeTypes), 7 / 240) });

  // 5. Rework: a step that rework returns to with r = 0.2 is visited 1/(1 - 0.2) = 1.25 times per lot.
  const rw = CalcRef.run(baseCase({ steps: [{ product: "P", tWaferMin: 30, offsetMin: 0, reworkProb: 0.2 }] }));
  results.push({ name: "Rework r = 0.2: visit rate = release rate / (1 − r)", pass: close(rw.lambda, (1 / 120) * 1.25) });

  // 6. Lot time and variance: 25 wafers x 2 min + 1 + 1 = 52 min; variance = 25 * 0.1^2 / 3.
  const lt = CalcRef.lotTime({ tWaferMin: 2, offsetMin: 0.1 }, 25, 1, 1);
  results.push({ name: "Lot time = 25·t + load + unload; variance = 25·a²/3", pass: close(lt.t, 52) && close(lt.variance, 25 * 0.01 / 3) });

  // 7. Job mix: two identical steps -> c0^2 equals one step's c0^2. Uniform +/-5% -> 0.05^2 / 3.
  const twin = { product: "P", tWaferMin: 60, offsetMin: 3 };
  const mix = CalcRef.run(baseCase({ products: { P: lots(240) }, steps: [{ ...twin, name: "A" }, { ...twin, name: "B" }] }));
  results.push({ name: "Identical steps: c0² equals one step's noise (±5% → 0.00083)", pass: close(mix.c0Sq, 0.05 ** 2 / 3, 1e-12) });

  // 8. Job mix: different means add between-step variance. Steps of 30 and 90 min, equal visits,
  //    no noise -> mean 60, variance 900, c0^2 = 0.25.
  const spread = CalcRef.run(baseCase({ products: { P: lots(480) }, steps: [
    { product: "P", tWaferMin: 30, offsetMin: 0 }, { product: "P", tWaferMin: 90, offsetMin: 0 }] }));
  results.push({ name: "Steps of 30 and 90 min: t0 = 60, c0² = 0.25", pass: close(spread.t0bar, 60) && close(spread.c0Sq, 0.25) });

  // 9. Breakdowns: mf = 540, mr = 60 -> A = 1/(1 + 60/540) = 0.9, te = t0 / A, and with one source
  //    ce^2 reduces to Hopp & Spearman: c0^2 + (1 + cr^2) A (1 - A) mr / t0.
  const down = CalcRef.run(baseCase({ interruptions: [{ name: "Break", mfMin: 540, mrMin: 60, crSq: 1 }] }));
  const hs = 0 + 2 * 0.9 * 0.1 * 60 / 60;
  results.push({ name: "One breakdown: A = 0.9, te = t0 / A, ce² matches Hopp & Spearman",
    pass: close(down.A, 0.9) && close(down.te, 60 / 0.9) && close(down.ceSq, hs) });

  // 10. Uniform PM duration: cr^2 = a^2 / (3 mr^2). Duration 400 +/- 80 -> 6400 / 480000.
  results.push({ name: "Uniform PM duration: cr² = a² / (3·mr²)",
    pass: close(CalcRef.downtimeScv({ mrMin: 400, offsetMin: 80 }), 6400 / 480000) });

  // 10b. Wafers per lot can differ by lot type: lot types of 1 and 3 wafers (20 min/wafer), equal release
  //      rates -> lot times 20 and 60 min, t0 = 40, variance 400, c0^2 = 0.25.
  const mixedLots = CalcRef.run(baseCase({
    products: { P: [{ lotType: "Small", releaseIntervalMin: 480, wafersPerLot: 1 },
                    { lotType: "Full",  releaseIntervalMin: 480, wafersPerLot: 3 }] },
    steps: [{ product: "P", tWaferMin: 20, offsetMin: 0 }] }));
  results.push({ name: "Lot types with 1 and 3 wafers: t0 = 40, c0² = 0.25",
    pass: close(mixedLots.t0bar, 40) && close(mixedLots.c0Sq, 0.25) });

  // 10c. Costs are placeholders: null is accepted, a negative value is rejected.
  const nullCostOk = (() => { try { CalcRef.run(baseCase({ costs: { wait: { value: null } } })); return true; } catch { return false; } })();
  let costThrew = false;
  try { CalcRef.run(baseCase({ costs: { wait: { label: "Waiting", value: -5 } } })); }
  catch (e) { costThrew = /Waiting/.test(e.message); }
  results.push({ name: "Cost placeholders: null allowed, negative rejected", pass: nullCostOk && costThrew });

  // 11. Unstable: rho >= 1 gives an infinite wait instead of a misleading number.
  const over = CalcRef.run(baseCase({ products: { P: lots(50) } }));   // lambda = 1.2/h, te = 60 min
  results.push({ name: "Over capacity (ρ ≥ 1) is flagged as unstable", pass: !over.stable && over.Wq === Infinity });

  // 12. More tools: m = 2 leaves the tool-group arrival rate unchanged but halves utilization.
  const one = CalcRef.run(baseCase()), two = CalcRef.run(baseCase({ m: 2 }));
  results.push({ name: "Adding a tool (m = 2): same λ, half the utilization, shorter wait",
    pass: close(two.lambda, one.lambda) && close(two.rho, one.rho / 2) && two.Wq < one.Wq });

  // 13. Bad inputs are rejected with a message (rework typed as 1.7 instead of 0.017).
  let threw = false;
  try { CalcRef.run(baseCase({ steps: [{ product: "P", tWaferMin: 60, offsetMin: 0, reworkProb: 1.7 }] })); }
  catch (e) { threw = /rework probability/.test(e.message); }
  results.push({ name: "Rework entered as 1.7 instead of 0.017 is rejected", pass: threw });

  // 14. Litho_FE_98 matches the hand-calc in the Calculations doc.
  const fe = CalcRef.run(CalcRef.LITHO_FE_98);
  const expected = {
    lambda: 0.05994318063, t0bar: 69.01518927, c0Sq: 0.09891538, A: 0.87702713, K: 149.38378119,
    te: 78.69219428, ceSq: 1.76380260, rho: 0.94341208, Wq: 332.94824720, cycleTime: 411.64044148,
  };
  const misses = Object.entries(expected).filter(([k, v]) => !rel(fe[k], v, 1e-7)).map(([k]) => k);
  const step65 = fe.stepSummary.find(s => s.step === 65);   // rolled up over Product 3's lot types
  if (!step65 || !rel(step65.lambda, 0.02022241408, 1e-7)) misses.push("λ65");
  results.push({ name: "Litho_FE_98 matches hand-calc (λ, λ65, t0, c0², A, K, te, ce², ρ, Wq, CT)"
    + (misses.length ? ` — off: ${misses.join(", ")}` : ""), pass: misses.length === 0 });

  return results;
}

function runSelfChecks() {
  const el = document.getElementById("checks");
  const res = checks();
  const passed = res.filter(r => r.pass).length;
  el.innerHTML = `<p>${passed} of ${res.length} checks passed.</p><ul>` +
    res.map(r => `<li class="${r.pass ? "pass" : "fail"}">${r.pass ? "Pass" : "Fail"}: ${r.name}</li>`).join("") + "</ul>";
}

if (typeof module !== "undefined" && require.main === module) {
  const res = checks();
  res.forEach(r => console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name}`));
  process.exit(res.every(r => r.pass) ? 0 : 1);
}
