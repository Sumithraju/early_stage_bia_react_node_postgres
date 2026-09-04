import { describe, expect, it } from "vitest";
import { validateModel } from "../../../shared/modelValidation.js";
import { demoScenario } from "./diseases.js";

/**
 * Negative-path coverage. The engine never produces NaN or Infinity -- num()
 * and clamp01 see to that -- so the risk is not a crash, it is a confident
 * wrong answer. A zeroed eligibility rate returns "no budget impact", which
 * reads exactly like a real finding. These tests pin down which inputs are
 * refused outright and which are allowed through with the answer flagged.
 */
const model = (mutate) => {
  const m = demoScenario();
  mutate?.(m);
  return m;
};
const blocks = (m, re) => {
  const v = validateModel(m);
  expect(v.ok).toBe(false);
  expect(v.errors.some((e) => re.test(e.message))).toBe(true);
};
const warns = (m, re) => {
  const v = validateModel(m);
  expect(v.ok).toBe(true);
  expect(v.warnings.some((w) => re.test(w.message))).toBe(true);
};

describe("no false positives", () => {
  it("the demo scenario is clean", () => {
    const v = validateModel(model());
    expect(v.errors).toEqual([]);
    expect(v.warnings).toEqual([]);
  });
});

describe("blocked — the result would be meaningless", () => {
  it("zero covered population", () => blocks(model((m) => (m.coveredPopulation = 0)), /greater than zero/));
  it("negative covered population", () => blocks(model((m) => (m.coveredPopulation = -1000)), /greater than zero/));
  it("non-numeric population", () => blocks(model((m) => (m.coveredPopulation = "eight million")), /must be a number/));
  it("blank population", () => blocks(model((m) => (m.coveredPopulation = "")), /must be a number/));
  it("zero time horizon", () => blocks(model((m) => (m.timeHorizonYears = 0)), /at least 1 year/));
  it("time horizon beyond the cap", () => blocks(model((m) => (m.timeHorizonYears = 200)), /capped at 10 years/));
  it("a rate above 100%", () => blocks(model((m) => (m.prevalence = 5)), /cannot exceed 100%/));
  it("a negative rate", () => blocks(model((m) => (m.diagnosisRate = -0.2)), /cannot be negative/));
  it("market shares that do not total 100%", () =>
    blocks(model((m) => (m.currentTreatments[0].marketShare = 0.5)), /must total 100%/));
  it("no comparators", () => blocks(model((m) => (m.currentTreatments = [])), /at least one current-care comparator/i));
  it("no intervention", () => blocks(model((m) => (m.newIntervention = null)), /new intervention is required/i));
  it("negative drug cost", () => blocks(model((m) => (m.newIntervention.annualDrugCost = -5000)), /cannot be negative/));
  it("uptake above 100%", () =>
    blocks(model((m) => (m.uptake = m.uptake.map((u) => ({ ...u, uptake: 3 })))), /cannot exceed 100%/));
  it("negative cost per event", () => blocks(model((m) => (m.outcomes[0].costPerEvent = -100)), /cannot be negative/));
  it("no model at all", () => blocks(null, /no model supplied/i));
});

describe("warned — arithmetic is sound, the answer probably is not intended", () => {
  it("a zeroed funnel step collapses everything to zero", () =>
    warns(model((m) => (m.accessRate = 0)), /no patient reaches treatment/));
  it("zero prevalence leaves only incidence", () =>
    warns(model((m) => (m.prevalence = 0)), /entirely from annual incidence/));
  it("zero uptake in every year", () =>
    warns(model((m) => (m.uptake = m.uptake.map((u) => ({ ...u, uptake: 0 })))), /no patient starts/));
  it("a free intervention reads as a saving", () =>
    warns(model((m) => {
      m.newIntervention.annualDrugCost = 0;
      m.newIntervention.annualAdminCost = 0;
      m.newIntervention.annualMonitoringCost = 0;
      m.newIntervention.annualDeviceCost = 0;
    }), /costs nothing/));
  it("zero adherence on the new drug", () =>
    warns(model((m) => (m.newIntervention.adherence = 0)), /Adherence is 0%/));
  it("no outcomes means no cost offsets", () => warns(model((m) => (m.outcomes = [])), /no cost offsets/));
  it("relative risk above 1 models the drug as worse", () =>
    warns(model((m) => m.outcomes.forEach((o) => (o.newRelativeRisk = 5))), /worse than current care/));
  it("free comparators overstate the impact", () =>
    warns(model((m) => m.currentTreatments.forEach((t) => {
      t.annualDrugCost = 0; t.annualAdminCost = 0; t.annualMonitoringCost = 0; t.annualDeviceCost = 0;
    })), /compared against free care/));
});
