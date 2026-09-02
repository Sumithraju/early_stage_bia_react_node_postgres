import { calculateBudgetImpact } from "./biaEngine.js";

/**
 * One-way sensitivity analysis. Each parameter is moved down and up by `delta`
 * (default +/-20%) with everything else held fixed, and the resulting net
 * budget impact is recorded. Sorting by the swing gives a tornado: the top row
 * is the assumption the result depends on most. Early-stage evidence is
 * uncertain, so this is the analysis a payer reviewer looks for first.
 */
const clamp1 = (x) => Math.min(1, Math.max(0, x));

const PARAMS = [
  { key: "price", label: "New drug annual price", apply: (m, f) => { m.newIntervention.annualDrugCost *= f; } },
  { key: "uptake", label: "Market uptake", apply: (m, f) => { m.uptake = m.uptake.map((u) => ({ ...u, uptake: clamp1(u.uptake * f) })); } },
  { key: "prevalence", label: "Disease prevalence", apply: (m, f) => { m.prevalence *= f; } },
  { key: "incidence", label: "Annual incidence", apply: (m, f) => { m.annualIncidence = (m.annualIncidence || 0) * f; } },
  { key: "diagnosis", label: "Diagnosed share", apply: (m, f) => { m.diagnosisRate = clamp1(m.diagnosisRate * f); } },
  { key: "clinical", label: "Clinical eligibility", apply: (m, f) => { m.clinicalEligibility = clamp1(m.clinicalEligibility * f); } },
  { key: "adherence", label: "New drug adherence", apply: (m, f) => { m.newIntervention.adherence = clamp1((m.newIntervention.adherence ?? 1) * f); } },
  { key: "responder", label: "Responder rate", apply: (m, f) => { m.responderRate = clamp1((m.responderRate ?? 1) * f); } },
  { key: "aecost", label: "Event / AE cost", apply: (m, f) => { m.outcomes = m.outcomes.map((o) => ({ ...o, costPerEvent: o.costPerEvent * f })); } },
  { key: "population", label: "Covered population", apply: (m, f) => { m.coveredPopulation *= f; } },
];

function netImpact(model) {
  try {
    return calculateBudgetImpact(model).summary.netBudgetImpactTotal;
  } catch {
    return null;
  }
}

export function tornado(model, delta = 0.2) {
  const base = netImpact(model);

  const rows = PARAMS.map((param) => {
    const lo = structuredClone(model);
    param.apply(lo, 1 - delta);
    const low = netImpact(lo);

    const hi = structuredClone(model);
    param.apply(hi, 1 + delta);
    const high = netImpact(hi);

    if (low == null || high == null) return null;
    return {
      key: param.key,
      label: param.label,
      low,
      high,
      swing: Math.abs(high - low),
    };
  })
    .filter(Boolean)
    .sort((a, b) => b.swing - a.swing);

  return { base, delta, rows };
}
