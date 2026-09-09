import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { importWorkbook } from "./excel.js";
import { calculateBudgetImpact } from "./biaEngine.js";
import { validateModel } from "../../../shared/modelValidation.js";
import { defaultModelFor } from "./diseases.js";

/**
 * Literature validation against the two benchmark workbooks in docs/validation.
 *
 * These run the real files through the real importer rather than a hand-built
 * model, because the bug they guard was never in the arithmetic. The engine
 * produced these figures all along; the importer dropped fields and the
 * population silently stayed on the previous disease's defaults. A test built
 * from a model object would have passed while the application was wrong.
 *
 * Both workbooks were regenerated with an explicit "Annual incidence" row.
 * Without it the field is not mentioned anywhere in the sheet, so the importer
 * — which treats a partial workbook as a partial update — leaves the previous
 * disease's incidence in place. On the T2D file that stacked a 0.7% incidence
 * on top of the CAGR the workbook already uses, and the 2029 eligible pool came
 * out at 7,844 instead of 5,044.
 *
 * No figure below is written into the engine. Each is what the engine computes
 * from the workbook, checked against the benchmark the workbook itself cites.
 */

const read = (name) => {
  const path = new URL(`../../../docs/validation/${name}`, import.meta.url);
  const buf = fs.readFileSync(path);
  return { arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) };
};

/** Imported onto a different disease, so any inherited default shows up. */
const load = (name, startFrom) => importWorkbook(read(name), defaultModelFor(startFrom));

const within = (actual, expected, tolerance = 1e-4) =>
  expect(Math.abs(actual - expected) / Math.abs(expected)).toBeLessThan(tolerance);

/* ------------------------------------------------------------------ T2D */
/**
 * Thakur L, Bisen R, Puthran D. Budget Impact Analysis of GLP-1 Receptor
 * Agonists for Type 2 Diabetes Management in India.
 * Value in Health / ISPOR Europe 2025. doi:10.1016/j.jval.2025.09.469
 *
 * The workbook reaches the published 2029 endpoint with a CAGR on the eligible
 * share (8.370862%) rather than an incidence term — its Evidence sheet records
 * that as "derived for template compatibility". Incidence must therefore be 0,
 * or the two mechanisms compound.
 */
const T2D = "BIET_T2D_India_GLP1_ISPOR_2025.xlsx";

describe("ISPOR 2025 · GLP-1 in Indian T2D · import", () => {
  it("carries an explicit zero incidence, so the CAGR is the only growth term", async () => {
    const { model } = await load(T2D, "OBESITY");
    expect(model.annualIncidence).toBe(0);
    expect(model.annualPrevalenceGrowth).toBeCloseTo(0.08370862388813394, 12);
  });

  it("lands every population input rather than inheriting obesity defaults", async () => {
    const { model } = await load(T2D, "OBESITY");
    expect(model.coveredPopulation).toBe(100000);
    expect(model.prevalence).toBeCloseTo(0.03657, 10);
    expect(model.annualPopulationGrowth).toBe(0);
    for (const k of ["diagnosisRate", "clinicalEligibility", "payerEligibility", "accessRate", "willingnessRate"]) {
      expect(model[k]).toBe(1);
    }
  });

  it("lands the treatments with no cost inherited from the replaced rows", async () => {
    const { model } = await load(T2D, "T2D");
    const [dula, tirze] = model.currentTreatments;

    expect(model.currentTreatments).toHaveLength(2);
    expect(dula.treatmentName).toBe("Dulaglutide");
    expect(dula.annualDrugCost).toBe(234896);
    expect(tirze.treatmentName).toBe("Tirzepatide");
    expect(tirze.annualDrugCost).toBe(331193);
    expect(model.newIntervention.annualDrugCost).toBe(231265);

    // The workbook has no device-cost column at all, and row two of the T2D
    // default is basal insulin at 3000. Tirzepatide must not pick that up.
    for (const row of [dula, tirze, model.newIntervention]) {
      expect(row.annualDeviceCost).toBe(0);
      expect(row.annualAdminCost).toBe(0);
      expect(row.annualMonitoringCost).toBe(0);
      expect(row.adherence).toBe(1);
      expect(row.persistence).toBe(1);
    }
  });

  it("passes validation without the double-counted-growth warning", async () => {
    const { model } = await load(T2D, "T2D");
    const v = validateModel(model);
    expect(v.ok).toBe(true);
    expect(v.warnings.some((w) => /double-count population growth/.test(w.message))).toBe(false);
  });
});

