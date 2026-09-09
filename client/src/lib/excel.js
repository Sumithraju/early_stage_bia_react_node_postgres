/**
 * SheetJS is ~600 kB and only needed when a user actually imports or exports a
 * workbook, so it is pulled in on demand rather than in the initial bundle.
 */
let xlsxPromise = null;
const loadXLSX = () => (xlsxPromise ??= import("xlsx"));

/**
 * Excel import/export, entirely in the browser. Sheets are key/value pairs
 * (field | value) except the two tables, which are row-per-record. Anything
 * missing from the workbook keeps its current value, so a partial sheet is a
 * valid partial update rather than an error.
 */

const KV_SHEETS = {
  Setup: [
    ["therapyArea", "Therapy area"],
    ["diseaseName", "Disease"],
    ["subgroup", "Subgroup"],
    ["perspective", "Perspective"],
    ["countryName", "Country"],
    ["currency", "Currency"],
    ["baseYear", "Base year"],
    ["timeHorizonYears", "Time horizon (years)"],
  ],
  Population: [
    ["coveredPopulation", ["Covered population", "Covered lives", "Population"]],
    ["ageMin", "Age minimum"],
    ["ageMax", "Age maximum"],
    ["annualPopulationGrowth", "Annual population growth"],
    // The template writes the obesity spelling, but a workbook built for
    // another disease names its own prevalence row. Accept the alternatives:
    // an unmatched label silently keeps the previous disease's default, which
    // is indistinguishable from a successful import.
    ["prevalence", ["Obesity prevalence", "Prevalence", "Initial prevalence", "Disease prevalence"]],
    ["annualPrevalenceGrowth", ["Annual prevalence growth", "Prevalence growth"]],
    ["annualIncidence", ["Annual incidence", "Incidence"]],
    ["diagnosisRate", ["Diagnosed share", "Diagnosis", "Diagnosis rate", "Diagnosed"]],
    ["bmiThreshold", "BMI threshold"],
    ["clinicalEligibility", ["Clinical eligibility", "Clinically eligible"]],
    ["payerEligibility", ["Payer eligibility", "Payer eligible"]],
    ["accessRate", ["Access rate", "Access", "Able to access"]],
    ["willingnessRate", ["Willingness to treat", "Willingness", "Willing to treat"]],
  ],
  Behaviour: [
    ["expectedWeightLossPct", "Expected weight loss"],
    ["responderRate", "Responder rate"],
    ["weightRegainRate", "Annual weight regain"],
  ],
};

const TREATMENT_COLUMNS = [
  ["treatmentName", "Treatment"],
  ["marketShare", "Market share"],
  ["annualDrugCost", "Annual drug cost"],
  ["annualAdminCost", "Annual admin cost"],
  ["annualMonitoringCost", "Annual monitoring cost"],
  ["annualDeviceCost", "Annual device cost"],
  ["adherence", "Adherence"],
  ["persistence", "Persistence"],
  ["discontinuation", "Discontinuation"],
];

/**
 * Every field the cost arithmetic reads. An imported treatment row starts from
 * these and not from the row it replaces: a workbook that omits device cost
 * must give 0, not the previous disease's insulin-pen cost.
 */
const TREATMENT_DEFAULTS = {
  annualDrugCost: 0,
  annualAdminCost: 0,
  annualMonitoringCost: 0,
  annualDeviceCost: 0,
  adherence: 1,
  persistence: 1,
  discontinuation: 0,
};

/** A spec label may carry aliases; the first is the one the template writes. */
const labelsOf = (label) => (Array.isArray(label) ? label : [label]);

const OUTCOME_COLUMNS = [
  ["outcomeName", "Outcome"],
  ["currentAnnualRate", "Current annual rate"],
  ["newRelativeRisk", "Relative risk on new drug"],
  ["costPerEvent", "Cost per event"],
];

function sheetToRows(XLSX, wb, name) {
  const ws = wb.Sheets[name];
  return ws ? XLSX.utils.sheet_to_json(ws, { defval: null }) : null;
}

function numeric(value) {
  if (value === null || value === undefined || value === "") return null;
  const text = String(value).trim();
  const n = Number(text.replace(/[,%\s₹$]/g, ""));
  if (!Number.isFinite(n)) return null;
  // A numeric cell formatted as a percentage arrives already divided, but a
  // text cell keeps its sign: "0.35%" is 0.0035, not 0.35.
  return text.endsWith("%") ? n / 100 : n;
}

function readKeyValueSheet(XLSX, wb, sheetName, spec, target) {
  const rows = sheetToRows(XLSX, wb, sheetName);
  if (!rows) return 0;

  const byLabel = new Map();
  for (const row of rows) {
    const label = String(row.field ?? row.Field ?? row.Parameter ?? "").trim().toLowerCase();
    if (label) byLabel.set(label, row.value ?? row.Value);
  }

  let applied = 0;
  for (const [key, label] of spec) {
    let raw;
    for (const alias of labelsOf(label)) {
      raw = byLabel.get(alias.toLowerCase());
      if (raw !== undefined && raw !== null && raw !== "") break;
    }
    if (raw === undefined || raw === null || raw === "") continue;

    const asNumber = numeric(raw);
    target[key] = asNumber === null ? String(raw) : asNumber;
    applied += 1;
  }
  return applied;
}

