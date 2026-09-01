import { useEffect, useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  CartesianGrid,
  Legend,
  LineChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import NumberField from "../components/NumberField.jsx";
import MetricCard from "../components/MetricCard.jsx";
import TreatmentTable from "../components/TreatmentTable.jsx";
import UptakeTable from "../components/UptakeTable.jsx";
import OutcomeTable from "../components/OutcomeTable.jsx";
import {
  calculateModel,
  getDefaultModel,
  getRefreshLog,
  getTrials,
  listRuns,
  saveRun,
  syncClinicalTrials,
  syncWorldBank,
  uploadWorkbook,
} from "../services/api.js";

function money(value, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function number(value, digits = 0) {
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: digits,
  }).format(Number(value || 0));
}

const tabs = [
  "Population",
  "Current Care",
  "New Intervention",
  "Uptake",
  "Outcomes",
  "Results",
  "Data & Audit",
];

export default function Dashboard() {
  const [model, setModel] = useState(null);
  const [result, setResult] = useState(null);
  const [tab, setTab] = useState("Population");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [runs, setRuns] = useState([]);
  const [refreshLog, setRefreshLog] = useState([]);
  const [trials, setTrials] = useState([]);

  useEffect(() => {
    getDefaultModel().then(setModel).catch((e) => setMessage(e.message));
  }, []);

  async function calculate() {
    if (!model) return;
    setBusy(true);
    setMessage("");
    try {
      const r = await calculateModel(model);
      setResult(r);
      setTab("Results");
    } catch (error) {
      setMessage(error.response?.data?.error || error.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleExcel(file) {
    if (!file) return;
    setBusy(true);
    setMessage("");
    try {
      const data = await uploadWorkbook(file);
      setModel(data.model);
      setResult(null);
      setMessage(`Imported ${file.name}`);
    } catch (error) {
      setMessage(error.response?.data?.error || error.message);
    } finally {
      setBusy(false);
    }
  }

  async function storeRun() {
    if (!model || !result) return;
    try {
      const saved = await saveRun(model, result);
      setMessage(`Saved model run ${saved.id}`);
    } catch (error) {
      setMessage(error.response?.data?.error || error.message);
    }
  }

  async function loadAudit() {
    const [r, logs, t] = await Promise.all([
      listRuns(),
      getRefreshLog(),
      getTrials(model?.diseaseCode || "OBESITY"),
    ]);
    setRuns(r);
    setRefreshLog(logs);
    setTrials(t);
  }

  async function doPublicSync() {
    setBusy(true);
    setMessage("");
    try {
      await syncWorldBank({
        countryCode: model.countryCode,
        diseaseCode: model.diseaseCode,
      });
      await syncClinicalTrials({
        diseaseCode: model.diseaseCode,
        condition: model.diseaseName.split("/")[0].trim(),
        pageSize: 20,
      });
      await loadAudit();
      setMessage("Public-data sync completed.");
    } catch (error) {
      setMessage(error.response?.data?.error || error.message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (tab === "Data & Audit" && model) {
      loadAudit().catch(() => {});
    }
  }, [tab, model?.diseaseCode]);

  if (!model) return <div className="loading">Loading model…</div>;

  const set = (key, value) => setModel((m) => ({ ...m, [key]: value }));

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <h1>Early-Stage Budget Impact Estimator</h1>
          <p>Disease-agnostic POC • React + Node.js + PostgreSQL</p>
        </div>
        <div className="top-actions">
          <label className="upload-button">
            Import Excel
            <input
              type="file"
              accept=".xlsx"
              onChange={(e) => handleExcel(e.target.files?.[0])}
              hidden
            />
          </label>
          <button onClick={calculate} disabled={busy}>
            {busy ? "Working…" : "Calculate"}
          </button>
        </div>
      </header>

      {message ? <div className="message">{message}</div> : null}

      <section className="model-strip">
        <label>
          Disease code
          <input
            value={model.diseaseCode}
            onChange={(e) => set("diseaseCode", e.target.value)}
          />
        </label>
        <label>
          Disease / indication
          <input
            value={model.diseaseName}
            onChange={(e) => set("diseaseName", e.target.value)}
          />
        </label>
        <label>
          Country
          <input
            value={model.countryName}
            onChange={(e) => set("countryName", e.target.value)}
          />
        </label>
        <label>
          Currency
          <input
            value={model.currency}
            onChange={(e) => set("currency", e.target.value)}
          />
        </label>
        <label>
          Perspective
          <select
            value={model.perspective}
            onChange={(e) => set("perspective", e.target.value)}
          >
            <option>Government payer</option>
            <option>Insurer</option>
            <option>Health system</option>
            <option>Employer</option>
          </select>
        </label>
      </section>

      <nav className="tabs">
        {tabs.map((t) => (
          <button
            key={t}
            className={tab === t ? "active" : ""}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </nav>

      <main className="content">
        {tab === "Population" ? (
          <section>
            <h2>Population → Epidemiology → Eligibility</h2>
            <div className="grid-3">
              <NumberField
                label="Covered population"
                value={model.coveredPopulation}
                onChange={(v) => set("coveredPopulation", v)}
                min={0}
              />
              <NumberField
                label="Annual population growth"
                value={model.annualPopulationGrowth}
                onChange={(v) => set("annualPopulationGrowth", v)}
                step={0.001}
                min={0}
                max={1}
                suffix="share"
              />
              <NumberField
                label="Disease prevalence"
                value={model.prevalence}
                onChange={(v) => set("prevalence", v)}
                step={0.01}
                min={0}
                max={1}
                suffix="share"
              />

              <NumberField
                label="Diagnosis rate"
                value={model.diagnosisRate}
                onChange={(v) => set("diagnosisRate", v)}
                step={0.01}
                min={0}
                max={1}
              />
              <NumberField
                label="Clinical eligibility"
                value={model.clinicalEligibility}
                onChange={(v) => set("clinicalEligibility", v)}
                step={0.01}
                min={0}
                max={1}
              />
              <NumberField
                label="Payer eligibility"
                value={model.payerEligibility}
                onChange={(v) => set("payerEligibility", v)}
                step={0.01}
                min={0}
                max={1}
              />

              <NumberField
                label="Access rate"
                value={model.accessRate}
                onChange={(v) => set("accessRate", v)}
                step={0.01}
                min={0}
                max={1}
              />
              <NumberField
                label="Treatment willingness"
                value={model.willingnessRate}
                onChange={(v) => set("willingnessRate", v)}
                step={0.01}
                min={0}
                max={1}
              />
              <NumberField
                label="Annual prevalence growth"
                value={model.annualPrevalenceGrowth}
                onChange={(v) => set("annualPrevalenceGrowth", v)}
                step={0.001}
                min={0}
                max={1}
              />

              <NumberField
                label="Base year"
                value={model.baseYear}
                onChange={(v) => set("baseYear", v)}
                min={2020}
                max={2100}
              />
              <NumberField
                label="Time horizon"
                value={model.timeHorizonYears}
                onChange={(v) => set("timeHorizonYears", v)}
                min={1}
                max={5}
                suffix="years"
              />
              <NumberField
                label="BMI threshold"
                value={model.bmiMin}
                onChange={(v) => set("bmiMin", v)}
                step={0.5}
                min={0}
              />
            </div>

            <div className="formula-card">
              <strong>Eligible patients</strong>
              <span>
                Covered population × prevalence × diagnosis × clinical
                eligibility × payer eligibility × access × willingness
              </span>
            </div>
          </section>
        ) : null}

        {tab === "Current Care" ? (
          <section>
            <h2>Current-care treatment mix</h2>
            <p className="muted">
              Shares must sum to 1.00. Uptake of the new intervention
              proportionally displaces this mix.
            </p>
            <TreatmentTable
              rows={model.currentTreatments}
              onChange={(rows) => set("currentTreatments", rows)}
            />
          </section>
        ) : null}

        {tab === "New Intervention" ? (
          <section>
            <h2>New intervention</h2>
            <div className="grid-3">
              <label className="field">
                <span>Intervention name</span>
                <input
                  value={model.newIntervention.treatmentName}
                  onChange={(e) =>
                    setModel((m) => ({
                      ...m,
                      newIntervention: {
                        ...m.newIntervention,
                        treatmentName: e.target.value,
                      },
                    }))
                  }
                />
              </label>

              {[
                ["annualDrugCost", "Annual drug cost"],
                ["annualAdminCost", "Annual administration cost"],
                ["annualMonitoringCost", "Annual monitoring cost"],
                ["annualDeviceCost", "Annual device cost"],
                ["adherence", "Adherence"],
                ["persistence", "Persistence"],
                ["discontinuation", "Discontinuation"],
              ].map(([key, label]) => (
                <NumberField
                  key={key}
                  label={label}
                  value={model.newIntervention[key]}
                  onChange={(v) =>
                    setModel((m) => ({
                      ...m,
                      newIntervention: {
                        ...m.newIntervention,
                        [key]: v,
                      },
                    }))
                  }
                  step={
                    ["adherence", "persistence", "discontinuation"].includes(
                      key
                    )
                      ? 0.01
                      : 100
                  }
                  min={0}
                  max={
                    ["adherence", "persistence", "discontinuation"].includes(
                      key
                    )
                      ? 1
                      : undefined
                  }
                />
              ))}
            </div>

            <div className="info-card">
              Early-stage price, uptake and access assumptions should be
              modeled as scenario inputs rather than treated as known facts.
            </div>
          </section>
        ) : null}

        {tab === "Uptake" ? (
          <section>
            <h2>Year-wise market uptake</h2>
            <UptakeTable
              rows={model.uptake}
              onChange={(rows) => set("uptake", rows)}
              years={model.timeHorizonYears}
            />
          </section>
        ) : null}

        {tab === "Outcomes" ? (
          <section>
            <h2>Clinical outcomes and medical-cost offsets</h2>
            <OutcomeTable
              rows={model.outcomes}
              onChange={(rows) => set("outcomes", rows)}
            />
          </section>
        ) : null}

        {tab === "Results" ? (
          <section>
            <div className="section-heading-row">
              <div>
                <h2>Budget impact results</h2>
                <p className="muted">
                  Current care compared with a scenario including the new
                  intervention.
                </p>
              </div>
              <button
                className="secondary"
                disabled={!result}
                onClick={storeRun}
              >
                Save run to PostgreSQL
              </button>
            </div>

            {!result ? (
              <div className="empty-state">
                Click <strong>Calculate</strong> to generate results.
              </div>
            ) : (
              <>
                <div className="metric-grid">
                  <MetricCard
                    label="Year 1 eligible patients"
                    value={number(result.summary.year1EligiblePatients)}
                  />
                  <MetricCard
                    label="Current-care total"
                    value={money(
                      result.summary.currentCostTotal,
                      model.currency
                    )}
                  />
                  <MetricCard
                    label="New-scenario total"
                    value={money(result.summary.newCostTotal, model.currency)}
                  />
                  <MetricCard
                    label="Net budget impact"
                    value={money(
                      result.summary.netBudgetImpactTotal,
                      model.currency
                    )}
                  />
                  <MetricCard
                    label="Year 1 PMPM"
                    value={money(result.summary.year1PMPM, model.currency)}
                  />
                  <MetricCard
                    label="Medical-cost offsets"
                    value={money(
                      result.summary.medicalCostOffsetTotal,
                      model.currency
                    )}
                  />
                </div>

                <div className="chart-grid">
                  <div className="chart-card">
                    <h3>Current vs new scenario</h3>
                    <ResponsiveContainer width="100%" height={320}>
                      <LineChart data={result.annualResults}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="calendarYear" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line
                          dataKey="currentScenarioCost"
                          name="Current scenario"
                        />
                        <Line
                          dataKey="newScenarioCost"
                          name="New scenario"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="chart-card">
                    <h3>Net budget impact</h3>
                    <ResponsiveContainer width="100%" height={320}>
                      <BarChart data={result.annualResults}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="calendarYear" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="netBudgetImpact" name="Net impact" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Year</th>
                        <th>Eligible</th>
                        <th>New intervention</th>
                        <th>Uptake</th>
                        <th>Current cost</th>
                        <th>New cost</th>
                        <th>Net impact</th>
                        <th>PMPM</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.annualResults.map((r) => (
                        <tr key={r.modelYear}>
                          <td>{r.calendarYear}</td>
                          <td>{number(r.eligiblePatients)}</td>
                          <td>{number(r.newInterventionPatients)}</td>
                          <td>{(r.uptake * 100).toFixed(1)}%</td>
                          <td>{money(r.currentScenarioCost, model.currency)}</td>
                          <td>{money(r.newScenarioCost, model.currency)}</td>
                          <td>{money(r.netBudgetImpact, model.currency)}</td>
                          <td>{money(r.pmpm, model.currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        ) : null}

        {tab === "Data & Audit" ? (
          <section>
            <div className="section-heading-row">
              <div>
                <h2>Public data, audit and model history</h2>
                <p className="muted">
                  Public data are versioned; user overrides should be stored
                  separately.
                </p>
              </div>
              <button onClick={doPublicSync} disabled={busy}>
                Sync public sources
              </button>
            </div>

            <div className="formula-card">
              <strong>Recommended precedence</strong>
              <span>
                User override → validated curated value → public source →
                default assumption
              </span>
            </div>

            <h3>Recent source refreshes</h3>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Source</th>
                    <th>Started</th>
                    <th>Status</th>
                    <th>Received</th>
                    <th>Inserted</th>
                    <th>Error</th>
                  </tr>
                </thead>
                <tbody>
                  {refreshLog.map((r) => (
                    <tr key={r.id}>
                      <td>{r.source_code}</td>
                      <td>{new Date(r.job_started_at).toLocaleString()}</td>
                      <td>{r.status}</td>
                      <td>{r.records_received}</td>
                      <td>{r.records_inserted}</td>
                      <td>{r.error_message || ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3>Latest trial snapshots</h3>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>NCT ID</th>
                    <th>Intervention</th>
                    <th>Phase</th>
                    <th>Status</th>
                    <th>Sponsor</th>
                    <th>Enrollment</th>
                  </tr>
                </thead>
                <tbody>
                  {trials.slice(0, 20).map((t) => (
                    <tr key={t.nct_id}>
                      <td>{t.nct_id}</td>
                      <td>{t.intervention_name}</td>
                      <td>{t.phase}</td>
                      <td>{t.overall_status}</td>
                      <td>{t.sponsor}</td>
                      <td>{t.enrollment}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3>Saved BIA runs</h3>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Created</th>
                    <th>Model</th>
                    <th>Disease</th>
                    <th>Scenario</th>
                    <th>Net impact</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((r) => (
                    <tr key={r.id}>
                      <td>{new Date(r.created_at).toLocaleString()}</td>
                      <td>{r.model_name}</td>
                      <td>{r.disease_code}</td>
                      <td>{r.scenario_id}</td>
                      <td>
                        {money(
                          r.summary_json?.netBudgetImpactTotal,
                          r.currency
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
