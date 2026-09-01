import XLSX from "xlsx";
import { withTransaction } from "../db/query.js";

function sheetRows(workbook, name) {
  const sheet = workbook.Sheets[name];
  if (!sheet) return [];
  // Template convention:
  // row 1 = sheet title, row 2 = blank, row 3 = column headers.
  return XLSX.utils.sheet_to_json(sheet, { defval: null, range: 2 });
}

function kvMap(rows) {
  const map = {};
  for (const row of rows) {
    const field = row.field ?? row.Field ?? row.FIELD;
    if (!field) continue;
    map[String(field).trim()] = row.value ?? row.Value ?? row.VALUE;
  }
  return map;
}

function n(value, fallback = 0) {
  const x = Number(value);
  return Number.isFinite(x) ? x : fallback;
}

function pct(value, fallback = 0) {
  return n(value, fallback) / 100;
}

export function parseBiaWorkbook(path) {
  const workbook = XLSX.readFile(path);

  const config = kvMap(sheetRows(workbook, "01_Model_Config"));
  const population = kvMap(sheetRows(workbook, "04_Population"));
  const epidemiology = kvMap(sheetRows(workbook, "05_Epidemiology"));
  const eligibility = kvMap(sheetRows(workbook, "06_Eligibility"));
  const newIntervention = kvMap(sheetRows(workbook, "08_New_Intervention"));
  const behaviour = kvMap(sheetRows(workbook, "10_Treatment_Behaviour"));

  const currentRows = sheetRows(workbook, "07_Current_Treatments");
  const uptakeRows = sheetRows(workbook, "09_Market_Uptake");
  const outcomeRows = sheetRows(workbook, "11_Clinical_Outcomes");

  return {
    modelName: config.model_name || "Imported BIA model",
    diseaseCode: config.disease_code || "OBESITY",
    diseaseName: config.disease_name || "Obesity",
    countryCode: config.country_code || "IND",
    countryName: config.country || "India",
    currency: config.currency || "INR",
    perspective: config.perspective || "Government payer",
    payerType: config.payer_type || "Government",
    baseYear: n(config.base_year, 2026),
    timeHorizonYears: n(config.time_horizon_years, 5),

    coveredPopulation: n(population.covered_population, 1000000),
    annualPopulationGrowth: pct(
      population.annual_population_growth_rate_pct,
      1
    ),

    prevalence: pct(epidemiology.prevalence_rate_pct, 25),
    annualPrevalenceGrowth: pct(
      epidemiology.annual_prevalence_growth_pct,
      0
    ),
    diagnosisRate: pct(epidemiology.diagnosis_rate_pct, 70),

    clinicalEligibility: pct(
      eligibility.clinical_eligibility_rate_pct,
      60
    ),
    payerEligibility: pct(eligibility.payer_eligibility_rate_pct, 80),
    accessRate: pct(eligibility.access_rate_pct, 90),
    willingnessRate: pct(
      eligibility.treatment_willingness_rate_pct,
      80
    ),

    ageMin: n(population.age_min, 18),
    ageMax: n(population.age_max, 75),
    bmiMin: n(eligibility.bmi_min, 30),
    subgroupDimension:
      eligibility.subgroup_dimension || "BMI_CLASS",
    subgroupValue:
      eligibility.subgroup_value || "ALL_ELIGIBLE",

    currentTreatments: currentRows.map((r, index) => ({
      treatmentCode: r.treatment_code || `CURRENT_${index + 1}`,
      treatmentName: r.treatment_name || `Comparator ${index + 1}`,
      marketShare: n(r.market_share, 0),
      annualDrugCost: n(r.annual_drug_cost, 0),
      annualAdminCost: n(r.annual_admin_cost, 0),
      annualMonitoringCost: n(r.annual_monitoring_cost, 0),
      annualDeviceCost: n(r.annual_device_cost, 0),
      adherence: n(r.adherence, 1),
      persistence: n(r.persistence, 1),
      discontinuation: n(r.discontinuation, 0),
    })),

    newIntervention: {
      treatmentCode: newIntervention.treatment_code || "NEW_DRUG",
      treatmentName:
        newIntervention.intervention_name || "Early-stage intervention",
      annualDrugCost: n(newIntervention.annual_drug_cost, 0),
      annualAdminCost: n(newIntervention.annual_admin_cost, 0),
      annualMonitoringCost: n(newIntervention.annual_monitoring_cost, 0),
      annualDeviceCost: n(newIntervention.annual_device_cost, 0),
      adherence: pct(behaviour.new_intervention_adherence_pct, 85),
      persistence: pct(behaviour.new_intervention_persistence_pct, 80),
      discontinuation: pct(
        behaviour.new_intervention_discontinuation_pct,
        15
      ),
    },

    uptake: uptakeRows.map((r) => ({
      year: n(r.year, 1),
      uptake: n(r.uptake, 0),
    })),

    outcomes: outcomeRows.map((r, index) => ({
      outcomeCode: r.outcome_code || `OUTCOME_${index + 1}`,
      outcomeName: r.outcome_name || `Outcome ${index + 1}`,
      currentAnnualRate: n(r.current_annual_rate, 0),
      newRelativeRisk: n(r.new_relative_risk, 1),
      costPerEvent: n(r.cost_per_event, 0),
    })),
  };
}

export async function persistImportedModel(model, originalFilename) {
  return withTransaction(async (client) => {
    const job = await client.query(
      `INSERT INTO import_job
       (original_filename, disease_code, status, row_count)
       VALUES ($1,$2,'IMPORTED',$3)
       RETURNING *`,
      [
        originalFilename,
        model.diseaseCode,
        model.currentTreatments.length +
          model.uptake.length +
          model.outcomes.length,
      ]
    );

    return job.rows[0];
  });
}
