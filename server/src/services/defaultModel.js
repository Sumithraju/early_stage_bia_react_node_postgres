export function getDefaultModel() {
  return {
    modelName: "Obesity Early-Stage BIA",
    diseaseCode: "OBESITY",
    diseaseName: "Obesity / chronic weight management",
    countryCode: "IND",
    countryName: "India",
    currency: "INR",
    perspective: "Government payer",
    payerType: "Government",
    baseYear: 2026,
    timeHorizonYears: 5,

    coveredPopulation: 1000000,
    annualPopulationGrowth: 0.01,

    prevalence: 0.25,
    annualPrevalenceGrowth: 0,
    diagnosisRate: 0.70,

    clinicalEligibility: 0.60,
    payerEligibility: 0.80,
    accessRate: 0.90,
    willingnessRate: 0.80,

    subgroupDimension: "BMI_CLASS",
    subgroupValue: "ALL_ELIGIBLE",
    ageMin: 18,
    ageMax: 75,
    bmiMin: 30,

    currentTreatments: [
      {
        treatmentCode: "CURRENT_RX",
        treatmentName: "Current pharmacotherapy",
        marketShare: 0.70,
        annualDrugCost: 30000,
        annualAdminCost: 500,
        annualMonitoringCost: 2000,
        annualDeviceCost: 0,
        adherence: 0.75,
        persistence: 0.75,
        discontinuation: 0.20,
      },
      {
        treatmentCode: "LIFESTYLE",
        treatmentName: "Lifestyle / no pharmacotherapy",
        marketShare: 0.30,
        annualDrugCost: 0,
        annualAdminCost: 0,
        annualMonitoringCost: 1500,
        annualDeviceCost: 0,
        adherence: 1,
        persistence: 1,
        discontinuation: 0,
      },
    ],

    newIntervention: {
      treatmentCode: "NEW_DRUG",
      treatmentName: "Early-stage intervention",
      annualDrugCost: 120000,
      annualAdminCost: 2000,
      annualMonitoringCost: 4000,
      annualDeviceCost: 0,
      adherence: 0.85,
      persistence: 0.80,
      discontinuation: 0.15,
    },

    uptake: [
      { year: 1, uptake: 0.05 },
      { year: 2, uptake: 0.10 },
      { year: 3, uptake: 0.18 },
      { year: 4, uptake: 0.25 },
      { year: 5, uptake: 0.30 },
    ],

    outcomes: [
      {
        outcomeCode: "DIAB_CARE",
        outcomeName: "Diabetes-related event / care",
        currentAnnualRate: 0.05,
        newRelativeRisk: 0.85,
        costPerEvent: 25000,
      },
      {
        outcomeCode: "CV_EVENT",
        outcomeName: "Cardiovascular event",
        currentAnnualRate: 0.01,
        newRelativeRisk: 0.90,
        costPerEvent: 120000,
      },
      {
        outcomeCode: "HOSP",
        outcomeName: "Hospitalization / complication",
        currentAnnualRate: 0.02,
        newRelativeRisk: 0.92,
        costPerEvent: 45000,
      },
    ],
  };
}
