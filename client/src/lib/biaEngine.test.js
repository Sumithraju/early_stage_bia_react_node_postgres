import { describe, it, expect } from "vitest";
import { calculateBudgetImpact, validateModelInput } from "./biaEngine.js";
import { tornado } from "./sensitivity.js";

/**
 * Hand-calculable base model: 1,000,000 covered lives, 10% prevalence, 50%
 * diagnosed, everything else 100%. Eligible year 1 = 1,000,000 × 0.10 × 0.50
 * = 50,000. One current therapy at zero cost, new drug at ₹100/yr, 100% uptake.
 */
function baseModel(overrides = {}) {
  return {
    modelName: "test", diseaseCode: "TEST", diseaseName: "Test", currency: "INR",
    perspective: "Government payer", countryName: "India",
    baseYear: 2026, timeHorizonYears: 1,
    coveredPopulation: 1_000_000, annualPopulationGrowth: 0,
    prevalence: 0.1, annualIncidence: 0, annualPrevalenceGrowth: 0, diagnosisRate: 0.5,
    clinicalEligibility: 1, payerEligibility: 1, accessRate: 1, willingnessRate: 1,
    responderRate: 1, weightRegainRate: 0,
    currentTreatments: [
      { treatmentCode: "CUR", treatmentName: "Current", marketShare: 1, annualDrugCost: 0, annualAdminCost: 0, annualMonitoringCost: 0, annualDeviceCost: 0, adherence: 1, persistence: 1 },
    ],
    newIntervention: { treatmentCode: "NEW", treatmentName: "New", annualDrugCost: 100, annualAdminCost: 0, annualMonitoringCost: 0, annualDeviceCost: 0, adherence: 1, persistence: 1 },
    uptake: [{ year: 1, uptake: 1 }],
    outcomes: [],
    ...overrides,
  };
}

describe("eligible population", () => {
  it("applies the full prevalence funnel", () => {
    const r = calculateBudgetImpact(baseModel());
    expect(r.summary.year1EligiblePatients).toBeCloseTo(50_000, 6);
  });
  it("narrows by each eligibility factor", () => {
    const r = calculateBudgetImpact(baseModel({ clinicalEligibility: 0.6, payerEligibility: 0.5 }));
    expect(r.summary.year1EligiblePatients).toBeCloseTo(50_000 * 0.6 * 0.5, 6);
  });
});

describe("incidence vs prevalence", () => {
  it("incidence adds new cases in later years only", () => {
    const r = calculateBudgetImpact(baseModel({ timeHorizonYears: 2, annualIncidence: 0.02, uptake: [{ year: 1, uptake: 1 }, { year: 2, uptake: 1 }] }));
    const [y1, y2] = r.annualResults;
    expect(y1.eligiblePatients).toBeCloseTo(50_000, 6);            // year 1 unaffected
    expect(y2.eligiblePatients).toBeCloseTo(1_000_000 * (0.1 + 0.02) * 0.5, 6); // +incidence
  });
});

describe("market share validation", () => {
  it("passes when shares total 1", () => {
    expect(validateModelInput(baseModel({ currentTreatments: [
      { treatmentCode: "A", treatmentName: "A", marketShare: 0.5, annualDrugCost: 0, adherence: 1, persistence: 1 },
      { treatmentCode: "B", treatmentName: "B", marketShare: 0.5, annualDrugCost: 0, adherence: 1, persistence: 1 },
    ] }))).toBe(true);
  });
  it("throws when shares do not total 1", () => {
    expect(() => validateModelInput(baseModel({ currentTreatments: [
      { treatmentCode: "A", treatmentName: "A", marketShare: 0.5, adherence: 1, persistence: 1 },
      { treatmentCode: "B", treatmentName: "B", marketShare: 0.4, adherence: 1, persistence: 1 },
    ] }))).toThrow(/sum to 1/);
  });
});

describe("drug cost and net impact", () => {
  it("net impact = new-market − current-market cost", () => {
    const r = calculateBudgetImpact(baseModel());
    // current = 0; new = 50,000 patients × ₹100 = 5,000,000
    expect(r.summary.currentCostTotal).toBeCloseTo(0, 4);
    expect(r.summary.newCostTotal).toBeCloseTo(5_000_000, 4);
    expect(r.summary.netBudgetImpactTotal).toBeCloseTo(5_000_000, 4);
  });
  it("cost per treated patient equals the new drug annual cost", () => {
    const r = calculateBudgetImpact(baseModel());
    expect(r.summary.costPerTreatedPatient).toBeCloseTo(100, 6);
  });
});

