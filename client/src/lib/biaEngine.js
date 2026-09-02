function num(value, fallback = 0) {
  const x = Number(value);
  return Number.isFinite(x) ? x : fallback;
}

function clamp01(value) {
  return Math.min(1, Math.max(0, num(value)));
}

/**
 * Annual cost of keeping one patient on a treatment, discounted for the share
 * of patients who actually take it (adherence) and stay on it (persistence).
 * Administration, monitoring and device costs only accrue while a patient
 * persists, but are not affected by day-to-day adherence.
 */
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

/** Same cost, split by category, for the current-vs-new comparison and trace. */
function components(row) {
  const adherence = clamp01(row.adherence ?? 1);
  const persistence = clamp01(row.persistence ?? 1);
  return {
    drug: Math.max(0, num(row.annualDrugCost)) * adherence * persistence,
    admin: Math.max(0, num(row.annualAdminCost)) * persistence,
    monitoring: Math.max(0, num(row.annualMonitoringCost)) * persistence,
    device: Math.max(0, num(row.annualDeviceCost)) * persistence,
  };
}

/**
 * Obesity interventions lose effect as patients regain weight. The share of the
 * relative-risk benefit still standing in year `year` decays geometrically at
 * the annual regain rate, so year 1 keeps the full benefit.
 */
function retainedEffect(weightRegainRate, year) {
  return Math.pow(1 - clamp01(weightRegainRate), Math.max(0, year - 1));
}

function effectiveRelativeRisk(outcome, weightRegainRate, year) {
  const rr = Math.max(0, num(outcome.newRelativeRisk, 1));
  const reduction = (1 - rr) * retainedEffect(weightRegainRate, year);
  return 1 - reduction;
}