describe("ISPOR 2025 · GLP-1 in Indian T2D · calculated", () => {
  it("moves the eligible pool from the published 2025 to the published 2029 endpoint", async () => {
    const { model } = await load(T2D, "T2D");
    const eligible = calculateBudgetImpact(model).annualResults.map((r) => r.eligiblePatients);
    expect(eligible).toHaveLength(5);
    expect(eligible[0]).toBeCloseTo(3657, 6);
    expect(eligible[4]).toBeCloseTo(5044, 6);
  });

  it("reproduces the per-drug spend recorded on the workbook's Evidence sheet", async () => {
    const { model } = await load(T2D, "T2D");
    const { summary, annualResults } = calculateBudgetImpact(model);

    const patientYears = annualResults.reduce((t, r) => t + r.eligiblePatients, 0);
    const uptake = model.uptake[0].uptake;
    const [dula, tirze] = model.currentTreatments;

    within(patientYears * uptake * model.newIntervention.annualDrugCost, 3_447_884_379);
    within(patientYears * (1 - uptake) * dula.marketShare * dula.annualDrugCost, 1_563_575_474);
    within(patientYears * (1 - uptake) * tirze.marketShare * tirze.annualDrugCost, 15_936_442);

    // Those three are the whole with-intervention market.
    within(summary.newCostTotal, 3_447_884_379 + 1_563_575_474 + 15_936_442);
  });

  it("returns a saving, reported as an offset rather than a zero-difference driver", async () => {
    const { model } = await load(T2D, "T2D");
    const { summary } = calculateBudgetImpact(model);

    within(summary.currentCostTotal, 5_091_833_888);
    within(summary.newCostTotal, 5_027_396_296);
    within(summary.netBudgetImpactTotal, -64_437_593);
    within(summary.breakEvenAnnualPrice, 235_587);
    expect(summary.year1PMPM).toBeCloseTo(-9.09, 2);
    expect(summary.peakTreatedPatients).toBeCloseTo(3479.33, 1);

    expect(summary.biggestDriver).toBeNull();
    expect(summary.biggestOffset.key).toBe("drug");
  });

  it("would double-count if the workbook omitted its incidence row", async () => {
    // The failure the explicit zero prevents: 0.7% from the T2D default
    // stacking on top of the workbook's own CAGR.
    const { model } = await load(T2D, "T2D");
    const contaminated = { ...model, annualIncidence: defaultModelFor("T2D").annualIncidence };

    const v = validateModel(contaminated);
    expect(v.ok).toBe(true); // non-blocking, by design
    expect(v.warnings.some((w) => /double-count population growth/.test(w.message))).toBe(true);

    const eligible = calculateBudgetImpact(contaminated).annualResults.map((r) => r.eligiblePatients);
    expect(eligible[4]).toBeGreaterThan(7000); // 7,844 against the published 5,044
  });
});

/* -------------------------------------------------------------- Obesity */
/**
 * Hwang JH et al. Fiscal Impact of Expanded Medicare Coverage for GLP-1
 * Receptor Agonists to Treat Obesity. JAMA Health Forum. 2025;6(4):e250905.
 * doi:10.1001/jamahealthforum.2025.0905
 *
 * The workbook reconstructs the medication-budget component only. The paper's
 * net fiscal impact also runs a DOC-M microsimulation for downstream savings,
 * which is out of scope for a budget impact tool and is not modelled here.
 */
const OBESITY = "BIET_Obesity_Medicare_GLP1_JAMA_2025.xlsx";

describe("JAMA 2025 · Medicare GLP-1 coverage", () => {
  it("lands the Part D population and the blended annual price", async () => {
    const { model } = await load(OBESITY, "T2D");
    expect(model.coveredPopulation).toBe(15_600_000);
    expect(model.prevalence).toBe(1);
    expect(model.annualPopulationGrowth).toBeCloseTo(0.07456993182354199, 12);
    expect(model.currency).toBe("USD");
    expect(model.newIntervention.annualDrugCost).toBe(7324);
    expect(model.currentTreatments).toHaveLength(1);
    expect(model.currentTreatments[0].annualDrugCost).toBe(0);
  });

  it("tracks the published cumulative medication expenditure year by year", async () => {
    const { model } = await load(OBESITY, "OBESITY");
    const { annualResults, summary } = calculateBudgetImpact(model);

    // 2026 through 2030, in billions, as published.
    const expected = [11.3, 16.0, 21.2, 26.5, 32.0];
    let running = 0;
    annualResults.forEach((r, i) => {
      running += r.newScenarioCost;
      expect(running / 1e9).toBeCloseTo(expected[i], 1);
    });

    within(summary.newCostTotal, 32_000_000_000, 1e-3);
    // Current care in this reconstruction is lifestyle modification at no cost,
    // so the whole medication budget is the net impact.
    expect(summary.currentCostTotal).toBe(0);
  });
});
