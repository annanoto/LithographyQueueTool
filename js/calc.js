/*
  calc.js — Phase 1: capacity calculations for one lithography tool group (G/G/m).
            Phase 2: financial calculations (delay cost, payback, ROI).
            Module 3: scenarios (current state, add a stepper, cut the rework rate).
            Module 4: slider settings (applyWhatIf) for the interactive page.
  Every time is in MINUTES (to match the hand-calc). Rates are per minute.
  Percentages are decimals (1.7% = 0.017). Hour conversions are returned at the end.
  Formulas match the Calculations doc for Litho_FE_98 (SMT2020).
*/
const Calc = (() => {

  // Step 1a. Release rate of one product: one lot per release event, summed over its lot types
  // (e.g. Regular + Hot + Super Hot). Each lot type: { lotType, releaseIntervalMin, wafersPerLot }.
  // Intervals in minutes -> lots per minute.
  function productReleaseRate(lotTypes) {
    return lotTypes.reduce((sum, lt) => sum + 1 / lt.releaseIntervalMin, 0);
  }

  // Step 1b. Visit rate for each job class on this tool group.
  // A job class is one step x one lot type, because lot types can differ in wafers per lot
  // (and so in lot processing time). With equal wafers per lot this gives the same answer as per-step.
  // A step that rework returns to (probability r on every visit) is visited 1/(1 - r) times per lot
  // (geometric series 1 + r + r^2 + ...). Confirmed by Peixuan: SMT2020 sets no limit on rework cycles,
  // so a reworked lot can be reworked again (a single-rework cap would be 1 + r instead). No division by m here; that happens in utilization.
  function arrivalRates(steps, products) {
    return steps.flatMap(s => {
      const r = s.reworkProb ?? 0;
      const expectedVisits = 1 / (1 - r);
      return products[s.product].map(lt => ({
        ...s,
        lotType: lt.lotType,
        wafersPerLot: lt.wafersPerLot,
        releaseIntervalMin: lt.releaseIntervalMin,
        expectedVisits,
        lambda: expectedVisits / lt.releaseIntervalMin,
      }));
    });
  }

  // Step 2a. Per-lot processing time and variance for one step.
  // Lot time = wafers x wafer time + load + unload (load/unload fixed, so no added variance).
  // Wafer time ~ Uniform(mean - a, mean + a): Var = a^2 / 3, times wafers (independent wafers).
  function lotTime(step, wafersPerLot, loadMin, unloadMin) {
    const t = wafersPerLot * step.tWaferMin + loadMin + unloadMin;
    const variance = wafersPerLot * step.offsetMin ** 2 / 3;
    return { t, variance };
  }

  // Step 2b. Job mix: visit-weighted mean t0bar and c0^2 from the mixture's second moment.
  // E[S0^2] = sum p_i (t_i^2 + sigma_i^2);  Var = E[S0^2] - t0bar^2;  c0^2 = Var / t0bar^2.
  function jobMix(stepsWithLambda, loadMin, unloadMin) {
    const lambda = stepsWithLambda.reduce((sum, s) => sum + s.lambda, 0);
    let t0bar = 0;
    let secondMoment = 0;
    const steps = stepsWithLambda.map(s => {
      const { t, variance } = lotTime(s, s.wafersPerLot, loadMin, unloadMin);
      const share = s.lambda / lambda;
      t0bar += share * t;
      secondMoment += share * (t ** 2 + variance);
      return { ...s, tLot: t, varLot: variance, share };
    });
    const variance = secondMoment - t0bar ** 2;
    return { lambda, steps, t0bar, secondMoment, variance, c0Sq: variance / t0bar ** 2 };
  }

  // SCV of one downtime duration: given directly (exponential = 1),
  // or from a uniform offset a: a^2 / (3 mr^2).
  function downtimeScv(src) {
    if (src.crSq != null) return src.crSq;
    if (src.offsetMin != null) return src.offsetMin ** 2 / (3 * src.mrMin ** 2);
    return 1;
  }

  // Step 3. Availability and effective processing time with several independent interruption
  // sources (breakdown + weekly/monthly/quarterly PM). PM interval is used as mf (approximation).
  //   r_j = mr_j / mf_j,  A = 1 / (1 + sum r_j),  te = t0bar / A
  //   K = sum r_j * mr_j * (1 + cr_j^2),  ce^2 = c0^2 + A^2 K / t0bar
  function effectiveTime(t0bar, c0Sq, interruptions) {
    const sources = interruptions.map(src => {
      const ratio = src.mrMin / src.mfMin;
      const crSq = downtimeScv(src);
      return { ...src, ratio, crSq, K: ratio * src.mrMin * (1 + crSq) };
    });
    const R = sources.reduce((sum, s) => sum + s.ratio, 0);
    const K = sources.reduce((sum, s) => sum + s.K, 0);
    const A = 1 / (1 + R);
    const te = t0bar / A;
    const ceSq = c0Sq + (A ** 2 * K) / t0bar;
    return { sources, R, A, K, te, ceSq };
  }

  // Step 4a. Utilization of a group of m parallel tools.
  function utilization(lambda, te, m) {
    return (lambda * te) / m;
  }

  // Step 4b. Sakasegawa G/G/m approximation for average wait in queue.
  // Wq = ((ca^2 + ce^2) / 2) * (rho^(sqrt(2(m+1)) - 1) / (m (1 - rho))) * te.
  // Only valid when rho < 1; at rho >= 1 the queue grows without limit. Reduces to Kingman at m = 1.
  function sakasegawaWq(caSq, ceSq, rho, te, m) {
    if (rho >= 1) return Infinity;
    const V = (caSq + ceSq) / 2;
    const alpha = Math.sqrt(2 * (m + 1)) - 1;
    const U = rho ** alpha / (m * (1 - rho));
    return V * U * te;
  }

  // Rolls job classes back up to one row per step (product + step), to compare with the hand-calc's λ_i and p_i.
  function stepSummary(jobClasses) {
    const byStep = new Map();
    for (const c of jobClasses) {
      const key = `${c.product}|${c.step ?? c.name}`;
      const row = byStep.get(key) || { product: c.product, step: c.step, name: c.name, lambda: 0, share: 0 };
      row.lambda += c.lambda;
      row.share += c.share;
      byStep.set(key, row);
    }
    return [...byStep.values()];
  }

  // Checks inputs and throws a clear message for anything out of range.
  function validate(inputs) {
    const errors = [];
    if (!(Number.isInteger(inputs.m) && inputs.m >= 1)) errors.push("m (number of tools) must be a whole number of 1 or more.");
    if (!(inputs.loadMin >= 0)) errors.push("Loading time must be 0 or more minutes.");
    if (!(inputs.unloadMin >= 0)) errors.push("Unloading time must be 0 or more minutes.");
    if (!(inputs.caSq >= 0)) errors.push("ca^2 must be 0 or more.");

    const products = inputs.products || {};
    for (const [name, lotTypes] of Object.entries(products)) {
      if (!Array.isArray(lotTypes) || lotTypes.length === 0) {
        errors.push(`${name}: add at least one lot type with a release interval and wafers per lot.`);
        continue;
      }
      lotTypes.forEach(lt => {
        const label = `${name} ${lt.lotType ?? ""}`.trim();
        if (!(lt.releaseIntervalMin > 0)) errors.push(`${label}: release interval must be greater than 0 minutes.`);
        if (!(Number.isInteger(lt.wafersPerLot) && lt.wafersPerLot >= 1)) errors.push(`${label}: wafers per lot must be a whole number of 1 or more.`);
      });
    }

    if (!Array.isArray(inputs.steps) || inputs.steps.length === 0) errors.push("Add at least one litho step.");
    (inputs.steps || []).forEach((s, i) => {
      const label = `Step ${i + 1} (${s.product} ${s.name ?? ""})`.trim();
      if (!(s.product in products)) errors.push(`${label}: no lot release data given for "${s.product}".`);
      if (!(s.tWaferMin > 0)) errors.push(`${label}: wafer processing time must be greater than 0 minutes.`);
      if (!(s.offsetMin >= 0)) errors.push(`${label}: uniform offset must be 0 or more minutes.`);
      if (s.offsetMin > s.tWaferMin) errors.push(`${label}: uniform offset cannot exceed the mean.`);
      const r = s.reworkProb ?? 0;
      if (!(r >= 0 && r < 1)) errors.push(`${label}: rework probability must be a decimal between 0 and 1 (1.7% = 0.017).`);
    });

    (inputs.interruptions || []).forEach((d, i) => {
      const label = `Interruption ${i + 1} (${d.name})`;
      if (!(d.mfMin > 0)) errors.push(`${label}: MTTF / interval must be greater than 0 minutes.`);
      if (!(d.mrMin >= 0)) errors.push(`${label}: MTTR / duration must be 0 or more minutes.`);
      if (d.crSq != null && !(d.crSq >= 0)) errors.push(`${label}: cr^2 must be 0 or more.`);
    });

    // Costs are placeholders until sourced: null is allowed, but a filled-in value must be 0 or more.
    for (const [key, c] of Object.entries(inputs.costs || {})) {
      if (c && c.value != null && !(c.value >= 0)) errors.push(`Cost "${c.label ?? key}" must be 0 or more (or null if not known yet).`);
    }

    if (errors.length) throw new Error(errors.join("\n"));
  }

  // Runs every step and returns every intermediate value, so each one can be checked against the hand-calc.
  function run(inputs) {
    validate(inputs);
    const { m, loadMin, unloadMin, caSq } = inputs;

    const productRates = {};
    for (const [name, lotTypes] of Object.entries(inputs.products)) {
      productRates[name] = productReleaseRate(lotTypes);
    }

    const visited = arrivalRates(inputs.steps, inputs.products);
    const mix = jobMix(visited, loadMin, unloadMin);
    const eff = effectiveTime(mix.t0bar, mix.c0Sq, inputs.interruptions || []);
    const rho = utilization(mix.lambda, eff.te, m);
    const stable = rho < 1;
    const Wq = sakasegawaWq(caSq, eff.ceSq, rho, eff.te, m);
    const cycleTime = stable ? Wq + eff.te : Infinity;   // time at the tool group: wait + processing
    const Lq = stable ? mix.lambda * Wq : Infinity;        // Little's Law: average lots waiting

    return {
      productRates,
      steps: mix.steps,                  // one row per job class (step x lot type)
      stepSummary: stepSummary(mix.steps), // one row per step, matching the hand-calc's λ_i and p_i
      lambda: mix.lambda,               // visits/min (total for the tool group, incl. rework)
      lambdaPerHour: mix.lambda * 60,
      t0bar: mix.t0bar,
      secondMoment: mix.secondMoment,
      variance: mix.variance,
      c0Sq: mix.c0Sq,
      interruptions: eff.sources,
      R: eff.R,
      A: eff.A,
      K: eff.K,
      te: eff.te,
      ceSq: eff.ceSq,
      rho,
      stable,
      Wq,
      WqHours: Wq / 60,
      cycleTime,
      cycleTimeHours: cycleTime / 60,
      Lq,
    };
  }

  // ---- Phase 2: financial calculations ----
  // fixEconomics and breakEvenWaitCost compare a "before" and an "after" result (Module 3 scenarios).

  // Returns a copy of the inputs with scenario or slider settings applied; the original is never changed.
  // Any setting left undefined keeps the data value.
  //   m            number of tools
  //   caSq         arrival variability
  //   reworkProb   replaces the rework probability on every step that has a rework loop
  //                (a step with reworkProb set; in the Litho_FE_98 data, Product 3 Step 65, 072_Litho)
  //   availability target A, reached by making every downtime source happen more or less often
  //                (each interval mf divided by the same factor; durations unchanged)
  function applyWhatIf(inputs, whatIf = {}) {
    const out = {
      ...inputs,
      steps: inputs.steps.map(s => ({ ...s })),
      interruptions: (inputs.interruptions || []).map(d => ({ ...d })),
    };
    if (whatIf.m != null) out.m = whatIf.m;
    if (whatIf.caSq != null) out.caSq = whatIf.caSq;
    if (whatIf.reworkProb != null) {
      out.steps.forEach(s => { if (s.reworkProb != null) s.reworkProb = whatIf.reworkProb; });
    }
    if (whatIf.availability != null) {
      const A = whatIf.availability;
      if (!(A > 0 && A <= 1)) throw new Error("Availability must be between 0 and 1 (e.g., 0.877, not 87.7).");
      const R = out.interruptions.reduce((sum, d) => sum + d.mrMin / d.mfMin, 0);
      const targetR = 1 / A - 1;
      if (R > 0) {
        const factor = targetR / R;
        out.interruptions.forEach(d => { d.mfMin = factor > 0 ? d.mfMin / factor : Infinity; });
      } else if (targetR > 0) {
        throw new Error("Availability can only be changed when at least one downtime source is entered.");
      }
    }
    return out;
  }

  // Module 3: reruns the whole queueing chain for each scenario (Detailed Calculations,
  // "Improvement scenarios and savings": rerun everything, not just the last formula).
  function runScenarios(inputs, scenarios) {
    return scenarios.map(sc => ({ ...sc, result: run(applyWhatIf(inputs, sc.whatIf || {})) }));
  }

  // The SMT2020 fab runs around the clock, so a week is 168 hours.
  const HOURS_PER_WEEK = 168;
  const HOURS_PER_YEAR = 8760;   // H in the Detailed Calculations: 365 x 24

  // Weekly cost of waiting: average lots waiting (Lq) x hours per week x $ per lot-hour.
  // null when the cost isn't entered yet; Infinity when the queue is unstable.
  function weeklyWaitCost(result, costPerLotHour) {
    if (costPerLotHour == null) return null;
    if (!result.stable) return Infinity;
    return result.Lq * HOURS_PER_WEEK * costPerLotHour;
  }

  // Yearly cost of waiting: C_waiting,year = Lq x h x H (Detailed Calculations).
  function annualWaitCost(result, costPerLotHour) {
    if (costPerLotHour == null) return null;
    if (!result.stable) return Infinity;
    return result.Lq * costPerLotHour * HOURS_PER_YEAR;
  }

  // Holding (carrying) cost of one lot per hour of waiting:
  // wafers per lot x wafer cost x annual carrying rate / 8,760 hours per year.
  function carryingCostPerLotHour(wafersPerLot, waferCost, carryingRate) {
    return wafersPerLot * waferCost * carryingRate / 8760;
  }

  // Compares a fix with the current state, on a yearly basis (Detailed Calculations):
  //   annualSavings = C_baseline - C_improved - yearly operating cost of the fix (if known)
  //   paybackYears  = I / annual net savings
  //   roi           = (annual net savings x horizonYears - I) / I
  // status says why a value is missing: "current-unstable", "fix-unstable", "no-wait-cost", "no-fix-cost".
  function fixEconomics(current, fixed, fixCost, costPerLotHour, horizonYears = 5, annualOperatingCost = 0) {
    const out = { status: "ok", before: null, after: null, annualSavings: null, paybackYears: null, roi: null };
    if (!current.stable) { out.status = "current-unstable"; return out; }
    if (!fixed.stable) { out.status = "fix-unstable"; return out; }
    if (costPerLotHour == null) { out.status = "no-wait-cost"; return out; }
    out.before = annualWaitCost(current, costPerLotHour);
    out.after = annualWaitCost(fixed, costPerLotHour);
    out.annualSavings = out.before - out.after - (annualOperatingCost || 0);
    if (fixCost == null) { out.status = "no-fix-cost"; return out; }
    out.paybackYears = out.annualSavings > 0 ? fixCost / out.annualSavings : Infinity;
    out.roi = fixCost > 0 ? (out.annualSavings * horizonYears - fixCost) / fixCost : null;
    return out;
  }

  // Break-even cost of waiting: the $ per lot-hour at which a fix pays for itself in exactly horizonYears.
  //   = cost of the fix / (drop in Lq x 8,760 h x horizonYears). null if it can't be worked out.
  function breakEvenWaitCost(current, fixed, fixCost, horizonYears) {
    if (!current.stable || !fixed.stable || fixCost == null) return null;
    const dropLq = current.Lq - fixed.Lq;
    if (!(dropLq > 0)) return null;
    return fixCost / (dropLq * HOURS_PER_YEAR * horizonYears);
  }

  // Litho_FE_98 inputs from the Dataset and Calculations docs (SMT2020). All times in minutes.
  // Keep in step with the inputs in app.js; the tests use this copy to check the hand-calc.
  const LITHO_FE_98 = {
    toolGroup: "Litho_FE_98",
    m: 5,
    loadMin: 1,
    unloadMin: 1,
    caSq: 1, // assumption A5: interarrival SCV not observed
    products: {
      "Product 3": [
        { lotType: "Regular",   releaseIntervalMin: 51.69,    wafersPerLot: 25 },
        { lotType: "Hot",       releaseIntervalMin: 2016,     wafersPerLot: 25 },
        { lotType: "Super Hot", releaseIntervalMin: 27397.61, wafersPerLot: 25 },
      ],
      "Product 4": [
        { lotType: "Regular",   releaseIntervalMin: 51.69,    wafersPerLot: 25 },
        { lotType: "Hot",       releaseIntervalMin: 2016,     wafersPerLot: 25 },
      ],
    },
    steps: [
      // Rework triggered at Step 67 (074_Litho_Met) returns the lot to Step 65 with p = 1.7%.
      { product: "Product 3", step: 65, name: "072_Litho", tWaferMin: 1.464, offsetMin: 0.0732, reworkProb: 0.017 },
      { product: "Product 3", step: 72, name: "079_Litho", tWaferMin: 3.300, offsetMin: 0.165 },
      { product: "Product 4", step: 68, name: "079_Litho", tWaferMin: 3.300, offsetMin: 0.170 },
    ],
    interruptions: [
      { name: "Breakdown (BREAK_Litho)", mfMin: 10080,  mrMin: 705.59, crSq: 1 }, // exponential repair
      { name: "Weekly PM",               mfMin: 10080,  mrMin: 399.0,  offsetMin: 79.8 },
      { name: "Monthly PM",              mfMin: 43200,  mrMin: 797.4,  offsetMin: 159.6 },
      { name: "Quarterly PM",            mfMin: 131040, mrMin: 1595.4, offsetMin: 319.2 },
    ],
  };

  return {
    productReleaseRate, arrivalRates, lotTime, jobMix, stepSummary, downtimeScv,
    effectiveTime, utilization, sakasegawaWq, validate, run,
    applyWhatIf, runScenarios, HOURS_PER_WEEK, HOURS_PER_YEAR, carryingCostPerLotHour,
    weeklyWaitCost, annualWaitCost, fixEconomics,
    breakEvenWaitCost, LITHO_FE_98,
  };
})();

// Lets the same file be tested with Node (node js/tests.js); ignored in the browser.
if (typeof module !== "undefined") module.exports = Calc;