function medicalCostPerPatient(outcomes = [], rrFor = () => 1) {
  return outcomes.reduce(
    (sum, row) =>
      sum +
      Math.max(0, num(row.currentAnnualRate)) *
        rrFor(row) *
        Math.max(0, num(row.costPerEvent)),
    0
  );
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

/**
 * Core budget-impact projection. `uptakeScale` multiplies every year's adoption
 * rate so the same inputs can be replayed for low / base / high scenarios, and
 * `drugCostOverride` replaces the new intervention's annual drug cost, which is
 * what the break-even search below needs.
 */
function project(input, { uptakeScale = 1, drugCostOverride = null } = {}) {
  const years = Math.max(1, Math.min(10, Number(input.timeHorizonYears || 5)));
  const weightRegain = clamp01(input.weightRegainRate);
  const responderRate = clamp01(input.responderRate ?? 1);

  const currentTreatmentCostPerPatient = input.currentTreatments.reduce(
    (sum, row) => sum + num(row.marketShare) * annualTreatmentCost(row),
    0
  );

  // Blended current-care cost per patient, split by category (share-weighted).
  const blendedCur = input.currentTreatments.reduce(
    (acc, row) => {
      const c = components(row);
      const w = num(row.marketShare);
      acc.drug += w * c.drug;
      acc.admin += w * c.admin;
      acc.monitoring += w * c.monitoring;
      acc.device += w * c.device;
      return acc;
    },
    { drug: 0, admin: 0, monitoring: 0, device: 0 }
  );

  const newIntervention =
    drugCostOverride === null
      ? input.newIntervention
      : { ...input.newIntervention, annualDrugCost: drugCostOverride };

  const newTreatmentPP = annualTreatmentCost(newIntervention);

  const currentMedicalPP = medicalCostPerPatient(input.outcomes, () => 1);
  const newComp = components(newIntervention);
  const newMedicalPPYear1 = medicalCostPerPatient(input.outcomes, (row) =>
    effectiveRelativeRisk(row, weightRegain, 1)
  );

  // Horizon totals by cost category, for the current-vs-new comparison.
  const cost = {
    curDrug: 0, curAdmin: 0, curMon: 0, curMed: 0,
    newDrug: 0, newAdmin: 0, newMon: 0, newMed: 0,
  };

  const uptakeMap = new Map(
    (input.uptake || []).map((x) => [Number(x.year), clamp01(x.uptake)])
  );

  const annualResults = [];
  const eventsAvoidedByOutcome = new Map();
  let cumulativeImpact = 0;

  for (let y = 1; y <= years; y += 1) {
    const population =
      num(input.coveredPopulation) *
      Math.pow(1 + num(input.annualPopulationGrowth), y - 1);

    // Prevalence is the existing (stock) pool; incidence adds new cases (flow)
    // each subsequent year. Year 1 is unaffected by incidence.
    const prevalence = clamp01(
      num(input.prevalence) *
        Math.pow(1 + num(input.annualPrevalenceGrowth), y - 1) +
        num(input.annualIncidence) * (y - 1)
    );

    const eligiblePatients =
      population *
      prevalence *
      clamp01(input.diagnosisRate) *
      clamp01(input.clinicalEligibility) *
      clamp01(input.payerEligibility) *
      clamp01(input.accessRate) *
      clamp01(input.willingnessRate);

    const uptake = clamp01((uptakeMap.get(y) ?? 0) * uptakeScale);
    const newPatients = eligiblePatients * uptake;
    const remainingCurrent = eligiblePatients - newPatients;

    // Only patients who respond to treatment carry the outcome benefit; the
    // rest cost the same as they did on current care.
    const respondingPatients = newPatients * responderRate;

    const newMedicalPP = medicalCostPerPatient(input.outcomes, (row) =>
      effectiveRelativeRisk(row, weightRegain, y)
    );

    let yearEventsAvoided = 0;
    let yearHospitalCostAvoided = 0;

    for (const row of input.outcomes || []) {
      const rate = Math.max(0, num(row.currentAnnualRate));
      const rr = effectiveRelativeRisk(row, weightRegain, y);
      const avoidedPerPatient = rate * (1 - rr);
      const avoided = respondingPatients * avoidedPerPatient;

      yearEventsAvoided += avoided;
      yearHospitalCostAvoided += avoided * Math.max(0, num(row.costPerEvent));

      const key = row.outcomeCode || row.outcomeName;
      const prev = eventsAvoidedByOutcome.get(key) || {
        outcomeCode: row.outcomeCode,
        outcomeName: row.outcomeName,
        eventsAvoided: 0,
        costAvoided: 0,
      };
      prev.eventsAvoided += avoided;
      prev.costAvoided += avoided * Math.max(0, num(row.costPerEvent));
      eventsAvoidedByOutcome.set(key, prev);
    }

    const currentScenarioCost =
      eligiblePatients * (currentTreatmentCostPerPatient + currentMedicalPP);

    const newInterventionTreatment = newPatients * newTreatmentPP;

    // Non-responders keep the current-care event profile.
    const newInterventionMedical =
      respondingPatients * newMedicalPP +
      (newPatients - respondingPatients) * currentMedicalPP;

    const newScenarioCost =
      remainingCurrent * (currentTreatmentCostPerPatient + currentMedicalPP) +
      newInterventionTreatment +
      newInterventionMedical;

    // Category accumulation (sums reconcile exactly to the scenario totals).
    cost.curDrug += eligiblePatients * blendedCur.drug;
    cost.curAdmin += eligiblePatients * blendedCur.admin;
    cost.curMon += eligiblePatients * (blendedCur.monitoring + blendedCur.device);
    cost.curMed += eligiblePatients * currentMedicalPP;
    cost.newDrug += remainingCurrent * blendedCur.drug + newPatients * newComp.drug;
    cost.newAdmin += remainingCurrent * blendedCur.admin + newPatients * newComp.admin;
    cost.newMon +=
      remainingCurrent * (blendedCur.monitoring + blendedCur.device) +
      newPatients * (newComp.monitoring + newComp.device);
    cost.newMed +=
      remainingCurrent * currentMedicalPP +
      respondingPatients * newMedicalPP +
      (newPatients - respondingPatients) * currentMedicalPP;

    const netBudgetImpact = newScenarioCost - currentScenarioCost;
    cumulativeImpact += netBudgetImpact;

    annualResults.push({
      modelYear: y,
      calendarYear: Number(input.baseYear) + y - 1,
      coveredPopulation: population,
      eligiblePatients,
      uptake,
      newInterventionPatients: newPatients,
      respondingPatients,
      currentScenarioCost,
      newScenarioCost,
      netBudgetImpact,
      cumulativeImpact,
      pmpm: population > 0 ? netBudgetImpact / population / 12 : 0,
      pmpy: population > 0 ? netBudgetImpact / population : 0,
      pppm: newPatients > 0 ? netBudgetImpact / newPatients / 12 : 0,
      costPerTreatedPatient:
        newPatients > 0 ? newInterventionTreatment / newPatients : 0,
      eventsAvoided: yearEventsAvoided,
      hospitalCostAvoided: yearHospitalCostAvoided,
      retainedEffect: retainedEffect(weightRegain, y),
    });
  }

  return {
    annualResults,
    eventsAvoidedByOutcome,
    newTreatmentPP,
    cost,
    perPatient: {
      currentDrug: blendedCur.drug,
      currentAdmin: blendedCur.admin,
      currentMonitoring: blendedCur.monitoring + blendedCur.device,
      currentMedical: currentMedicalPP,
      currentTotal: currentTreatmentCostPerPatient + currentMedicalPP,
      newDrug: newComp.drug,
      newAdmin: newComp.admin,
      newMonitoring: newComp.monitoring + newComp.device,
      newMedical: newMedicalPPYear1,
      newTotal: newTreatmentPP + newMedicalPPYear1,
    },
  };
}

/**
 * Annual drug price at which the intervention pays for itself over the horizon.
 * Net budget impact is linear in the drug price -- it only enters through
 * `newPatients * price * adherence * persistence` -- so the break-even point is
 * solved directly instead of searched for.
 */
function breakEvenDrugCost(input, base) {
  const adherence = clamp01(input.newIntervention.adherence ?? 1);
  const persistence = clamp01(input.newIntervention.persistence ?? 1);

  const treatedPatientYears = base.annualResults.reduce(
    (s, r) => s + r.newInterventionPatients,
    0
  );

  const slope = treatedPatientYears * adherence * persistence;
  if (slope <= 0) return null;

  const netTotal = base.annualResults.reduce((s, r) => s + r.netBudgetImpact, 0);
  const current = Math.max(0, num(input.newIntervention.annualDrugCost));
  const price = current - netTotal / slope;

  return price > 0 ? price : 0;
}

export function calculateBudgetImpact(input) {
  validateModelInput(input);

  const base = project(input);
  const { annualResults } = base;

  const totals = (key) => annualResults.reduce((s, r) => s + r[key], 0);

  const treatedPatientYears = totals("newInterventionPatients");
  const netBudgetImpactTotal = totals("netBudgetImpact");
  const newTreatmentCostTotal = annualResults.reduce(
    (s, r) => s + r.newInterventionPatients * base.newTreatmentPP,
    0
  );

  const scenarios = [
    { scenarioId: "LOW", label: "Low uptake", scale: 0.5 },
    { scenarioId: "BASE", label: "Base case", scale: 1 },
    { scenarioId: "HIGH", label: "High uptake", scale: 1.5 },
  ].map(({ scenarioId, label, scale }) => {
    const run = scenarioId === "BASE" ? base : project(input, { uptakeScale: scale });
    return {
      scenarioId,
      label,
      uptakeScale: scale,
      netBudgetImpactTotal: run.annualResults.reduce(
        (s, r) => s + r.netBudgetImpact,
        0
      ),
      treatedPatientYears: run.annualResults.reduce(
        (s, r) => s + r.newInterventionPatients,
        0
      ),
      year1PMPM: run.annualResults[0]?.pmpm || 0,
      annual: run.annualResults.map((r) => ({
        modelYear: r.modelYear,
        calendarYear: r.calendarYear,
        netBudgetImpact: r.netBudgetImpact,
        cumulativeImpact: r.cumulativeImpact,
      })),
    };
  });

  const summary = {
    year1EligiblePatients: annualResults[0]?.eligiblePatients || 0,
    currentCostTotal: totals("currentScenarioCost"),
    newCostTotal: totals("newScenarioCost"),
    netBudgetImpactTotal,
    cumulativeImpactTotal: annualResults.at(-1)?.cumulativeImpact || 0,
    year1PMPM: annualResults[0]?.pmpm || 0,
    averagePMPM:
      annualResults.reduce((s, r) => s + r.pmpm, 0) / annualResults.length,
    // Affordability: per-member-per-year is PMPM x 12, the figure payers use
    // to weigh impact against an annual budget per covered life.
    year1PMPY: annualResults[0]?.pmpy || 0,
    averagePMPY:
      annualResults.reduce((s, r) => s + r.pmpy, 0) / annualResults.length,
    // Per-patient-per-month: incremental cost per *treated* patient per month.
    year1PPPM: annualResults[0]?.pppm || 0,
    treatedPatientYears,
    newInterventionPatientYears: treatedPatientYears,
    peakTreatedPatients: Math.max(
      ...annualResults.map((r) => r.newInterventionPatients)
    ),
    weightLossResponders: totals("respondingPatients"),
    costPerTreatedPatient:
      treatedPatientYears > 0 ? newTreatmentCostTotal / treatedPatientYears : 0,
    eventsAvoidedTotal: totals("eventsAvoided"),
    hospitalCostAvoidedTotal: totals("hospitalCostAvoided"),
    medicalCostOffsetTotal: totals("hospitalCostAvoided"),
    breakEvenAnnualPrice: breakEvenDrugCost(input, base),
  };

  // Current-vs-new cost comparison, by category, over the horizon.
  const c = base.cost;
  const categories = [
    { key: "drug", label: "Drug acquisition", current: c.curDrug, new: c.newDrug },
    { key: "admin", label: "Administration", current: c.curAdmin, new: c.newAdmin },
    { key: "monitoring", label: "Monitoring / labs", current: c.curMon, new: c.newMon },
    { key: "medical", label: "Medical events (AE / hospitalisation)", current: c.curMed, new: c.newMed },
  ].map((x) => ({ ...x, diff: x.new - x.current }));

  const patientYears = totals("eligiblePatients");
  const comparison = {
    patientYears,
    categories,
    totalCurrent: summary.currentCostTotal,
    totalNew: summary.newCostTotal,
    difference: netBudgetImpactTotal,
  };

  // Decision intelligence: which category adds the most, which offsets the most.
  const biggestDriver = [...categories].sort((a, b) => b.diff - a.diff)[0];
  const biggestOffset = [...categories].sort((a, b) => a.diff - b.diff)[0];
  summary.biggestDriver = biggestDriver;
  summary.biggestOffset = biggestOffset;

  return {
    summary,
    annualResults,
    eventsAvoided: [...base.eventsAvoidedByOutcome.values()],
    scenarios,
    comparison,
    perPatient: base.perPatient,
  };
}
