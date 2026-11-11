/*
  tests.js — self-checks for Module 1 against answers you can work out by hand.
  Runs on the page (bottom section) and in Node: node js/tests.js
*/
const CalcRef = (typeof Calc !== "undefined") ? Calc : require("./calc.js");

function baseCase(overrides = {}) {
  return { lotIntervalMin: 120, N: 1, A: 1, mttrHours: 0, crSq: 1, caSq: 1, c0StepSq: 1,
           steps: [{ name: "One step", t0Hours: 1, p: 0 }], ...overrides };
}

function checks() {
  const close = (a, b, tol = 1e-9) => Math.abs(a - b) < tol;
  const results = [];

  // 1. M/M/1: with ca2 = ce2 = 1 and no downtime, Kingman reduces to Wq = rho/(1-rho) * te.
  //    lambda = 0.5/h, te = 1 h -> rho = 0.5, Wq = 1 h.
  const mm1 = CalcRef.run(baseCase());
  results.push({ name: "M/M/1 case: ρ = 0.5 and Wq = 1 hour", pass: close(mm1.rho, 0.5) && close(mm1.Wq, 1) });

  // 2. Utilization: wait more than doubles from rho 0.80 -> 0.90 and again 0.90 -> 0.95.
  const atRho = rho => CalcRef.run(baseCase({ lotIntervalMin: 60 / rho })).Wq;
  const w80 = atRho(0.80), w90 = atRho(0.90), w95 = atRho(0.95);
  results.push({ name: "Wait more than doubles from 80% → 90% → 95% utilization", pass: w90 > 2 * w80 && w95 > 2 * w90 });

  // 3. Job mix: two identical steps -> c0^2 equals the per-step noise (0.0008).
  const mix = CalcRef.run(baseCase({ c0StepSq: 0.0008, steps: [
    { name: "A", t0Hours: 1, p: 0 }, { name: "B", t0Hours: 1, p: 0 }] }));
  results.push({ name: "Identical steps: c0² equals per-step noise (0.0008)", pass: close(mix.c0Sq, 0.0008, 1e-12) });

  // 4. Breakdowns: availability below 1 stretches te (te = t0/A) and adds variability.
  const down = CalcRef.run(baseCase({ A: 0.9, mttrHours: 2 }));
  results.push({ name: "Breakdowns: te = t0 / A and ce² > c0²", pass: close(down.te, 1 / 0.9) && down.ceSq > down.c0Sq });

  // 5. Unstable: rho >= 1 gives an infinite wait instead of a misleading number.
  const over = CalcRef.run(baseCase({ lotIntervalMin: 50 }));   // lambda = 1.2/h, te = 1 h
  results.push({ name: "Over capacity (ρ ≥ 1) is flagged as unstable", pass: !over.stable && over.Wq === Infinity });

  // 6. Splitting lots across 2 steppers halves each tool's arrival rate.
  const one = CalcRef.run(baseCase()), two = CalcRef.run(baseCase({ N: 2 }));
  results.push({ name: "Adding a stepper (N = 2) halves the arrival rate", pass: close(two.lambda, one.lambda / 2) });

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
