import { useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { count, money, moneyShort, pct } from "../lib/util.js";
import { exportReport } from "../lib/pdf.js";
import Icon from "../components/Icons.jsx";

/* Validated categorical series - see the palette check in the build notes.
   The brand indigo/violet pair fails CVD separation as adjacent series, so
   charts use indigo / teal / orange instead. */
const SERIES = ["var(--s1)", "var(--s2)", "var(--s3)"];
const POSITIVE = "var(--positive)";
const NEGATIVE = "var(--negative)";

const axis = { stroke: "var(--ink-muted)", fontSize: 11, tickLine: false };
const grid = { stroke: "var(--border)", strokeDasharray: "3 3", vertical: false };

function tooltipStyle() {
  return {
    background: "var(--surface)",
    border: "1px solid var(--border-strong)",
    borderRadius: 8,
    fontSize: 12,
    color: "var(--ink)",
    boxShadow: "0 4px 16px rgba(0,0,0,.10)",
  };
}

function Kpi({ label, value, sub, tone }) {
  return (
    <div className="kpi">
      <div className="k-label">{label}</div>
      <div className={`k-value${tone ? ` ${tone}` : ""}`}>{value}</div>
      {sub && <div className="k-sub">{sub}</div>}
    </div>
  );
}

function Legend2({ items }) {
  return (
    <div className="legend">
      {items.map((it) => (
        <span className="legend-item" key={it.label}>
          <span className="legend-swatch" style={{ background: it.color }} />
          {it.label}
        </span>
      ))}
    </div>
  );
}

export default function Results({ model, result, runs = [], onSaveRun, onDeleteRun, onClearRuns }) {
  const [tab, setTab] = useState("impact");
  const [exporting, setExporting] = useState(false);

  const onExport = async () => {
    setExporting(true);
    try {
      await exportReport(model, result);
    } catch (e) {
      alert("Could not generate the PDF: " + e.message);
    } finally {
      setExporting(false);
    }
  };
  const cur = model.currency;
  const s = result.summary;
  const increases = s.netBudgetImpactTotal >= 0;

  const byYear = result.annualResults.map((r) => ({
    year: `Y${r.modelYear}`,
    calendar: r.calendarYear,
    net: r.netBudgetImpact,
    cumulative: r.cumulativeImpact,
    current: r.currentScenarioCost,
    proposed: r.newScenarioCost,
    patients: r.newInterventionPatients,
    pmpm: r.pmpm,
  }));

  const scenarioSeries = result.annualResults.map((r, i) => {
    const row = { year: `Y${r.modelYear}` };
    for (const sc of result.scenarios) row[sc.scenarioId] = sc.annual[i].cumulativeImpact;
    return row;
  });

  return (
    <>
      <div className="hero">
        <div className="label">
          Net budget impact · {model.timeHorizonYears} years · {model.perspective}
        </div>
        <div className="value">{moneyShort(s.netBudgetImpactTotal, cur)}</div>
        <div className="sub">
          {increases ? "Additional spend" : "Net saving"} versus current care ·{" "}
          {money(s.year1PMPM, cur)} PMPM in year 1
        </div>
      </div>

      <div className="tabs" style={{ alignItems: "center" }}>
        <button className={`tab${tab === "impact" ? " active" : ""}`} onClick={() => setTab("impact")} title="Net impact, cost per patient and the year-by-year table">
          <Icon name="budget" size={15} /> Budget impact
        </button>
        <button className={`tab${tab === "scenarios" ? " active" : ""}`} onClick={() => setTab("scenarios")} title="Budget impact under low, base and high uptake">
          <Icon name="scenarios" size={15} /> Scenarios
        </button>
        <button className={`tab${tab === "clinical" ? " active" : ""}`} onClick={() => setTab("clinical")} title="Events avoided and medical costs offset">
          <Icon name="clinical" size={15} /> Clinical outcomes
        </button>
        <button className={`tab${tab === "runs" ? " active" : ""}`} onClick={() => setTab("runs")} title="Compare saved runs side by side">
          <Icon name="runs" size={15} /> Runs{runs.length ? ` (${runs.length})` : ""}
        </button>
        <span style={{ flex: 1 }} />
        <button className="btn sm" onClick={onExport} disabled={exporting} title="Download a formatted PDF report of these results" style={{ marginBottom: 6, marginRight: 8 }}>
          <Icon name="pdf" size={14} /> {exporting ? "Preparing…" : "Export PDF"}
        </button>
        <button className="btn primary sm" onClick={onSaveRun} title="Snapshot the current inputs and outputs for comparison" style={{ marginBottom: 6 }}>
          + Save run
        </button>
      </div>

      {tab === "impact" && (
        <>
          <div className="kpis" style={{ marginBottom: 16 }}>
            <Kpi label="Current care, total" value={moneyShort(s.currentCostTotal, cur)} />
            <Kpi label="With intervention" value={moneyShort(s.newCostTotal, cur)} />
            <Kpi
              label="Net impact"
              value={moneyShort(s.netBudgetImpactTotal, cur)}
              tone={increases ? "neg" : "pos"}
              sub={increases ? "cost increase" : "saving"}
            />
            <Kpi label="Patients treated" value={count(s.peakTreatedPatients)} sub="at peak year" />
            <Kpi label="Cost per treated patient" value={money(s.costPerTreatedPatient, cur)} sub="per year" />
            <Kpi
              label="Break-even price"
              value={s.breakEvenAnnualPrice === null ? "n/a" : money(s.breakEvenAnnualPrice, cur)}
              sub="annual, to reach zero impact"
            />
          </div>

          <div className="card">
            <div className="card-head">
              <h2>Budget impact by year</h2>
              <p>Red bars add cost, green bars save it, against current care.</p>
            </div>
            <Legend2
              items={[
                { label: "Cost increase", color: NEGATIVE },
                { label: "Saving", color: POSITIVE },
              ]}
            />
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={byYear} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                <CartesianGrid {...grid} />
                <XAxis dataKey="year" {...axis} axisLine={false} />
                <YAxis {...axis} axisLine={false} tickFormatter={(v) => moneyShort(v, cur)} width={72} />
                <Tooltip
                  contentStyle={tooltipStyle()}
                  cursor={{ fill: "var(--sunken)" }}
                  formatter={(v) => [money(v, cur), "Net impact"]}
                />
                <Bar dataKey="net" radius={[4, 4, 0, 0]} maxBarSize={54} isAnimationActive={false}>
                  {byYear.map((row) => (
                    <Cell key={row.year} fill={row.net >= 0 ? NEGATIVE : POSITIVE} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <div className="card-head">
              <h2>Cumulative impact</h2>
              <p>Running total across the {model.timeHorizonYears}-year horizon.</p>
            </div>
            <ResponsiveContainer width="100%" height={230}>
              <LineChart data={byYear} margin={{ top: 4, right: 12, left: 8, bottom: 4 }}>
                <CartesianGrid {...grid} />
                <XAxis dataKey="year" {...axis} axisLine={false} />
                <YAxis {...axis} axisLine={false} tickFormatter={(v) => moneyShort(v, cur)} width={72} />
                <Tooltip
                  contentStyle={tooltipStyle()}
                  formatter={(v) => [money(v, cur), "Cumulative"]}
                />
                <Line
                  type="monotone" dataKey="cumulative" stroke={SERIES[0]} strokeWidth={2}
                  dot={{ r: 4, strokeWidth: 0, fill: SERIES[0] }} activeDot={{ r: 6 }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <div className="card-head"><h2>Year by year</h2></div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Year</th><th>Patients treated</th><th>Current care</th>
                    <th>With intervention</th><th>Net impact</th><th>PMPM</th>
                  </tr>
                </thead>
                <tbody>
                  {byYear.map((r) => (
                    <tr key={r.year}>
                      <td>{r.calendar}</td>
                      <td>{count(r.patients)}</td>
                      <td>{money(r.current, cur)}</td>
                      <td>{money(r.proposed, cur)}</td>
                      <td style={{ color: r.net >= 0 ? "var(--negative)" : "var(--positive)" }}>
                        {money(r.net, cur)}
                      </td>
                      <td>{money(r.pmpm, cur)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td>Total</td>
                    <td>{count(s.treatedPatientYears)}</td>
                    <td>{money(s.currentCostTotal, cur)}</td>
                    <td>{money(s.newCostTotal, cur)}</td>
                    <td style={{ color: increases ? "var(--negative)" : "var(--positive)" }}>
                      {money(s.netBudgetImpactTotal, cur)}
                    </td>
                    <td>{money(s.averagePMPM, cur)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === "scenarios" && (
        <>
          <div className="kpis" style={{ marginBottom: 16 }}>
            {result.scenarios.map((sc, i) => (
              <Kpi
                key={sc.scenarioId}
                label={sc.label}
                value={moneyShort(sc.netBudgetImpactTotal, cur)}
                sub={`${pct(sc.uptakeScale - 1, 0)} vs base uptake · ${count(sc.treatedPatientYears)} patient-years`}
              />
            ))}
          </div>

          <div className="card">
            <div className="card-head">
              <h2>Cumulative impact by uptake scenario</h2>
              <p>Same inputs, adoption scaled to half and one-and-a-half times the base case.</p>
            </div>
            <Legend2
              items={result.scenarios.map((sc, i) => ({ label: sc.label, color: SERIES[i] }))}
            />
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={scenarioSeries} margin={{ top: 4, right: 12, left: 8, bottom: 4 }}>
                <CartesianGrid {...grid} />
                <XAxis dataKey="year" {...axis} axisLine={false} />
                <YAxis {...axis} axisLine={false} tickFormatter={(v) => moneyShort(v, cur)} width={72} />
                <Tooltip contentStyle={tooltipStyle()} formatter={(v) => money(v, cur)} />
                {result.scenarios.map((sc, i) => (
                  <Line
                    key={sc.scenarioId} type="monotone" dataKey={sc.scenarioId}
                    name={sc.label} stroke={SERIES[i]} strokeWidth={2}
                    dot={{ r: 4, strokeWidth: 0, fill: SERIES[i] }} activeDot={{ r: 6 }}
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <div className="card-head"><h2>Scenario comparison</h2></div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Scenario</th><th>Uptake</th><th>Patient-years</th>
                    <th>Net impact</th><th>Year 1 PMPM</th>
                  </tr>
                </thead>
                <tbody>
                  {result.scenarios.map((sc) => (
                    <tr key={sc.scenarioId}>
                      <td>{sc.label}</td>
                      <td>{`${(sc.uptakeScale * 100).toFixed(0)}% of base`}</td>
                      <td>{count(sc.treatedPatientYears)}</td>
                      <td style={{ color: sc.netBudgetImpactTotal >= 0 ? "var(--negative)" : "var(--positive)" }}>
                        {money(sc.netBudgetImpactTotal, cur)}
                      </td>
                      <td>{money(sc.year1PMPM, cur)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === "clinical" && (
        <>
          <div className="kpis" style={{ marginBottom: 16 }}>
            <Kpi label="Weight-loss responders" value={count(s.weightLossResponders)} sub="patient-years at target loss" />
            <Kpi label="Events avoided" value={count(s.eventsAvoidedTotal)} sub="across all outcomes" />
            <Kpi label="Hospital costs avoided" value={moneyShort(s.hospitalCostAvoidedTotal, cur)} tone="pos" />
            <Kpi label="Eligible patients" value={count(s.year1EligiblePatients)} sub="year 1" />
          </div>

          <div className="card">
            <div className="card-head">
              <h2>Events avoided by outcome</h2>
              <p>Over the full horizon, after weight regain erodes the benefit.</p>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Outcome</th><th>Events avoided</th><th>Cost avoided</th></tr>
                </thead>
                <tbody>
                  {result.eventsAvoided.map((e) => (
                    <tr key={e.outcomeCode}>
                      <td>{e.outcomeName}</td>
                      <td>{count(e.eventsAvoided)}</td>
                      <td style={{ color: "var(--positive)" }}>{money(e.costAvoided, cur)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td>Total</td>
                    <td>{count(s.eventsAvoidedTotal)}</td>
                    <td style={{ color: "var(--positive)" }}>{money(s.hospitalCostAvoidedTotal, cur)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === "runs" && (
        <RunsTab
          runs={runs}
          model={model}
          result={result}
          onDelete={onDeleteRun}
          onClear={onClearRuns}
        />
      )}
    </>
  );
}

/* Comparative table of saved runs, newest columns on the right. The live model
   is shown as a trailing "Current" column so a saved run can be read against
   what is on screen now. */
function RunsTab({ runs, model, result, onDelete, onClear }) {
  const cur = model.currency;
  const s = result.summary;

  const columns = [
    ...runs.map((r) => ({ id: r.id, label: r.label, badge: r.n, m: r.metrics, meta: r, saved: true })),
    {
      id: "current",
      label: "Current",
      badge: "•",
      current: true,
      m: {
        netBudgetImpactTotal: s.netBudgetImpactTotal,
        year1PMPM: s.year1PMPM,
        treatedPatientYears: s.treatedPatientYears,
        peakTreatedPatients: s.peakTreatedPatients,
        costPerTreatedPatient: s.costPerTreatedPatient,
        breakEvenAnnualPrice: s.breakEvenAnnualPrice,
        eventsAvoidedTotal: s.eventsAvoidedTotal,
        hospitalCostAvoidedTotal: s.hospitalCostAvoidedTotal,
      },
      meta: {
        diseaseName: model.diseaseName,
        interventionName: model.newIntervention?.treatmentName,
        interventionPrice: model.newIntervention?.annualDrugCost,
      },
    },
  ];

  if (!runs.length) {
    return (
      <div className="card">
        <div className="runs-empty">
          <p style={{ fontSize: 15, color: "var(--ink)", marginBottom: 6 }}>No saved runs yet.</p>
          <p style={{ margin: 0 }}>
            Click <strong>+ Save run</strong> to snapshot the current inputs and outputs, change a
            price or the uptake, save again, and compare run 1, run 2, run 3 … side by side here.
          </p>
        </div>
      </div>
    );
  }

  const rows = [
    ["Disease", (c) => c.meta.diseaseName || "—", true],
    ["Intervention", (c) => c.meta.interventionName || "—", true],
    ["Annual price", (c) => money(c.meta.interventionPrice || 0, cur), false],
    ["Net budget impact", (c) => money(c.m.netBudgetImpactTotal, cur), false, "impact"],
    ["Year 1 PMPM", (c) => money(c.m.year1PMPM, cur), false],
    ["Patients treated (peak)", (c) => count(c.m.peakTreatedPatients), false],
    ["Patient-years", (c) => count(c.m.treatedPatientYears), false],
    ["Cost / treated patient", (c) => money(c.m.costPerTreatedPatient, cur), false],
    ["Break-even price", (c) => (c.m.breakEvenAnnualPrice == null ? "n/a" : money(c.m.breakEvenAnnualPrice, cur)), false],
    ["Events avoided", (c) => count(c.m.eventsAvoidedTotal), false],
    ["Hospital cost avoided", (c) => money(c.m.hospitalCostAvoidedTotal, cur), false],
  ];

  return (
    <div className="card">
      <div className="card-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
        <div>
          <h2>Run comparison</h2>
          <p>Each saved run against the model currently on screen.</p>
        </div>
        <button className="btn ghost sm danger" onClick={onClear}>Clear all</button>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Metric</th>
              {columns.map((c) => (
                <th key={c.id} className={c.current ? "run-current" : ""}>
                  <span className="run-col-head">
                    <span className="run-badge">{c.badge}</span>
                    {c.label}
                    {c.saved && (
                      <button
                        className="btn danger sm"
                        style={{ padding: "1px 6px", marginLeft: 4 }}
                        onClick={() => onDelete(c.id)}
                        title="Delete run"
                      >
                        ×
                      </button>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, fn, isText, kind]) => (
              <tr key={label}>
                <td>{label}</td>
                {columns.map((c) => {
                  const val = fn(c);
                  const impactTone =
                    kind === "impact"
                      ? c.m.netBudgetImpactTotal >= 0
                        ? "var(--negative)"
                        : "var(--positive)"
                      : undefined;
                  return (
                    <td key={c.id} style={{ color: impactTone, fontWeight: kind === "impact" ? 650 : undefined }}>
                      {val}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