function readTable(XLSX, wb, sheetName, columns) {
  const rows = sheetToRows(XLSX, wb, sheetName);
  if (!rows || !rows.length) return null;

  return rows
    .map((row) => {
      const out = {};
      for (const [key, label] of columns) {
        let raw;
        for (const alias of labelsOf(label)) {
          raw = row[alias];
          if (raw !== undefined && raw !== null && raw !== "") break;
        }
        raw = raw ?? row[key];
        if (raw === undefined || raw === null || raw === "") continue;
        const asNumber = numeric(raw);
        out[key] = key.endsWith("Name") ? String(raw) : asNumber ?? String(raw);
      }
      return out;
    })
    .filter((row) => row.treatmentName || row.outcomeName);
}

/** Returns { model, applied, warnings } - never throws on a partial workbook. */
export async function importWorkbook(file, currentModel) {
  const XLSX = await loadXLSX();
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array" });

  const model = structuredClone(currentModel);
  const warnings = [];
  let applied = 0;

  for (const [sheetName, spec] of Object.entries(KV_SHEETS)) {
    if (!wb.Sheets[sheetName]) {
      warnings.push(`Sheet "${sheetName}" not found - kept current values.`);
      continue;
    }
    applied += readKeyValueSheet(XLSX, wb, sheetName, spec, model);
  }

  const comparators = readTable(XLSX, wb, "Comparators", TREATMENT_COLUMNS);
  if (comparators?.length) {
    model.currentTreatments = comparators.map((row, i) => ({
      treatmentCode: currentModel.currentTreatments?.[i]?.treatmentCode || `CMP_${i + 1}`,
      treatmentName: `Comparator ${i + 1}`,
      ...TREATMENT_DEFAULTS,
      marketShare: 0, // comparators only: an intervention has no share of its own

      ...row,
    }));
    applied += comparators.length;
  }

  const intervention = readTable(XLSX, wb, "NewIntervention", TREATMENT_COLUMNS);
  if (intervention?.length) {
    model.newIntervention = {
      treatmentCode: currentModel.newIntervention?.treatmentCode || "NEW_DRUG",
      treatmentName: currentModel.newIntervention?.treatmentName || "New intervention",
      ...TREATMENT_DEFAULTS,
      ...intervention[0],
    };
    applied += 1;
  }

  const outcomes = readTable(XLSX, wb, "Outcomes", OUTCOME_COLUMNS);
  if (outcomes?.length) {
    model.outcomes = outcomes.map((row, i) => ({
      outcomeCode: currentModel.outcomes[i]?.outcomeCode || `OUT_${i + 1}`,
      ...row,
    }));
    applied += outcomes.length;
  }

  const uptake = sheetToRows(XLSX, wb, "Uptake");
  if (uptake?.length) {
    const parsed = uptake
      .map((row) => ({
        year: numeric(row.Year ?? row.year),
        uptake: numeric(row.Uptake ?? row.uptake),
      }))
      .filter((row) => row.year && row.uptake !== null);
    if (parsed.length) {
      model.uptake = parsed;
      applied += parsed.length;
    }
  }

  if (!applied) {
    throw new Error(
      "No recognised sheets found. Download the template to see the expected format."
    );
  }

  return { model, applied, warnings };
}

/** Builds a template pre-filled with the model currently on screen. */
export async function downloadTemplate(model) {
  const XLSX = await loadXLSX();
  const wb = XLSX.utils.book_new();

  for (const [sheetName, spec] of Object.entries(KV_SHEETS)) {
    const rows = spec.map(([key, label]) => ({ field: labelsOf(label)[0], value: model[key] ?? "" }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), sheetName);
  }

  const treatmentRows = (list) =>
    list.map((t) =>
      Object.fromEntries(TREATMENT_COLUMNS.map(([key, label]) => [labelsOf(label)[0], t[key] ?? 0]))
    );

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(treatmentRows(model.currentTreatments)),
    "Comparators"
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(treatmentRows([model.newIntervention])),
    "NewIntervention"
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      model.uptake.map((u) => ({ Year: u.year, Uptake: u.uptake }))
    ),
    "Uptake"
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      model.outcomes.map((o) =>
        Object.fromEntries(OUTCOME_COLUMNS.map(([key, label]) => [labelsOf(label)[0], o[key] ?? 0]))
      )
    ),
    "Outcomes"
  );

  XLSX.writeFile(wb, "BIET-input-template.xlsx");
}

