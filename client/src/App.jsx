import { useEffect, useMemo, useRef, useState } from "react";
import { calculateBudgetImpact } from "./lib/biaEngine.js";
import { getDefaultModel } from "./lib/defaultModel.js";
import { defaultModelFor, demoScenario } from "./lib/diseases.js";
import { clearRuns, deleteRun, loadRuns, saveRun } from "./lib/runs.js";
import Assistant from "./components/Assistant.jsx";
import Runbook from "./components/Runbook.jsx";
import Icon from "./components/Icons.jsx";
import { clearSession, loadSession, saveSession } from "./lib/util.js";
import { downloadTemplate, importWorkbook } from "./lib/excel.js";
import Results from "./pages/Results.jsx";
import EviTrack from "./features/evitrack/EviTrack.jsx";
import {
  StepComparators, StepIntervention, StepOutcomes,
  StepPopulation, StepTherapy, StepUptake,
} from "./steps/Steps.jsx";

const STEPS = [
  { id: "therapy",   icon: "therapy",      label: "Therapy area", title: "Therapy area and perspective", blurb: "Start by fixing what is being modelled, for whom, and over how long.", Body: StepTherapy },
  { id: "population",icon: "population",   label: "Population",   title: "Population and eligibility",   blurb: "Everything that narrows covered lives down to treatable patients.",      Body: StepPopulation },
  { id: "current",   icon: "care",         label: "Current care", title: "Current care comparators",     blurb: "What these patients receive today, and what it costs.",                 Body: StepComparators },
  { id: "new",       icon: "intervention", label: "Intervention", title: "New intervention",             blurb: "The drug or device being introduced, and its price.",                   Body: StepIntervention },
  { id: "uptake",    icon: "uptake",       label: "Uptake",       title: "Uptake and treatment behaviour", blurb: "How fast it is adopted, and how well patients stay on it.",           Body: StepUptake },
  { id: "outcomes",  icon: "outcomes",     label: "Outcomes",     title: "Clinical outcomes",            blurb: "Events the intervention prevents, and what each one costs.",            Body: StepOutcomes },
];

