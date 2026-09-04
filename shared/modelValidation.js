/**
 * Model validation, shared by the browser and the API.
 *
 * This lives outside client/ and server/ on purpose. A second copy of the
 * economic model once lived on the server and drifted until the two disagreed
 * by 16% on the same inputs; validation rules would drift the same way. Both
 * sides import this file, so there is exactly one definition of "valid".
 *
 * Two severities, because they need different handling:
 *
 *   errors   - the result would be meaningless. Block the calculation.
 *   warnings - the arithmetic is sound but the answer is probably not what the
 *              user intended. Compute, show the number, say what is odd.
 *
 * The engine itself is already safe against nonsense: num() falls back to 0 and
 * clamp01 bounds every rate, so no input produces NaN or Infinity. What it does
 * not do is tell anyone. A zeroed eligibility rate silently returns "no budget
 * impact", which reads exactly like a real finding. That is what this catches.
 */

const isNum = (v) => v !== null && v !== undefined && v !== "" && Number.isFinite(Number(v));
const n = (v) => Number(v);

/** Funnel rates, in the order they are applied. Any zero collapses the funnel. */
const FUNNEL = [
  ["prevalence", "Disease prevalence"],
  ["diagnosisRate", "Diagnosed share"],
  ["clinicalEligibility", "Clinically eligible"],
  ["payerEligibility", "Payer eligible"],
  ["accessRate", "Able to access"],
  ["willingnessRate", "Willing to treat"],
];

const RATES = [
  ...FUNNEL,
  ["annualIncidence", "Annual incidence"],
  ["responderRate", "Responder rate"],
  ["weightRegainRate", "Regain rate"],
];