describe("cost offsets (avoided events)", () => {
  it("counts avoided events and their cost when relative risk < 1", () => {
    const r = calculateBudgetImpact(baseModel({
      outcomes: [{ outcomeCode: "E", outcomeName: "Event", currentAnnualRate: 0.1, newRelativeRisk: 0.5, costPerEvent: 1000 }],
    }));
    // avoided = 50,000 × 0.1 × (1 − 0.5) = 2,500 events; cost = 2,500,000
    expect(r.summary.eventsAvoidedTotal).toBeCloseTo(2_500, 4);
    expect(r.summary.hospitalCostAvoidedTotal).toBeCloseTo(2_500_000, 4);
    // net = new(5,000,000 drug + 2,500,000 medical) − current(5,000,000 medical) = 2,500,000
    expect(r.summary.netBudgetImpactTotal).toBeCloseTo(2_500_000, 4);
  });
});

describe("multi-year projection", () => {
  it("cumulative impact equals the sum of annual impacts", () => {
    const r = calculateBudgetImpact(baseModel({ timeHorizonYears: 3, uptake: [{ year: 1, uptake: 0.2 }, { year: 2, uptake: 0.4 }, { year: 3, uptake: 0.6 }] }));
    const sum = r.annualResults.reduce((a, x) => a + x.netBudgetImpact, 0);
    expect(r.summary.cumulativeImpactTotal).toBeCloseTo(sum, 2);
    expect(r.annualResults.at(-1).cumulativeImpact).toBeCloseTo(sum, 2);
  });
});

describe("PMPM", () => {
  it("= incremental annual impact / covered population / 12", () => {
    const r = calculateBudgetImpact(baseModel());
    expect(r.summary.year1PMPM).toBeCloseTo(5_000_000 / 1_000_000 / 12, 8);
    expect(r.summary.year1PMPY).toBeCloseTo(5_000_000 / 1_000_000, 8);
  });
});

describe("cost-component reconciliation", () => {
  it("category totals sum exactly to the scenario totals", () => {
    const r = calculateBudgetImpact(baseModel({
      currentTreatments: [{ treatmentCode: "C", treatmentName: "C", marketShare: 1, annualDrugCost: 40, annualAdminCost: 10, annualMonitoringCost: 5, adherence: 1, persistence: 1 }],
      outcomes: [{ outcomeCode: "E", outcomeName: "E", currentAnnualRate: 0.1, newRelativeRisk: 0.8, costPerEvent: 500 }],
    }));
    const sumCur = r.comparison.categories.reduce((a, c) => a + c.current, 0);
    const sumNew = r.comparison.categories.reduce((a, c) => a + c.new, 0);
    expect(sumCur).toBeCloseTo(r.summary.currentCostTotal, 2);
    expect(sumNew).toBeCloseTo(r.summary.newCostTotal, 2);
  });
});

describe("break-even price", () => {
  it("net impact is ~zero when the drug is priced at break-even", () => {
    const m = baseModel({ outcomes: [{ outcomeCode: "E", outcomeName: "E", currentAnnualRate: 0.2, newRelativeRisk: 0.5, costPerEvent: 400 }] });
    const be = calculateBudgetImpact(m).summary.breakEvenAnnualPrice;
    const atBreakEven = { ...m, newIntervention: { ...m.newIntervention, annualDrugCost: be } };
    expect(calculateBudgetImpact(atBreakEven).summary.netBudgetImpactTotal).toBeCloseTo(0, 2);
  });
});

describe("scenarios", () => {
  it("high uptake produces a larger impact than low", () => {
    const r = calculateBudgetImpact(baseModel({ timeHorizonYears: 3, uptake: [{ year: 1, uptake: 0.2 }, { year: 2, uptake: 0.3 }, { year: 3, uptake: 0.4 }] }));
    const byId = Object.fromEntries(r.scenarios.map((s) => [s.scenarioId, s.netBudgetImpactTotal]));
    expect(byId.HIGH).toBeGreaterThan(byId.BASE);
    expect(byId.BASE).toBeGreaterThan(byId.LOW);
  });
});

describe("sensitivity tornado", () => {
  it("ranks parameters by swing, price-dominated model puts price on top", () => {
    const t = tornado(baseModel());
    expect(t.rows[0].key).toBe("price");
    for (let i = 1; i < t.rows.length; i++) {
      expect(t.rows[i - 1].swing).toBeGreaterThanOrEqual(t.rows[i].swing);
    }
  });
});