export default function App() {
  const [model, setModel] = useState(() => loadSession(getDefaultModel()));
  const [stepIndex, setStepIndex] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [view, setView] = useState("bia");
  const [notice, setNotice] = useState(null);
  const [runbookOpen, setRunbookOpen] = useState(false);
  const [runs, setRuns] = useState(loadRuns);
  const fileRef = useRef(null);

  useEffect(() => saveSession(model), [model]);

  const set = (patch) => setModel((m) => ({ ...m, ...patch }));

  // Switching disease replaces the whole model with that disease's defaults,
  // rather than patching fields, so comparators, outcomes and subgroups all
  // move together.
  const onDisease = (code) => {
    const next = defaultModelFor(code);
    setModel(next);
    const short = next.diseaseName.split(/[/(]/)[0].trim();
    setNotice({ kind: "info", text: `Loaded default ${short} model.` });
  };

  // Loads the demo INPUTS and stays on step 1. Jumping straight to Results
  // skipped the part a demo is meant to show -- where the numbers come from --
  // so every tab is now pre-filled and you walk them in order.
  const loadDemo = () => {
    setModel(demoScenario());
    setStepIndex(0);
    setShowResults(false);
    setNotice({
      kind: "info",
      text:
        "Demonstration scenario loaded: Drug X in Germany (Type 2 diabetes). " +
        "Every tab is pre-filled -- walk through them in order and open Results at the end. " +
        "All values are illustrative demonstration data only.",
    });
  };

  const onSaveRun = () => {
    if (!result) return;
    const next = saveRun(model, result);
    setRuns(next);
    setNotice({ kind: "info", text: `Saved ${next.at(-1).label}. Compare it on the Runs tab.` });
  };
  const onDeleteRun = (id) => setRuns(deleteRun(id));
  const onClearRuns = () => setRuns(clearRuns());

  // Recomputed on every keystroke: the engine is pure and runs in the browser,
  // so there is no server round-trip to debounce.
  const { result, error } = useMemo(() => {
    try {
      return { result: calculateBudgetImpact(model), error: null };
    } catch (e) {
      return { result: null, error: e.message };
    }
  }, [model]);

  const onImport = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const { model: next, applied, warnings } = await importWorkbook(file, model);
      setModel(next);
      setNotice({
        kind: "info",
        text: `Imported ${applied} values from ${file.name}.${
          warnings.length ? ` ${warnings.join(" ")}` : ""
        }`,
      });
    } catch (e) {
      setNotice({ kind: "error", text: e.message });
    }
  };

  const reset = () => {
    clearSession();
    clearRuns();
    setRuns([]);
    setModel(getDefaultModel());
    setStepIndex(0);
    setShowResults(false);
    setNotice({ kind: "info", text: "Reset to default obesity model." });
  };

  const step = STEPS[stepIndex];
  const isLast = stepIndex === STEPS.length - 1;

  return (
    <div className="app">
      <header className="topbar">
        <div className="wordmark">
          <b>BIET</b>
          <span>Budget Impact Estimation Tool</span>
        </div>
        <span className="chip">
          {model.therapyArea} · {model.diseaseName.split(/[/(]/)[0].trim()}
        </span>
        <div className="topbar-nav">
          <button className={`btn sm${view === "bia" ? " primary" : ""}`} onClick={() => setView("bia")}>BIA</button>
          <button className={`btn sm${view === "evitrack" ? " primary" : ""}`} onClick={() => setView("evitrack")}>EviTrack</button>
        </div>
        <span className="topbar-spacer" />
        <input
          ref={fileRef} type="file" accept=".xlsx,.xls"
          style={{ display: "none" }} onChange={onImport}
        />
        <button
          className="btn primary sm"
          onClick={() => setRunbookOpen(true)}
          title="Open the demo runbook — the scenario, what to enter, and the figures to expect"
        >
          <Icon name="book" size={14} /> Demo runbook
        </button>
        <button className="btn sm" onClick={() => fileRef.current?.click()} title="Load inputs from an Excel workbook">
          Import Excel
        </button>
        <button className="btn sm" onClick={() => { downloadTemplate(model); }} title="Download an Excel template pre-filled with the current model">
          Template
        </button>
        <button className="btn ghost sm" onClick={reset} title="Clear everything and reload the default model">Reset</button>
      </header>

      {view === "bia" && (
        <nav className="stepper">
        {STEPS.map((s, i) => (
          <button
            key={s.id}
            title={s.blurb}
            className={`step-btn${i === stepIndex && !showResults ? " active" : ""}${
              i < stepIndex ? " done" : ""
            }`}
            onClick={() => { setStepIndex(i); setShowResults(false); }}
          >
            <span className="num">
              {i < stepIndex ? <Icon name="check" size={13} /> : <Icon name={s.icon} size={14} />}
            </span>
            {s.label}
          </button>
        ))}
        <button
          className={`step-btn${showResults ? " active" : ""}`}
          onClick={() => setShowResults(true)}
          disabled={!result}
          title="Budget impact, scenarios, clinical outcomes and saved runs"
        >
          <span className="num"><Icon name="results" size={14} /></span>
          Results
        </button>
        </nav>
      )}

      {view === "bia" ? (
        <main className="main">
        {notice && (
          <div className={`alert${notice.kind === "info" ? " info" : ""}`}>
            <span>{notice.text}</span>
            <span style={{ flex: 1 }} />
            <button className="btn ghost sm" onClick={() => setNotice(null)}>Dismiss</button>
          </div>
        )}

        {error && !showResults && <div className="alert">{error}</div>}

        {showResults ? (
          result ? (
            <Results
              model={model}
              result={result}
              runs={runs}
              onSaveRun={onSaveRun}
              onDeleteRun={onDeleteRun}
              onClearRuns={onClearRuns}
            />
          ) : (
            <div className="alert">{error}</div>
          )
        ) : (
          <div className="card">
            <div className="card-head">
              <h2>{step.title}</h2>
              <p>{step.blurb}</p>
            </div>

            <step.Body model={model} set={set} onDisease={onDisease} />

            <div className="nav-row">
              <button
                className="btn" disabled={stepIndex === 0}
                onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
              >
                Back
              </button>
              <span className="spacer" />
              <span className="muted" style={{ fontSize: 12.5 }}>
                Step {stepIndex + 1} of {STEPS.length}
              </span>
              {isLast ? (
                <button
                  className="btn primary" disabled={!result}
                  onClick={() => setShowResults(true)}
                >
                  View results →
                </button>
              ) : (
                <button className="btn primary" onClick={() => setStepIndex((i) => i + 1)}>
                  Next →
                </button>
              )}
            </div>
          </div>
        )}
        </main>
      ) : (
        <main className="main">
          <EviTrack />
        </main>
      )}

      {view === "bia" && (
        <Assistant model={model} result={result} />
      )}

      <Runbook
        open={runbookOpen}
        onClose={() => setRunbookOpen(false)}
        onLoadDemo={loadDemo}
      />
    </div>
  );
}
