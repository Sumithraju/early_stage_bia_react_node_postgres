/**
 * Disease registry. The tool models ONE disease at a time -- the earlier HEOR
 * review was explicit that a single, well-understood disease beats a shallow
 * disease-agnostic shell -- but it now ships two worked examples the user can
 * switch between. Selecting a disease loads its defaults and its subgroups;
 * it never mixes two diseases in one model.
 *
 * Every number is a plausible Indian government-payer starting point meant to
 * be overwritten, not a validated estimate.
 */

const SHARED = {
  countryCode: "IND",
  countryName: "India",
  currency: "INR",
  perspective: "Government payer",
  baseYear: new Date().getFullYear(),
  timeHorizonYears: 5,
  coveredPopulation: 1_000_000,
  ageMin: 18,
  ageMax: 75,
  annualPopulationGrowth: 0.01,
  annualPrevalenceGrowth: 0,
  accessRate: 0.9,
  willingnessRate: 0.8,
};

export const DISEASES = {
  OBESITY: {
    code: "OBESITY",
    label: "Obesity / chronic weight management",
    therapyArea: "Cardiometabolic",
    eligibilityUnit: "BMI",
    subgroups: [
      { dimension: "BMI_CLASS", code: "BMI_27_29", label: "BMI 27-29.9 with comorbidity" },
      { dimension: "BMI_CLASS", code: "BMI_30_34", label: "BMI 30-34.9 (class I)" },
      { dimension: "BMI_CLASS", code: "BMI_35_39", label: "BMI 35-39.9 (class II)" },
      { dimension: "BMI_CLASS", code: "BMI_40_PLUS", label: "BMI 40+ (class III)" },
      { dimension: "COMORBIDITY", code: "WITH_T2D", label: "With type 2 diabetes" },
      { dimension: "COMORBIDITY", code: "WITH_CVD", label: "With established CVD" },
      { dimension: "COMORBIDITY", code: "WITH_OSA", label: "With sleep apnoea" },
    ],
    defaults: {
      ...SHARED,
      modelName: "Obesity Early-Stage BIA",
      diseaseName: "Obesity / chronic weight management",
      prevalence: 0.25,
      annualIncidence: 0.005,
      diagnosisRate: 0.7,
      bmiThreshold: 30,
      comorbidityRequirement: "At least one obesity-related comorbidity",
      clinicalEligibility: 0.6,
      payerEligibility: 0.8,
      expectedWeightLossPct: 0.15,
      responderRate: 0.7,
      weightRegainRate: 0.1,
      currentTreatments: [
        { treatmentCode: "LIFESTYLE", treatmentName: "Lifestyle programme", marketShare: 0.55, annualDrugCost: 0, annualAdminCost: 0, annualMonitoringCost: 1500, annualDeviceCost: 0, adherence: 1, persistence: 1, discontinuation: 0 },
        { treatmentCode: "CURRENT_RX", treatmentName: "Existing pharmacotherapy", marketShare: 0.4, annualDrugCost: 30000, annualAdminCost: 500, annualMonitoringCost: 2000, annualDeviceCost: 0, adherence: 0.75, persistence: 0.75, discontinuation: 0.2 },
        { treatmentCode: "BARIATRIC", treatmentName: "Bariatric surgery", marketShare: 0.05, annualDrugCost: 0, annualAdminCost: 180000, annualMonitoringCost: 6000, annualDeviceCost: 0, adherence: 1, persistence: 1, discontinuation: 0 },
      ],
      newIntervention: { treatmentCode: "NEW_DRUG", treatmentName: "Early-stage intervention", annualDrugCost: 120000, annualAdminCost: 2000, annualMonitoringCost: 4000, annualDeviceCost: 0, adherence: 0.85, persistence: 0.8, discontinuation: 0.15 },
      uptake: [
        { year: 1, uptake: 0.05 }, { year: 2, uptake: 0.1 }, { year: 3, uptake: 0.18 },
        { year: 4, uptake: 0.25 }, { year: 5, uptake: 0.3 },
      ],
      outcomes: [
        { outcomeCode: "T2D", outcomeName: "New type 2 diabetes", currentAnnualRate: 0.05, newRelativeRisk: 0.75, costPerEvent: 25000 },
        { outcomeCode: "HTN", outcomeName: "Hypertension event", currentAnnualRate: 0.04, newRelativeRisk: 0.85, costPerEvent: 18000 },
        { outcomeCode: "OSA", outcomeName: "Sleep apnoea management", currentAnnualRate: 0.03, newRelativeRisk: 0.8, costPerEvent: 22000 },
        { outcomeCode: "CV_EVENT", outcomeName: "Cardiovascular event", currentAnnualRate: 0.01, newRelativeRisk: 0.88, costPerEvent: 120000 },
        { outcomeCode: "HOSP", outcomeName: "Obesity-related hospitalisation", currentAnnualRate: 0.02, newRelativeRisk: 0.9, costPerEvent: 45000 },
      ],
    },
  },

  T2D: {
    code: "T2D",
    label: "Type 2 diabetes",
    therapyArea: "Cardiometabolic",
    eligibilityUnit: "HbA1c",
    subgroups: [
      { dimension: "HBA1C_BAND", code: "A1C_7_8", label: "HbA1c 7-8%" },
      { dimension: "HBA1C_BAND", code: "A1C_8_9", label: "HbA1c 8-9%" },
      { dimension: "HBA1C_BAND", code: "A1C_9_PLUS", label: "HbA1c 9%+" },
      { dimension: "THERAPY_LINE", code: "FIRST_LINE", label: "First-line (metformin)" },
      { dimension: "THERAPY_LINE", code: "SECOND_LINE", label: "Second-line add-on" },
      { dimension: "THERAPY_LINE", code: "INSULIN", label: "Insulin-requiring" },
      { dimension: "COMPLICATION", code: "WITH_CVD", label: "With established CVD" },
      { dimension: "COMPLICATION", code: "WITH_CKD", label: "With chronic kidney disease" },
    ],
    defaults: {
      ...SHARED,
      modelName: "Type 2 Diabetes Early-Stage BIA",
      diseaseName: "Type 2 diabetes",
      prevalence: 0.1,          // ~10% adult T2D prevalence in India
      annualIncidence: 0.007,   // new diagnoses per year
      diagnosisRate: 0.55,      // roughly half remain undiagnosed
      bmiThreshold: 7,          // reused field = HbA1c treatment threshold (%)
      comorbidityRequirement: "Inadequate glycaemic control on current therapy",
      clinicalEligibility: 0.55,
      payerEligibility: 0.8,
      expectedWeightLossPct: 0.05,
      responderRate: 0.6,       // reaching HbA1c target
      weightRegainRate: 0.08,   // reused field = annual erosion of glycaemic benefit
      currentTreatments: [
        { treatmentCode: "METFORMIN", treatmentName: "Metformin +/- sulfonylurea", marketShare: 0.6, annualDrugCost: 3600, annualAdminCost: 0, annualMonitoringCost: 3000, annualDeviceCost: 0, adherence: 0.8, persistence: 0.8, discontinuation: 0.15 },
        { treatmentCode: "BASAL_INSULIN", treatmentName: "Basal insulin", marketShare: 0.25, annualDrugCost: 18000, annualAdminCost: 1000, annualMonitoringCost: 6000, annualDeviceCost: 3000, adherence: 0.75, persistence: 0.7, discontinuation: 0.2 },
        { treatmentCode: "DPP4", treatmentName: "DPP-4 inhibitor add-on", marketShare: 0.15, annualDrugCost: 12000, annualAdminCost: 0, annualMonitoringCost: 3000, annualDeviceCost: 0, adherence: 0.8, persistence: 0.75, discontinuation: 0.18 },
      ],
      newIntervention: { treatmentCode: "NEW_GLP1", treatmentName: "Early-stage GLP-1 / novel agent", annualDrugCost: 60000, annualAdminCost: 1000, annualMonitoringCost: 4000, annualDeviceCost: 0, adherence: 0.85, persistence: 0.78, discontinuation: 0.15 },
      uptake: [
        { year: 1, uptake: 0.04 }, { year: 2, uptake: 0.09 }, { year: 3, uptake: 0.15 },
        { year: 4, uptake: 0.22 }, { year: 5, uptake: 0.28 },
      ],
      outcomes: [
        { outcomeCode: "CV_EVENT", outcomeName: "Cardiovascular event (MACE)", currentAnnualRate: 0.02, newRelativeRisk: 0.82, costPerEvent: 120000 },
        { outcomeCode: "CKD", outcomeName: "CKD progression", currentAnnualRate: 0.03, newRelativeRisk: 0.78, costPerEvent: 80000 },
        { outcomeCode: "HYPO", outcomeName: "Severe hypoglycaemia admission", currentAnnualRate: 0.04, newRelativeRisk: 0.7, costPerEvent: 30000 },
        { outcomeCode: "RETINO", outcomeName: "Retinopathy / vision care", currentAnnualRate: 0.025, newRelativeRisk: 0.85, costPerEvent: 40000 },
        { outcomeCode: "AMPUT", outcomeName: "Foot ulcer / amputation", currentAnnualRate: 0.008, newRelativeRisk: 0.75, costPerEvent: 150000 },
      ],
    },
  },

  MASH: {
    code: "MASH",
    label: "MASH (metabolic dysfunction-associated steatohepatitis)",
    therapyArea: "Cardiometabolic",
    eligibilityUnit: "Fibrosis",
    subgroups: [
      { dimension: "FIBROSIS_STAGE", code: "F2", label: "Fibrosis F2 (significant)" },
      { dimension: "FIBROSIS_STAGE", code: "F3", label: "Fibrosis F3 (advanced)" },
      { dimension: "FIBROSIS_STAGE", code: "F4_COMP", label: "F4 compensated cirrhosis" },
      { dimension: "COMORBIDITY", code: "WITH_T2D", label: "With type 2 diabetes" },
      { dimension: "COMORBIDITY", code: "WITH_OBESITY", label: "With obesity" },
      { dimension: "COMORBIDITY", code: "NONE", label: "No metabolic comorbidity" },
    ],
    defaults: {
      ...SHARED,
      modelName: "MASH Early-Stage BIA",
      diseaseName: "MASH",
      prevalence: 0.05,          // ~5% of adults have MASH
      annualIncidence: 0.004,
      diagnosisRate: 0.20,       // heavily under-diagnosed
      bmiThreshold: 2,           // reused field = minimum fibrosis stage (F2+)
      comorbidityRequirement: "F2-F3 fibrosis without decompensated cirrhosis",
      clinicalEligibility: 0.50,
      payerEligibility: 0.70,
      expectedWeightLossPct: 0.10,
      responderRate: 0.30,       // >=1 stage fibrosis improvement
      weightRegainRate: 0.06,
      currentTreatments: [
        { treatmentCode: "LIFESTYLE", treatmentName: "Diet & lifestyle", marketShare: 0.70, annualDrugCost: 0, annualAdminCost: 0, annualMonitoringCost: 4000, annualDeviceCost: 0, adherence: 1, persistence: 0.8, discontinuation: 0.1 },
        { treatmentCode: "VIT_E", treatmentName: "Vitamin E / off-label", marketShare: 0.20, annualDrugCost: 6000, annualAdminCost: 0, annualMonitoringCost: 4000, annualDeviceCost: 0, adherence: 0.7, persistence: 0.65, discontinuation: 0.25 },
        { treatmentCode: "GLP1_OFF", treatmentName: "GLP-1 (off-label)", marketShare: 0.10, annualDrugCost: 60000, annualAdminCost: 1000, annualMonitoringCost: 5000, annualDeviceCost: 0, adherence: 0.8, persistence: 0.75, discontinuation: 0.18 },
      ],
      newIntervention: { treatmentCode: "NEW_MASH", treatmentName: "Early-stage MASH therapy", annualDrugCost: 140000, annualAdminCost: 2000, annualMonitoringCost: 8000, annualDeviceCost: 0, adherence: 0.85, persistence: 0.78, discontinuation: 0.15 },
      uptake: [
        { year: 1, uptake: 0.04 }, { year: 2, uptake: 0.09 }, { year: 3, uptake: 0.16 },
        { year: 4, uptake: 0.24 }, { year: 5, uptake: 0.30 },
      ],
      outcomes: [
        { outcomeCode: "CIRRHOSIS", outcomeName: "Progression to cirrhosis", currentAnnualRate: 0.04, newRelativeRisk: 0.70, costPerEvent: 90000 },
        { outcomeCode: "DECOMP", outcomeName: "Hepatic decompensation", currentAnnualRate: 0.015, newRelativeRisk: 0.68, costPerEvent: 250000 },
        { outcomeCode: "HCC", outcomeName: "Hepatocellular carcinoma", currentAnnualRate: 0.006, newRelativeRisk: 0.75, costPerEvent: 400000 },
        { outcomeCode: "CV_EVENT", outcomeName: "Cardiovascular event", currentAnnualRate: 0.02, newRelativeRisk: 0.85, costPerEvent: 120000 },
        { outcomeCode: "T2D_NEW", outcomeName: "New type 2 diabetes", currentAnnualRate: 0.05, newRelativeRisk: 0.80, costPerEvent: 25000 },
      ],
    },
  },
};

export const DISEASE_LIST = Object.values(DISEASES).map((d) => ({
  code: d.code,
  label: d.label,
}));

/** Deep-cloned defaults for a disease, tagged with therapyArea + a default subgroup. */
export function defaultModelFor(code = "OBESITY") {
  const disease = DISEASES[code] || DISEASES.OBESITY;
  return {
    therapyArea: disease.therapyArea,
    diseaseCode: disease.code,
    subgroup: "ALL",
    ...structuredClone(disease.defaults),
  };
}

export function subgroupsFor(code) {
  return (DISEASES[code] || DISEASES.OBESITY).subgroups;
}
