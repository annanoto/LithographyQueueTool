/*
  calc.js — Module 1: capacity calculations for one lithography stepper.
  Every time is in HOURS. Rates are per hour. Percentages are decimals (2% = 0.02).
  Formulas match the "How the numbers combine" section of the Data Spec doc.
*/
const Calc = (() => {

  // Lot arrival rate: one lot every `lotIntervalMin` minutes -> lots per hour.
  function lotRatePerHour(lotIntervalMin) {
    return 60 / lotIntervalMin;
  }

  // Step 1. Arrival rate at the stepper for each litho step.
  // Each lot visits once per step, plus one extra pass if that step is reworked (rate p).
  // The dedicated lots are split across N steppers.
  function arrivalRates(steps, lambdaLot, N) {
    return steps.map(s => ({ ...s, lambda: lambdaLot * (1 + s.p) / N }));
  }

  // Step 2. Job mix: arrival-weighted average processing time and its variability (c0^2).
  // Each step's own noise is c0StepSq (SMT2020: uniform +/-5% -> 0.0008).
  function jobMix(stepsWithLambda, c0StepSq) {
    const lambda = stepsWithLambda.reduce((sum, s) => sum + s.lambda, 0);
    let t0bar = 0;
    let secondMoment = 0;
    for (const s of stepsWithLambda) {
      const share = s.lambda / lambda;
      const noise = s.c0Sq ?? c0StepSq;
      t0bar += share * s.t0Hours;
      secondMoment += share * (noise * s.t0Hours ** 2 + s.t0Hours ** 2);
    }
    const variance = secondMoment - t0bar ** 2;
    return { lambda, t0bar, c0Sq: variance / t0bar ** 2 };
  }

  // Step 3. Effective processing time with random breakdowns (Hopp & Spearman).
  // A = availability, mttr = mean time to repair (hours), crSq = repair-time variability (1 = exponential).
  function effectiveTime(t0bar, c0Sq, A, mttrHours, crSq = 1) {
    const te = t0bar / A;
    const ceSq = c0Sq + (1 + crSq) * A * (1 - A) * mttrHours / t0bar;
    return { te, ceSq };
  }

  // Step 4a. Utilization: share of time the stepper is busy.
  function utilization(lambda, te) {
    return lambda * te;
  }

  // Step 4b. Kingman's equation: average wait in queue.
  // Only valid when rho < 1; at rho >= 1 the queue grows without limit.
  function kingmanWq(caSq, ceSq, rho, te) {
    if (rho >= 1) return Infinity;
    return ((caSq + ceSq) / 2) * (rho / (1 - rho)) * te;
  }

  // Checks inputs and throws a clear message for anything out of range.
  function validate(inputs) {
    const errors = [];
    if (!(inputs.lotIntervalMin > 0)) errors.push("Time between lots must be greater than 0.");
    if (!(Number.isInteger(inputs.N) && inputs.N >= 1)) errors.push("N (number of steppers) must be a whole number of 1 or more.");
    if (!(inputs.A > 0 && inputs.A <= 1)) errors.push("Availability A must be between 0 and 1 (e.g., 0.862, not 86.2).");
    if (!(inputs.mttrHours >= 0)) errors.push("MTTR must be 0 or more hours.");
    if (!(inputs.caSq >= 0)) errors.push("ca^2 must be 0 or more.");
    if (!Array.isArray(inputs.steps) || inputs.steps.length === 0) errors.push("Add at least one litho step.");
    (inputs.steps || []).forEach((s, i) => {
      if (!(s.t0Hours > 0)) errors.push(`Step ${i + 1} (${s.name}): processing time must be greater than 0 hours.`);
      if (!(s.p >= 0 && s.p < 1)) errors.push(`Step ${i + 1} (${s.name}): rework rate must be a decimal between 0 and 1 (2% = 0.02).`);
    });
    if (errors.length) throw new Error(errors.join("\n"));
  }

  // Runs steps 1-5 and returns every intermediate value, so each one can be checked against the hand-calc.
  function run(inputs) {
    validate(inputs);
    const lambdaLot = lotRatePerHour(inputs.lotIntervalMin);
    const steps = arrivalRates(inputs.steps, lambdaLot, inputs.N);
    const { lambda, t0bar, c0Sq } = jobMix(steps, inputs.c0StepSq);
    const { te, ceSq } = effectiveTime(t0bar, c0Sq, inputs.A, inputs.mttrHours, inputs.crSq ?? 1);
    const rho = utilization(lambda, te);
    const stable = rho < 1;
    const Wq = kingmanWq(inputs.caSq, ceSq, rho, te);
    const cycleTime = stable ? Wq + te : Infinity;   // time at the stepper: wait + processing
    const Lq = stable ? lambda * Wq : Infinity;        // Little's Law: average lots waiting
    return { lambdaLot, steps, lambda, t0bar, c0Sq, te, ceSq, rho, stable, Wq, cycleTime, Lq };
  }

  return { lotRatePerHour, arrivalRates, jobMix, effectiveTime, utilization, kingmanWq, validate, run };
})();

// Lets the same file be tested with Node (node js/tests.js); ignored in the browser.
if (typeof module !== "undefined") module.exports = Calc;
