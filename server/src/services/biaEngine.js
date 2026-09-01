function num(value, fallback = 0) {
  const x = Number(value);
  return Number.isFinite(x) ? x : fallback;
}

function clamp01(value) {
  return Math.min(1, Math.max(0, num(value)));
}

function annualTreatmentCost(row) {
  const drug = Math.max(0, num(row.annualDrugCost));
  const admin = Math.max(0, num(row.annualAdminCost));
  const monitoring = Math.max(0, num(row.annualMonitoringCost));
  const device = Math.max(0, num(row.annualDeviceCost));
  const adherence = clamp01(row.adherence ?? 1);
  const persistence = clamp01(row.persistence ?? 1);

  return (
    drug * adherence * persistence +
    (admin + monitoring + device) * persistence
  );
}

function currentMedicalCostPerPatient(outcomes = []) {
  return outcomes.reduce((sum, row) => {
    return (
      sum +
      Math.max(0, num(row.currentAnnualRate)) *
        Math.max(0, num(row.costPerEvent))
    );
  }, 0);
}

function newMedicalCostPerPatient(outcomes = []) {
  return outcomes.reduce((sum, row) => {
    return (
      sum +
      Math.max(0, num(row.currentAnnualRate)) *
        Math.max(0, num(row.newRelativeRisk, 1)) *
        Math.max(0, num(row.costPerEvent))
    );
  }, 0);
}

export function validateModelInput(input) {
  const currentTreatments = input.currentTreatments || [];
  if (!currentTreatments.length) {
    throw new Error("At least one current-care comparator is required.");
  }

  const shareSum = currentTreatments.reduce(
    (sum, row) => sum + num(row.marketShare),
    0
  );

  if (Math.abs(shareSum - 1) > 0.001) {
    throw new Error(
      `Current-care market shares must sum to 1.0. Current total: ${shareSum.toFixed(
        3
      )}`
    );
  }

  if (!input.newIntervention) {
    throw new Error("New intervention is required.");
  }

  return true;
}

export function calculateBudgetImpact(input) {
  validateModelInput(input);

  const years = Math.max(1, Math.min(10, Number(input.timeHorizonYears || 5)));

  const currentTreatmentCostPerPatient = input.currentTreatments.reduce(
    (sum, row) => sum + num(row.marketShare) * annualTreatmentCost(row),
    0
  );

  const currentMedicalPP = currentMedicalCostPerPatient(input.outcomes);
  const newMedicalPP = newMedicalCostPerPatient(input.outcomes);

  const newTreatmentPP = annualTreatmentCost(input.newIntervention);

  const uptakeMap = new Map(
    (input.uptake || []).map((x) => [Number(x.year), clamp01(x.uptake)])
  );

  const annualResults = [];
  const scenarioDetail = [];

  for (let y = 1; y <= years; y += 1) {
    const population =
      num(input.coveredPopulation) *
      Math.pow(1 + num(input.annualPopulationGrowth), y - 1);

    const prevalence = clamp01(
      num(input.prevalence) *
        Math.pow(1 + num(input.annualPrevalenceGrowth), y - 1)
    );

    const diseasePopulation = population * prevalence;
    const diagnosedPopulation =
      diseasePopulation * clamp01(input.diagnosisRate);
    const clinicallyEligible =
      diagnosedPopulation * clamp01(input.clinicalEligibility);
    const payerEligible =
      clinicallyEligible * clamp01(input.payerEligibility);
    const accessible = payerEligible * clamp01(input.accessRate);
    const eligiblePatients = accessible * clamp01(input.willingnessRate);

    const uptake = uptakeMap.get(y) ?? 0;
    const newPatients = eligiblePatients * uptake;
    const remainingCurrent = eligiblePatients - newPatients;

    const currentTreatmentCost =
      eligiblePatients * currentTreatmentCostPerPatient;
    const currentMedicalCost = eligiblePatients * currentMedicalPP;
    const currentScenarioCost = currentTreatmentCost + currentMedicalCost;

    const remainingCurrentTreatment =
      remainingCurrent * currentTreatmentCostPerPatient;
    const remainingCurrentMedical = remainingCurrent * currentMedicalPP;
    const newInterventionTreatment = newPatients * newTreatmentPP;
    const newInterventionMedical = newPatients * newMedicalPP;

    const newScenarioCost =
      remainingCurrentTreatment +
      remainingCurrentMedical +
      newInterventionTreatment +
      newInterventionMedical;

    const netBudgetImpact = newScenarioCost - currentScenarioCost;
    const pmpm = population > 0 ? netBudgetImpact / population / 12 : 0;
    const medicalCostOffset =
      newPatients * (currentMedicalPP - newMedicalPP);

    annualResults.push({
      modelYear: y,
      calendarYear: Number(input.baseYear) + y - 1,
      coveredPopulation: population,
      diseasePopulation,
      diagnosedPopulation,
      clinicallyEligible,
      payerEligible,
      eligiblePatients,
      newInterventionPatients: newPatients,
      uptake,
      currentScenarioCost,
      newScenarioCost,
      netBudgetImpact,
      pmpm,
      medicalCostOffset,
    });

    scenarioDetail.push(
      {
        modelYear: y,
        scenario: "CURRENT",
        component: "Treatment",
        cost: currentTreatmentCost,
      },
      {
        modelYear: y,
        scenario: "CURRENT",
        component: "Medical outcomes",
        cost: currentMedicalCost,
      },
      {
        modelYear: y,
        scenario: "NEW",
        component: "Remaining current-care treatment",
        cost: remainingCurrentTreatment,
      },
      {
        modelYear: y,
        scenario: "NEW",
        component: "Remaining current-care medical outcomes",
        cost: remainingCurrentMedical,
      },
      {
        modelYear: y,
        scenario: "NEW",
        component: "New intervention treatment",
        cost: newInterventionTreatment,
      },
      {
        modelYear: y,
        scenario: "NEW",
        component: "New intervention medical outcomes",
        cost: newInterventionMedical,
      }
    );
  }

  const summary = {
    year1EligiblePatients: annualResults[0]?.eligiblePatients || 0,
    currentCostTotal: annualResults.reduce(
      (s, r) => s + r.currentScenarioCost,
      0
    ),
    newCostTotal: annualResults.reduce((s, r) => s + r.newScenarioCost, 0),
    netBudgetImpactTotal: annualResults.reduce(
      (s, r) => s + r.netBudgetImpact,
      0
    ),
    year1PMPM: annualResults[0]?.pmpm || 0,
    newInterventionPatientYears: annualResults.reduce(
      (s, r) => s + r.newInterventionPatients,
      0
    ),
    medicalCostOffsetTotal: annualResults.reduce(
      (s, r) => s + r.medicalCostOffset,
      0
    ),
  };

  return { summary, annualResults, scenarioDetail };
}
