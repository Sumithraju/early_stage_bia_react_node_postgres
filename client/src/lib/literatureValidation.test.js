import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { importWorkbook } from "./excel.js";
import { calculateBudgetImpact } from "./biaEngine.js";
import { defaultModelFor } from "./diseases.js";

/**
 * Literature validation: GLP-1 receptor agonists for type 2 diabetes in India.
 *
 * Thakur L, Bisen R, Puthran D. Value in Health / ISPOR Europe 2025.
 * doi:10.1016/j.jval.2025.09.469
 *
 * This is an end-to-end acceptance test, deliberately run through
 * importWorkbook() rather than against a hand-built model object. The bug it
 * guards was never in the arithmetic: the engine produced these figures all
 * along, but the importer dropped annual incidence and the population stayed
 * on the previous disease's default. Constructing the model directly would
 * pass while the application still gave the wrong answer.
 *
 * Incidence is derived from the paper's own published eligible-population
 * endpoints, not fitted to the expected output:
 *   (5044 - 3657) / 4 / 100000 = 0.0034675 per year.
 *
 * The expected values below are what the engine computes from these inputs.
 * None is written into the engine, and none is a figure quoted by the paper —
 * the paper's own total is ~₹501.6 Cr against ~₹506.0 Cr here, because the
 * full annual market-share schedule behind it was never published.
 */

const INPUTS = {
  Setup: [
    ["Disease", "Type 2 diabetes"],
    ["Country", "India"],
    ["Currency", "INR"],
    ["Perspective", "Government payer"],
    ["Base year", 2025],
    ["Time horizon (years)", 5],
  ],
  Population: [
    ["Covered population", 100000],
    ["Annual population growth", 0],
    ["Prevalence", 0.03657],
    ["Annual prevalence growth", 0],
    ["Annual incidence", 0.0034675],
    ["Diagnosis", 1],
    ["Clinical eligibility", 1],
    ["Payer eligibility", 1],
    ["Access", 1],
    ["Willingness", 1],
  ],
};

const COMPARATORS = [
  { Treatment: "Dulaglutide", "Market share": 0.9928230675711914, "Annual drug cost": 234896,
    "Annual admin cost": 0, "Annual monitoring cost": 0, "Annual device cost": 0, Adherence: 1, Persistence: 1 },
  { Treatment: "Tirzepatide", "Market share": 0.007176932428808498, "Annual drug cost": 331193,
    "Annual admin cost": 0, "Annual monitoring cost": 0, "Annual device cost": 0, Adherence: 1, Persistence: 1 },
];

const INTERVENTION = [
  { Treatment: "Semaglutide", "Annual drug cost": 231265, "Annual admin cost": 0,
    "Annual monitoring cost": 0, "Annual device cost": 0, Adherence: 1, Persistence: 1 },
];

const UPTAKE = [1, 2, 3, 4, 5].map((Year) => ({ Year, Uptake: 0.6897950814645228 }));

function isporWorkbook() {
  const wb = XLSX.utils.book_new();
  for (const [sheet, rows] of Object.entries(INPUTS)) {
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(rows.map(([field, value]) => ({ field, value }))),
      sheet
    );
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(COMPARATORS), "Comparators");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(INTERVENTION), "NewIntervention");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(UPTAKE), "Uptake");
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return { arrayBuffer: async () => buf };
}

/** Imported onto the obesity default, so nothing T2D-shaped can leak in. */
async function importedModel() {
  const { model } = await importWorkbook(isporWorkbook(), defaultModelFor("OBESITY"));
  // The workbook carries no Outcomes sheet, and this benchmark validates the
  // medication budget alone, so no clinical event costs are added.
  model.outcomes = [];
  return model;
}

describe("ISPOR 2025 GLP-1 India — import", () => {
  it("lands every population input the calculation depends on", async () => {
    const model = await importedModel();
    expect(model.coveredPopulation).toBe(100000);
    expect(model.prevalence).toBeCloseTo(0.03657, 10);
    expect(model.annualPrevalenceGrowth).toBe(0);
    expect(model.annualIncidence).toBeCloseTo(0.0034675, 10);
    for (const k of ["diagnosisRate", "clinicalEligibility", "payerEligibility", "accessRate", "willingnessRate"]) {
      expect(model[k]).toBe(1);
    }
  });

  it("lands the treatments without obesity costs bleeding through", async () => {
    const model = await importedModel();
    const [dula, tirze] = model.currentTreatments;

    expect(model.currentTreatments).toHaveLength(2);
    expect(dula.treatmentName).toBe("Dulaglutide");
    expect(dula.annualDrugCost).toBe(234896);
    expect(tirze.treatmentName).toBe("Tirzepatide");
    expect(tirze.annualDrugCost).toBe(331193);
    expect(model.newIntervention.annualDrugCost).toBe(231265);

    for (const row of [dula, tirze, model.newIntervention]) {
      expect(row.annualAdminCost).toBe(0);
      expect(row.annualMonitoringCost).toBe(0);
      expect(row.annualDeviceCost).toBe(0);
      expect(row.adherence).toBe(1);
      expect(row.persistence).toBe(1);
    }
  });
});

describe("ISPOR 2025 GLP-1 India — calculated outputs", () => {
  it("grows the eligible pool from 3,657 to 5,044 on incidence alone", async () => {
    const { annualResults } = calculateBudgetImpact(await importedModel());
    const eligible = annualResults.map((r) => r.eligiblePatients);

    expect(eligible).toHaveLength(5);
    expect(eligible[0]).toBeCloseTo(3657, 6);
    expect(eligible[1]).toBeCloseTo(4003.75, 6);
    expect(eligible[2]).toBeCloseTo(4350.5, 6);
    expect(eligible[3]).toBeCloseTo(4697.25, 6);
    expect(eligible[4]).toBeCloseTo(5044, 6);
  });

  it("reproduces the published budget envelope", async () => {
    const { summary } = calculateBudgetImpact(await importedModel());

    expect(summary.year1EligiblePatients).toBeCloseTo(3657, 6);
    expect(summary.peakTreatedPatients).toBeCloseTo(3479.33, 1);

    // Money to within 0.01% — the arithmetic is deterministic, the tolerance
    // is only here to keep the test off the last float digit.
    const near = (actual, expected) =>
      expect(Math.abs(actual - expected) / Math.abs(expected)).toBeLessThan(1e-4);

    near(summary.currentCostTotal, 5_124_608_764);
    near(summary.newCostTotal, 5_059_756_402);
    near(summary.netBudgetImpactTotal, -64_852_362);
    near(summary.breakEvenAnnualPrice, 235_587);

    expect(summary.year1PMPM).toBeCloseTo(-9.09, 2);
  });

  it("reports the saving as an offset, not a phantom zero driver", async () => {
    const { summary } = calculateBudgetImpact(await importedModel());
    // Only drug acquisition moves, and it moves down.
    expect(summary.biggestDriver).toBeNull();
    expect(summary.biggestOffset.key).toBe("drug");
    expect(summary.biggestOffset.diff).toBeLessThan(0);
  });
});