export function validateModel(model) {
  const errors = [];
  const warnings = [];
  const err = (field, message) => errors.push({ field, message });
  const warn = (field, message) => warnings.push({ field, message });

  if (!model || typeof model !== "object") {
    return { ok: false, errors: [{ field: "model", message: "No model supplied." }], warnings: [] };
  }

  /* ---------------- population ---------------- */

  if (!isNum(model.coveredPopulation)) {
    err("coveredPopulation", "Covered population must be a number.");
  } else if (n(model.coveredPopulation) <= 0) {
    err("coveredPopulation", "Covered population must be greater than zero — with no covered lives every result is zero.");
  }

  /* ---------------- horizon ---------------- */

  if (!isNum(model.timeHorizonYears)) {
    err("timeHorizonYears", "Time horizon must be a number.");
  } else {
    const y = n(model.timeHorizonYears);
    if (y < 1) err("timeHorizonYears", "Time horizon must be at least 1 year.");
    else if (y > 10) err("timeHorizonYears", "Time horizon is capped at 10 years.");
  }

  /* ---------------- rates ---------------- */

  for (const [key, label] of RATES) {
    const v = model[key];
    if (v === undefined || v === null || v === "") continue;
    if (!isNum(v)) { err(key, `${label} must be a number.`); continue; }
    if (n(v) < 0) err(key, `${label} cannot be negative.`);
    else if (n(v) > 1) err(key, `${label} cannot exceed 100%.`);
  }

  // A single zeroed funnel step drives the whole result to zero, which reads
  // like a finding rather than a mistake.
  const zeroed = FUNNEL.filter(([k]) => isNum(model[k]) && n(model[k]) === 0);
  if (zeroed.length) {
    const which = zeroed.map(([, label]) => label).join(", ");
    const only = zeroed.length === 1;
    if (zeroed.some(([k]) => k === "prevalence") && n(model.annualIncidence) > 0) {
      warn("prevalence", "Prevalence is 0%, so the treated population comes entirely from annual incidence. Results will look small rather than empty.");
    } else {
      warn(zeroed[0][0], `${which} ${only ? "is" : "are"} 0%, so no patient reaches treatment and every result will be zero.`);
    }
  }

  /* ---------------- comparators ---------------- */

  const current = Array.isArray(model.currentTreatments) ? model.currentTreatments : [];
  if (!current.length) {
    err("currentTreatments", "At least one current-care comparator is required.");
  } else {
    const sum = current.reduce((t, r) => t + (isNum(r?.marketShare) ? n(r.marketShare) : 0), 0);
    if (Math.abs(sum - 1) > 0.001) {
      err("currentTreatments", `Current-care market shares must total 100%. They currently total ${(sum * 100).toFixed(1)}%.`);
    }
    for (const r of current) {
      const name = r?.treatmentName || r?.treatmentCode || "A comparator";
      if (isNum(r?.adherence) && n(r.adherence) === 0) warn("currentTreatments", `${name} has 0% adherence, so it contributes no drug cost.`);
      if (isNum(r?.marketShare) && n(r.marketShare) < 0) err("currentTreatments", `${name} has a negative market share.`);
    }
    const allFree = current.every((r) =>
      ["annualDrugCost", "annualAdminCost", "annualMonitoringCost", "annualDeviceCost"]
        .every((k) => !isNum(r?.[k]) || n(r[k]) === 0));
    if (allFree) warn("currentTreatments", "Every comparator costs zero, so the new drug is compared against free care and the impact is its full price.");
  }

  /* ---------------- intervention ---------------- */

  const nw = model.newIntervention;
  if (!nw || typeof nw !== "object") {
    err("newIntervention", "A new intervention is required.");
  } else {
    for (const [k, label] of [["annualDrugCost", "Drug cost"], ["annualAdminCost", "Administration cost"],
                              ["annualMonitoringCost", "Monitoring cost"], ["annualDeviceCost", "Device cost"]]) {
      if (nw[k] !== undefined && nw[k] !== null && nw[k] !== "" && !isNum(nw[k])) err("newIntervention", `${label} must be a number.`);
      else if (isNum(nw[k]) && n(nw[k]) < 0) err("newIntervention", `${label} cannot be negative.`);
    }
    for (const [k, label] of [["adherence", "Adherence"], ["persistence", "Persistence"]]) {
      if (!isNum(nw[k])) continue;
      if (n(nw[k]) < 0 || n(nw[k]) > 1) err("newIntervention", `${label} must be between 0% and 100%.`);
      else if (n(nw[k]) === 0) warn("newIntervention", `${label} is 0%, so the new drug costs nothing and the result shows a saving.`);
    }
    const cost = ["annualDrugCost", "annualAdminCost", "annualMonitoringCost", "annualDeviceCost"]
      .reduce((t, k) => t + (isNum(nw[k]) ? n(nw[k]) : 0), 0);
    if (cost === 0) warn("newIntervention", "The new intervention costs nothing, so the result is a pure saving. Check the price is entered.");
  }

  /* ---------------- uptake ---------------- */

  const uptake = Array.isArray(model.uptake) ? model.uptake : [];
  if (!uptake.length) {
    err("uptake", "An uptake curve is required.");
  } else {
    for (const u of uptake) {
      if (!isNum(u?.uptake)) { err("uptake", `Year ${u?.year ?? "?"} uptake must be a number.`); continue; }
      if (n(u.uptake) < 0) err("uptake", `Year ${u.year} uptake cannot be negative.`);
      else if (n(u.uptake) > 1) err("uptake", `Year ${u.year} uptake cannot exceed 100%.`);
    }
    if (uptake.every((u) => isNum(u?.uptake) && n(u.uptake) === 0)) {
      warn("uptake", "Uptake is 0% in every year, so no patient starts the new drug and the impact is zero.");
    }
  }

  /* ---------------- outcomes ---------------- */

  const outcomes = Array.isArray(model.outcomes) ? model.outcomes : [];
  if (!outcomes.length) {
    warn("outcomes", "No clinical outcomes are defined, so there are no cost offsets and the budget impact is the drug bill alone.");
  }
  for (const o of outcomes) {
    const name = o?.outcomeName || o?.outcomeCode || "An outcome";
    if (isNum(o?.currentAnnualRate) && (n(o.currentAnnualRate) < 0 || n(o.currentAnnualRate) > 1)) {
      err("outcomes", `${name}: event rate must be between 0% and 100%.`);
    }
    if (isNum(o?.newRelativeRisk)) {
      if (n(o.newRelativeRisk) < 0) err("outcomes", `${name}: relative risk cannot be negative.`);
      else if (n(o.newRelativeRisk) > 1) warn("outcomes", `${name}: relative risk above 1.0 models the new drug as worse than current care.`);
    }
    if (isNum(o?.costPerEvent) && n(o.costPerEvent) < 0) err("outcomes", `${name}: cost per event cannot be negative.`);
  }

  return { ok: errors.length === 0, errors, warnings };
}

/** Convenience for callers that only need a yes/no plus the first problem. */
export function assertValidModel(model) {
  const { ok, errors } = validateModel(model);
  if (!ok) {
    const e = new Error(errors[0].message);
    e.field = errors[0].field;
    e.errors = errors;
    throw e;
  }
  return true;
}
