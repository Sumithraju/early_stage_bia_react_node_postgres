/**
 * BIET ships with one worked disease -- obesity / chronic weight management --
 * rather than a disease-agnostic shell. Every default below is a plausible
 * Indian government-payer starting point that the user is expected to overwrite;
 * they exist so the tool opens on a working model instead of an empty form.
 */
export function getDefaultModel() {
  return {
    modelName: "Obesity Early-Stage BIA",

    // --- Setup -------------------------------------------------------------
    therapyArea: "Cardiometabolic",
    subgroup: "ALL",
    diseaseCode: "OBESITY",
    diseaseName: "Obesity / chronic weight management",
    countryCode: "IND",
    countryName: "India",
    currency: "INR",
    perspective: "Government payer",
    baseYear: new Date().getFullYear(),
    timeHorizonYears: 5,

    // --- Population --------------------------------------------------------
    coveredPopulation: 1_000_000,
    ageMin: 18,
    ageMax: 75,
    annualPopulationGrowth: 0.01,

    // --- Epidemiology ------------------------------------------------------
    prevalence: 0.25,
    annualPrevalenceGrowth: 0,
    diagnosisRate: 0.70,

    // --- Eligibility -------------------------------------------------------
    bmiThreshold: 30,
    comorbidityRequirement: "At least one obesity-related comorbidity",
    clinicalEligibility: 0.60,
    payerEligibility: 0.80,
    accessRate: 0.90,
    willingnessRate: 0.80,

    // --- Current care ------------------------------------------------------
    currentTreatments: [
      {
        treatmentCode: "LIFESTYLE",
        treatmentName: "Lifestyle programme",
        marketShare: 0.55,
        annualDrugCost: 0,
        annualAdminCost: 0,
        annualMonitoringCost: 1_500,
        annualDeviceCost: 0,
        adherence: 1,
        persistence: 1,
        discontinuation: 0,
      },
      {
        treatmentCode: "CURRENT_RX",
        treatmentName: "Existing pharmacotherapy",
        marketShare: 0.40,
        annualDrugCost: 30_000,
        annualAdminCost: 500,
        annualMonitoringCost: 2_000,
        annualDeviceCost: 0,
        adherence: 0.75,
        persistence: 0.75,
        discontinuation: 0.20,
      },
      {
        treatmentCode: "BARIATRIC",
        treatmentName: "Bariatric surgery",
        marketShare: 0.05,
        annualDrugCost: 0,
        annualAdminCost: 180_000,
        annualMonitoringCost: 6_000,
        annualDeviceCost: 0,
        adherence: 1,
        persistence: 1,
        discontinuation: 0,
      },
    ],

    // --- New intervention --------------------------------------------------
    newIntervention: {
      treatmentCode: "NEW_DRUG",
      treatmentName: "Early-stage intervention",
      annualDrugCost: 120_000,
      annualAdminCost: 2_000,
      annualMonitoringCost: 4_000,
      annualDeviceCost: 0,
      adherence: 0.85,
      persistence: 0.80,
      discontinuation: 0.15,
    },

    // --- Uptake ------------------------------------------------------------
    uptake: [
      { year: 1, uptake: 0.05 },
      { year: 2, uptake: 0.10 },
      { year: 3, uptake: 0.18 },
      { year: 4, uptake: 0.25 },
      { year: 5, uptake: 0.30 },
    ],

    // --- Treatment behaviour -----------------------------------------------
    // Share of treated patients reaching the target weight loss, and the annual
    // rate at which the outcome benefit erodes as weight is regained.
    expectedWeightLossPct: 0.15,
    responderRate: 0.70,
    weightRegainRate: 0.10,

    // --- Outcomes ----------------------------------------------------------
    outcomes: [
      {
        outcomeCode: "T2D",
        outcomeName: "New type 2 diabetes",
        currentAnnualRate: 0.050,
        newRelativeRisk: 0.75,
        costPerEvent: 25_000,
      },
      {
        outcomeCode: "HTN",
        outcomeName: "Hypertension event",
        currentAnnualRate: 0.040,
        newRelativeRisk: 0.85,
        costPerEvent: 18_000,
      },
      {
        outcomeCode: "OSA",
        outcomeName: "Sleep apnoea management",
        currentAnnualRate: 0.030,
        newRelativeRisk: 0.80,
        costPerEvent: 22_000,
      },
      {
        outcomeCode: "CV_EVENT",
        outcomeName: "Cardiovascular event",
        currentAnnualRate: 0.010,
        newRelativeRisk: 0.88,
        costPerEvent: 120_000,
      },
      {
        outcomeCode: "HOSP",
        outcomeName: "Obesity-related hospitalisation",
        currentAnnualRate: 0.020,
        newRelativeRisk: 0.90,
        costPerEvent: 45_000,
      },
    ],
  };
}

/** Subgroups offered in the UI. Obesity only -- one disease, done properly. */
export const OBESITY_SUBGROUPS = [
  { dimension: "BMI_CLASS", code: "BMI_27_29", label: "BMI 27-29.9 with comorbidity" },
  { dimension: "BMI_CLASS", code: "BMI_30_34", label: "BMI 30-34.9 (class I)" },
  { dimension: "BMI_CLASS", code: "BMI_35_39", label: "BMI 35-39.9 (class II)" },
  { dimension: "BMI_CLASS", code: "BMI_40_PLUS", label: "BMI 40+ (class III)" },
  { dimension: "COMORBIDITY", code: "WITH_T2D", label: "With type 2 diabetes" },
  { dimension: "COMORBIDITY", code: "WITH_CVD", label: "With established CVD" },
  { dimension: "COMORBIDITY", code: "WITH_OSA", label: "With sleep apnoea" },
  { dimension: "COMORBIDITY", code: "NONE", label: "No comorbidity" },
];