/**
 * Export the full analysis as a multi-sheet workbook. Numbers are written as
 * raw values (not formatted strings) so a payer can pivot and re-use them.
 * jsPDF's rupee problem does not apply here — Excel renders the symbol fine —
 * but the currency is named in a column for clarity.
 */
export async function exportResultsExcel(model, result, sensitivity) {
  const XLSX = await loadXLSX();
  const wb = XLSX.utils.book_new();
  const cur = model.currency;
  const s = result.summary;

  const add = (name, rows) =>
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), name);

  add("Summary", [
    { Metric: "Disease", Value: model.diseaseName },
    { Metric: "Country", Value: model.countryName },
    { Metric: "Perspective", Value: model.perspective },
    { Metric: "Currency", Value: cur },
    { Metric: "Time horizon (years)", Value: model.timeHorizonYears },
    { Metric: "Eligible patients (year 1)", Value: Math.round(s.year1EligiblePatients) },
    { Metric: "Patients treated (peak)", Value: Math.round(s.peakTreatedPatients) },
    { Metric: "Current market cost (total)", Value: Math.round(s.currentCostTotal) },
    { Metric: "New market cost (total)", Value: Math.round(s.newCostTotal) },
    { Metric: "Net budget impact (total)", Value: Math.round(s.netBudgetImpactTotal) },
    { Metric: "Cumulative impact", Value: Math.round(s.cumulativeImpactTotal) },
    { Metric: "PMPM (year 1)", Value: +s.year1PMPM.toFixed(4) },
    { Metric: "PMPY (year 1)", Value: +s.year1PMPY.toFixed(2) },
    { Metric: "PPPM (year 1)", Value: +s.year1PPPM.toFixed(2) },
    { Metric: "Cost per treated patient", Value: Math.round(s.costPerTreatedPatient) },
    { Metric: "Break-even annual price", Value: s.breakEvenAnnualPrice == null ? "n/a" : Math.round(s.breakEvenAnnualPrice) },
    { Metric: "Events avoided (total)", Value: Math.round(s.eventsAvoidedTotal) },
    { Metric: "Hospital cost avoided (total)", Value: Math.round(s.hospitalCostAvoidedTotal) },
  ]);

  add("Year by year", result.annualResults.map((r) => ({
    Year: r.calendarYear,
    "Patients treated": Math.round(r.newInterventionPatients),
    Uptake: +r.uptake.toFixed(4),
    "Without intervention": Math.round(r.currentScenarioCost),
    "With intervention": Math.round(r.newScenarioCost),
    "Net impact": Math.round(r.netBudgetImpact),
    Cumulative: Math.round(r.cumulativeImpact),
    PMPM: +r.pmpm.toFixed(4),
  })));

  add("Current vs new", result.comparison.categories.map((c) => ({
    "Cost component": c.label,
    "Without intervention": Math.round(c.current),
    "With intervention": Math.round(c.new),
    Difference: Math.round(c.diff),
  })).concat([{
    "Cost component": "TOTAL",
    "Without intervention": Math.round(result.comparison.totalCurrent),
    "With intervention": Math.round(result.comparison.totalNew),
    Difference: Math.round(result.comparison.difference),
  }]));

  add("Scenarios", result.scenarios.map((sc) => ({
    Scenario: sc.label,
    "Uptake vs base": `${(sc.uptakeScale * 100).toFixed(0)}%`,
    "Patient-years": Math.round(sc.treatedPatientYears),
    "Net impact": Math.round(sc.netBudgetImpactTotal),
    "Year 1 PMPM": +sc.year1PMPM.toFixed(4),
  })));

  if (sensitivity?.rows) {
    add("Sensitivity", sensitivity.rows.map((r) => ({
      Parameter: r.label,
      "Net impact at -20%": Math.round(r.low),
      "Net impact at +20%": Math.round(r.high),
      Swing: Math.round(r.swing),
    })));
  }

  add("Assumptions", [
    { Parameter: "Covered population", Value: model.coveredPopulation, Unit: "people" },
    { Parameter: "Prevalence", Value: model.prevalence, Unit: "fraction" },
    { Parameter: "Annual incidence", Value: model.annualIncidence, Unit: "fraction/yr" },
    { Parameter: "Diagnosed share", Value: model.diagnosisRate, Unit: "fraction" },
    { Parameter: "Clinical eligibility", Value: model.clinicalEligibility, Unit: "fraction" },
    { Parameter: "Payer eligibility", Value: model.payerEligibility, Unit: "fraction" },
    { Parameter: "New drug annual price", Value: model.newIntervention.annualDrugCost, Unit: cur },
    { Parameter: "New drug adherence", Value: model.newIntervention.adherence, Unit: "fraction" },
    { Parameter: "Responder rate", Value: model.responderRate, Unit: "fraction" },
    { Parameter: "Note", Value: "Budget impact analysis. Illustrative assumptions; not a validated country estimate or cost-effectiveness result.", Unit: "" },
  ]);

  const stamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `BIET-analysis-${model.diseaseCode}-${stamp}.xlsx`);
}
