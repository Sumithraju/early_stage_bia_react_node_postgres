/**
 * Saved-run history, kept in the browser session. Each saved run is a snapshot
 * of the inputs plus the headline outputs, so the Runs tab can line run 1, run 2,
 * run 3 ... up side by side without re-running anything. Cleared when the tab
 * closes, like the rest of the session.
 */
const KEY = "biet.runs.v1";

export function loadRuns() {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

function persist(runs) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(runs));
  } catch {
    /* storage blocked - history simply won't persist across reloads */
  }
}

/** Appends a run snapshot and returns the new list (most recent last). */
export function saveRun(model, result, label) {
  const runs = loadRuns();
  const s = result.summary;
  const run = {
    id: `run_${Date.now()}`,
    n: runs.length + 1,
    label: label || `Run ${runs.length + 1}`,
    savedAt: new Date().toISOString(),
    // Enough context to read the row without opening the run
    diseaseName: model.diseaseName,
    subgroup: model.subgroup,
    currency: model.currency,
    perspective: model.perspective,
    timeHorizonYears: model.timeHorizonYears,
    interventionName: model.newIntervention?.treatmentName,
    interventionPrice: model.newIntervention?.annualDrugCost,
    metrics: {
      netBudgetImpactTotal: s.netBudgetImpactTotal,
      year1PMPM: s.year1PMPM,
      averagePMPM: s.averagePMPM,
      treatedPatientYears: s.treatedPatientYears,
      peakTreatedPatients: s.peakTreatedPatients,
      costPerTreatedPatient: s.costPerTreatedPatient,
      breakEvenAnnualPrice: s.breakEvenAnnualPrice,
      eventsAvoidedTotal: s.eventsAvoidedTotal,
      hospitalCostAvoidedTotal: s.hospitalCostAvoidedTotal,
    },
  };
  const next = [...runs, run];
  persist(next);
  return next;
}

export function deleteRun(id) {
  const next = loadRuns().filter((r) => r.id !== id);
  persist(next);
  return next;
}


export function clearRuns() {
  persist([]);
  return [];
}
