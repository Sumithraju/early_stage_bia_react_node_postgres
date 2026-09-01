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
    ["coveredPopulation", "Covered population"],
    ["ageMin", "Age minimum"],
    ["ageMax", "Age maximum"],
    ["annualPopulationGrowth", "Annual population growth"],
    ["prevalence", "Obesity prevalence"],
    ["annualPrevalenceGrowth", "Annual prevalence growth"],
    ["diagnosisRate", "Diagnosed share"],
    ["bmiThreshold", "BMI threshold"],
    ["clinicalEligibility", "Clinical eligibility"],
    ["payerEligibility", "Payer eligibility"],
    ["accessRate", "Access rate"],
    ["willingnessRate", "Willingness to treat"],
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
  ["adherence", "Adherence"],
  ["persistence", "Persistence"],
  ["discontinuation", "Discontinuation"],
];

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
  const n = Number(String(value).replace(/[,%\s₹$]/g, ""));
  return Number.isFinite(n) ? n : null;
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
    const raw = byLabel.get(label.toLowerCase());
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
        const raw = row[label] ?? row[key];
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
      ...(currentModel.currentTreatments[i] || {}),
      treatmentCode: currentModel.currentTreatments[i]?.treatmentCode || `CMP_${i + 1}`,
      ...row,
    }));
    applied += comparators.length;
  }

  const intervention = readTable(XLSX, wb, "NewIntervention", TREATMENT_COLUMNS);
  if (intervention?.length) {
    model.newIntervention = { ...currentModel.newIntervention, ...intervention[0] };
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
    const rows = spec.map(([key, label]) => ({ field: label, value: model[key] ?? "" }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), sheetName);
  }

  const treatmentRows = (list) =>
    list.map((t) =>
      Object.fromEntries(TREATMENT_COLUMNS.map(([key, label]) => [label, t[key] ?? 0]))
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
        Object.fromEntries(OUTCOME_COLUMNS.map(([key, label]) => [label, o[key] ?? 0]))
      )
    ),
    "Outcomes"
  );

  XLSX.writeFile(wb, "BIET-input-template.xlsx");
}
