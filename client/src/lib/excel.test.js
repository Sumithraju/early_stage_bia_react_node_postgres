import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { importWorkbook } from "./excel.js";
import { defaultModelFor } from "./diseases.js";

/**
 * Import regressions.
 *
 * Both bugs here share a shape: importWorkbook() starts from a clone of the
 * model already on screen, so anything the workbook fails to overwrite is
 * silently inherited from the previous disease. A failed import and a
 * successful one look identical on screen — the number is simply wrong.
 */

/** Builds an in-memory workbook and wraps it in the File shape the importer wants. */
function workbook(sheets) {
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), name);
  }
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return { arrayBuffer: async () => buf };
}

const population = (rows) =>
  workbook({ Population: rows.map(([field, value]) => ({ field, value })) });

describe("annual incidence", () => {
  it("imports a raw fraction rather than keeping the disease default", async () => {
    const current = defaultModelFor("T2D");
    expect(current.annualIncidence).toBe(0.007); // the value that used to survive

    const { model } = await importWorkbook(
      population([["Annual incidence", 0.0034675]]),
      current
    );

    expect(model.annualIncidence).toBeCloseTo(0.0034675, 10);
  });

  it("keeps 0.007 as 0.007, which the field shows as 0.7%", async () => {
    const { model } = await importWorkbook(
      population([["Annual incidence", 0.007]]),
      defaultModelFor("T2D")
    );

    expect(model.annualIncidence).toBeCloseTo(0.007, 10);
    // PercentField's display transform: stored fraction to shown percentage.
    expect(+(model.annualIncidence * 100).toFixed(6)).toBe(0.7);
  });

  it("reads the whole population block for a non-obesity workbook", async () => {
    const { model } = await importWorkbook(
      population([
        ["Covered population", 100000],
        ["Prevalence", 0.03657],
        ["Annual prevalence growth", 0],
        ["Annual incidence", 0.0034675],
        ["Diagnosis", 1],
        ["Clinical eligibility", 1],
        ["Payer eligibility", 1],
        ["Access", 1],
        ["Willingness", 1],
      ]),
      defaultModelFor("T2D")
    );

    expect(model.coveredPopulation).toBe(100000);
    expect(model.prevalence).toBeCloseTo(0.03657, 10);
    expect(model.annualIncidence).toBeCloseTo(0.0034675, 10);
    expect(model.diagnosisRate).toBe(1);
    expect(model.clinicalEligibility).toBe(1);
    expect(model.payerEligibility).toBe(1);
    expect(model.accessRate).toBe(1);
    expect(model.willingnessRate).toBe(1);
  });

  it("treats a percent-suffixed text cell as a percentage", async () => {
    const { model } = await importWorkbook(
      population([["Annual incidence", "0.34675%"]]),
      defaultModelFor("T2D")
    );
    expect(model.annualIncidence).toBeCloseTo(0.0034675, 10);
  });
});

describe("imported treatments", () => {
  it("does not inherit the replaced comparator's device cost", async () => {
    const current = defaultModelFor("T2D");
    // Row 2 of the T2D default is basal insulin, which carries a pen cost.
    expect(current.currentTreatments[1].annualDeviceCost).toBe(3000);

    const { model } = await importWorkbook(
      workbook({
        Comparators: [
          { Treatment: "Dulaglutide", "Market share": 0.9928230675711914, "Annual drug cost": 234896 },
          { Treatment: "Tirzepatide", "Market share": 0.007176932428808498, "Annual drug cost": 331193 },
        ],
      }),
      current
    );

    const tirzepatide = model.currentTreatments[1];
    expect(tirzepatide.treatmentName).toBe("Tirzepatide");
    expect(tirzepatide.annualDeviceCost).toBe(0);
    expect(tirzepatide.annualAdminCost).toBe(0);
    expect(tirzepatide.annualMonitoringCost).toBe(0);
    expect(tirzepatide.adherence).toBe(1);
    expect(tirzepatide.persistence).toBe(1);
  });

  it("imports a device cost when the workbook states one", async () => {
    const { model } = await importWorkbook(
      workbook({
        Comparators: [
          { Treatment: "Basal insulin", "Market share": 1, "Annual drug cost": 18000, "Annual device cost": 3000 },
        ],
      }),
      defaultModelFor("T2D")
    );
    expect(model.currentTreatments[0].annualDeviceCost).toBe(3000);
  });

  it("does not let the new intervention inherit the previous drug's costs", async () => {
    const current = defaultModelFor("T2D");
    expect(current.newIntervention.annualMonitoringCost).toBeGreaterThan(0);

    const { model } = await importWorkbook(
      workbook({
        NewIntervention: [{ Treatment: "Semaglutide", "Annual drug cost": 231265 }],
      }),
      current
    );

    expect(model.newIntervention.treatmentName).toBe("Semaglutide");
    expect(model.newIntervention.annualDrugCost).toBe(231265);
    expect(model.newIntervention.annualAdminCost).toBe(0);
    expect(model.newIntervention.annualMonitoringCost).toBe(0);
    expect(model.newIntervention.annualDeviceCost).toBe(0);
    expect(model.newIntervention.adherence).toBe(1);
    expect(model.newIntervention.persistence).toBe(1);
  });
});
