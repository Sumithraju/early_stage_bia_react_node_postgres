import { useMemo, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { count, money, moneyShort, pct } from "../lib/util.js";
import { exportReport } from "../lib/pdf.js";
import Icon from "../components/Icons.jsx";
import Funnel from "../components/Funnel.jsx";
import { tornado } from "../lib/sensitivity.js";

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

  // One-way sensitivity (20 recomputes on a small model — cheap, memoised).
  const torn = useMemo(() => tornado(model), [model]);
  const mostSensitive = torn.rows[0];
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

      <DecisionSummary
        model={model}
        result={result}
        mostSensitive={mostSensitive}
        onExport={onExport}
        exporting={exporting}
        onSaveRun={onSaveRun}
      />

      <div className="tabs scroll-tabs">
        <button className={`tab${tab === "impact" ? " active" : ""}`} onClick={() => setTab("impact")} title="Net impact, cost per patient and the year-by-year table">
          <Icon name="budget" size={15} /> Budget impact
        </button>
        <button className={`tab${tab === "compare" ? " active" : ""}`} onClick={() => setTab("compare")} title="Current market vs new drug, by cost component">
          <Icon name="scenarios" size={15} /> Current vs new
        </button>
        <button className={`tab${tab === "scenarios" ? " active" : ""}`} onClick={() => setTab("scenarios")} title="Budget impact under low, base and high uptake">
          <Icon name="uptake" size={15} /> Scenarios
        </button>
        <button className={`tab${tab === "sensitivity" ? " active" : ""}`} onClick={() => setTab("sensitivity")} title="Tornado: which assumption moves the result most">
          <Icon name="results" size={15} /> Sensitivity
        </button>
        <button className={`tab${tab === "clinical" ? " active" : ""}`} onClick={() => setTab("clinical")} title="Events avoided and medical costs offset">
          <Icon name="clinical" size={15} /> Clinical outcomes
        </button>
        <button className={`tab${tab === "methodology" ? " active" : ""}`} onClick={() => setTab("methodology")} title="Transparent calculation trace">
          <Icon name="budget" size={15} /> Methodology
        </button>
        <button className={`tab${tab === "runs" ? " active" : ""}`} onClick={() => setTab("runs")} title="Compare saved runs side by side">
          <Icon name="runs" size={15} /> Runs{runs.length ? ` (${runs.length})` : ""}
        </button>
      </div>

      {tab === "impact" && (
        <>
          <div className="kpis" style={{ marginBottom: 16 }}>
            <Kpi label="Without intervention" value={moneyShort(s.currentCostTotal, cur)} sub="current care, total" />
            <Kpi label="With intervention" value={moneyShort(s.newCostTotal, cur)} sub="total with new drug" />
            <Kpi
              label="Net impact"
              value={moneyShort(s.netBudgetImpactTotal, cur)}
              tone={increases ? "neg" : "pos"}
              sub={increases ? "cost increase" : "saving"}
            />
            <Kpi label="Affordability — PMPM" value={money(s.year1PMPM, cur)} sub="per member / month (Y1)" />
            <Kpi label="Affordability — PMPY" value={money(s.year1PMPY, cur)} sub="per member / year (Y1)" />
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
              <h2>With vs without intervention</h2>
              <p>Total annual spend under current care and with the new intervention.</p>
            </div>
            <Legend2
              items={[
                { label: "Without intervention", color: SERIES[0] },
                { label: "With intervention", color: SERIES[2] },
              ]}
            />
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={byYear} margin={{ top: 4, right: 8, left: 8, bottom: 4 }} barGap={4}>
                <CartesianGrid {...grid} />
                <XAxis dataKey="year" {...axis} axisLine={false} />
                <YAxis {...axis} axisLine={false} tickFormatter={(v) => moneyShort(v, cur)} width={72} />
                <Tooltip
                  contentStyle={tooltipStyle()}
                  cursor={{ fill: "var(--sunken)" }}
                  formatter={(v, name) => [money(v, cur), name]}
                />
                <Bar dataKey="current" name="Without intervention" fill={SERIES[0]} radius={[4, 4, 0, 0]} maxBarSize={26} isAnimationActive={false} />
                <Bar dataKey="proposed" name="With intervention" fill={SERIES[2]} radius={[4, 4, 0, 0]} maxBarSize={26} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
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
                    <th>Year</th><th>Patients treated</th><th>Without intervention</th>
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

      {tab === "compare" && <CompareTab model={model} result={result} />}

      {tab === "sensitivity" && <SensitivityTab torn={torn} cur={cur} />}

      {tab === "methodology" && <MethodologyTab model={model} result={result} />}

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

/* Budget-impact waterfall: floats each cost-component change from the running
   total, ending on a solid Net impact bar. This is the "why" visual — increased
   drug cost minus the offsets that follow. */
function WaterfallBridge({ steps, net, cur }) {
  // Running cumulative after each step; net should equal the last cumulative.
  let run = 0;
  const bars = steps.map((st) => {
    const from = run;
    run += st.diff;
    return { label: st.label, from, to: run, diff: st.diff, up: st.diff >= 0 };
  });
  bars.push({ label: "Net impact", from: 0, to: net, diff: net, total: true, up: net >= 0 });

  const vals = [0, ...bars.flatMap((b) => [b.from, b.to])];
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const y = (v) => ((max - v) / span) * 100; // % from top
  const zeroY = y(0);

  return (
    <div className="waterfall">
      <div className="wf-plot">
        <div className="wf-zero" style={{ top: `${zeroY}%` }} />
        {bars.map((b, i) => {
          const top = Math.min(y(b.from), y(b.to));
          const height = Math.max(Math.abs(y(b.to) - y(b.from)), 0.6);
          const color = b.total ? "var(--brand)" : b.up ? "var(--negative)" : "var(--positive)";
          return (
            <div className="wf-col" key={b.label}>
              <div
                className="wf-bar"
                style={{ top: `${top}%`, height: `${height}%`, background: color }}
                title={`${b.label}: ${b.up ? "+" : ""}${moneyShort(b.diff, cur)}`}
              />
              <div className="wf-val" style={{ top: `${Math.max(top - 7, 0)}%` }}>
                {b.up ? "+" : ""}{moneyShort(b.diff, cur)}
              </div>
            </div>
          );
        })}
      </div>
      <div className="wf-labels">
        {bars.map((b) => (
          <div key={b.label} className={`wf-label${b.total ? " total" : ""}`}>{b.label}</div>
        ))}
      </div>
    </div>
  );
}

/* Executive decision-intelligence summary, always visible above the tabs. */
function DecisionSummary({ model, result, mostSensitive, onExport, exporting, onSaveRun }) {
  const cur = model.currency;
  const s = result.summary;
  const increases = s.netBudgetImpactTotal >= 0;
  const driver = s.biggestDriver;
  const offset = s.biggestOffset;

  const rec =
    `${model.newIntervention.treatmentName} ${increases ? "raises" : "lowers"} the ` +
    `${model.perspective.toLowerCase()} budget by ${moneyShort(Math.abs(s.netBudgetImpactTotal), cur)} ` +
    `over ${model.timeHorizonYears} years (${money(s.averagePMPM, cur)} PMPM). ` +
    `The largest driver is ${driver.label.toLowerCase()}` +
    `${offset && offset.diff < 0 ? `, partly offset by lower ${offset.label.toLowerCase()}` : ""}. ` +
    `The result is most sensitive to ${mostSensitive ? mostSensitive.label.toLowerCase() : "the price and uptake assumptions"} — ` +
    `validate that before reimbursement planning.`;

  const stats = [
    [`${model.timeHorizonYears}-year net budget impact`, moneyShort(s.netBudgetImpactTotal, cur), increases ? "neg" : "pos"],
    ["Average PMPM", money(s.averagePMPM, cur)],
    ["Patients on new therapy", count(s.peakTreatedPatients)],
    ["Largest cost driver", driver.label, null, `+${moneyShort(driver.diff, cur)}`],
    ["Largest offset", offset.label, null, moneyShort(offset.diff, cur)],
    ["Most sensitive assumption", mostSensitive ? mostSensitive.label : "—"],
  ];

  return (
    <div className="card decision">
      <div className="decision-head">
        <div>
          <span className="decision-eyebrow">Decision summary</span>
          <h2>
            {model.diseaseName.split(/[/(]/)[0].trim()} · {model.newIntervention.treatmentName}
          </h2>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            {model.countryName} · {model.perspective} · {model.timeHorizonYears}-year horizon
          </p>
        </div>
        <div className="decision-actions">
          <button className="btn sm" onClick={onExport} disabled={exporting} title="Download a formatted PDF report">
            <Icon name="pdf" size={14} /> {exporting ? "Preparing…" : "Save as PDF"}
          </button>
          <button className="btn primary sm" onClick={onSaveRun} title="Snapshot for comparison">
            + Save run
          </button>
        </div>
      </div>

      <div className="decision-grid">
        {stats.map(([label, value, tone, extra]) => (
          <div className="decision-stat" key={label}>
            <div className="ds-label">{label}</div>
            <div className={`ds-value${tone ? " " + tone : ""}`}>{value}</div>
            {extra && <div className="ds-extra">{extra}</div>}
          </div>
        ))}
      </div>

      <div className="recommendation">
        <span className="rec-badge">Recommendation</span>
        <p>{rec}</p>
      </div>
    </div>
  );
}

/* Current market vs new drug, by cost component — the core BIA comparison. */
function CompareTab({ model, result }) {
  const cur = model.currency;
  const cmp = result.comparison;
  const s = result.summary;
  const increases = cmp.difference >= 0;

  // Waterfall bridge: net impact built from each cost component's change.
  const steps = cmp.categories.map((c) => ({ label: c.label.replace(/ \(.*\)/, ""), diff: c.diff }));

  const chartData = cmp.categories.map((c) => ({
    name: c.label.replace(/ \(.*\)/, ""),
    Current: c.current,
    New: c.new,
  }));

  return (
    <>
      <div className="card">
        <div className="card-head">
          <h2>Why the budget changes — net impact bridge</h2>
          <p>Each cost component's change, building from zero to the net budget impact. Red adds cost, green is a saving (offset).</p>
        </div>
        <WaterfallBridge steps={steps} net={cmp.difference} cur={cur} />
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Current market vs new drug</h2>
          <p>Total spend over {model.timeHorizonYears} years, split by cost component. Category totals reconcile exactly to the scenario totals.</p>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Cost component</th><th>Without intervention</th><th>With intervention</th><th>Difference</th></tr>
            </thead>
            <tbody>
              <tr>
                <td>Patients treated (patient-years)</td>
                <td>{count(cmp.patientYears)}</td>
                <td>{count(cmp.patientYears)}</td>
                <td className="muted">—</td>
              </tr>
              {cmp.categories.map((c) => (
                <tr key={c.key}>
                  <td>{c.label}</td>
                  <td>{money(c.current, cur)}</td>
                  <td>{money(c.new, cur)}</td>
                  <td style={{ color: c.diff >= 0 ? "var(--negative)" : "var(--positive)", fontWeight: 600 }}>
                    {c.diff >= 0 ? "+" : ""}{money(c.diff, cur)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td>
                <td>{money(cmp.totalCurrent, cur)}</td>
                <td>{money(cmp.totalNew, cur)}</td>
                <td style={{ color: increases ? "var(--negative)" : "var(--positive)" }}>
                  {increases ? "+" : ""}{money(cmp.difference, cur)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className={`conclusion ${increases ? "neg" : "pos"}`}>
          <strong>Executive conclusion.</strong> Although the new intervention changes drug
          acquisition by {money(cmp.categories[0].diff, cur)}, changes in administration, monitoring
          and avoided medical events produce a net {increases ? "cost increase" : "saving"} of{" "}
          <strong>{money(Math.abs(cmp.difference), cur)}</strong> over {model.timeHorizonYears} years.
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h2>Spend by cost component</h2></div>
        <Legend2 items={[{ label: "Without intervention", color: SERIES[0] }, { label: "With intervention", color: SERIES[2] }]} />
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 4 }} barGap={4}>
            <CartesianGrid {...grid} />
            <XAxis dataKey="name" {...axis} axisLine={false} interval={0} tick={{ fontSize: 10 }} />
            <YAxis {...axis} axisLine={false} tickFormatter={(v) => moneyShort(v, cur)} width={72} />
            <Tooltip contentStyle={tooltipStyle()} cursor={{ fill: "var(--sunken)" }} formatter={(v, n) => [money(v, cur), n]} />
            <Bar dataKey="Current" name="Without intervention" fill={SERIES[0]} radius={[4, 4, 0, 0]} maxBarSize={40} isAnimationActive={false} />
            <Bar dataKey="New" name="With intervention" fill={SERIES[2]} radius={[4, 4, 0, 0]} maxBarSize={40} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}

/* One-way sensitivity tornado. Bars span each parameter's low/high net impact,
   split at the base case so the driving direction is visible. */
function SensitivityTab({ torn, cur }) {
  const all = torn.rows.flatMap((r) => [r.low, r.high, torn.base]);
  const min = Math.min(...all);
  const max = Math.max(...all);
  const span = max - min || 1;
  const pos = (v) => ((v - min) / span) * 100;
  const basePos = pos(torn.base);

  return (
    <div className="card">
      <div className="card-head">
        <h2>Sensitivity — tornado</h2>
        <p>Net budget impact when each assumption is moved ±{Math.round(torn.delta * 100)}%, most
        influential first. The dashed line is the base case ({moneyShort(torn.base, cur)}).</p>
      </div>

      <div className="tornado">
        {torn.rows.map((r) => {
          const lo = Math.min(r.low, r.high);
          const hi = Math.max(r.low, r.high);
          const left = pos(lo);
          const width = pos(hi) - left;
          return (
            <div className="tornado-row" key={r.key}>
              <div className="tornado-label">{r.label}</div>
              <div className="tornado-track">
                <div className="tornado-base" style={{ left: `${basePos}%` }} />
                <div
                  className="tornado-bar"
                  style={{ left: `${left}%`, width: `${Math.max(width, 0.5)}%` }}
                  title={`${moneyShort(r.low, cur)} … ${moneyShort(r.high, cur)}`}
                />
                {left >= 9 && <span className="tornado-lo" style={{ left: `${left}%` }}>{moneyShort(lo, cur)}</span>}
                <span className="tornado-hi" style={{ left: `${pos(hi)}%` }}>{moneyShort(hi, cur)}</span>
              </div>
            </div>
          );
        })}
      </div>
      <p className="muted" style={{ fontSize: 12.5, marginTop: 14, marginBottom: 0 }}>
        The result depends most on <strong style={{ color: "var(--ink)" }}>{torn.rows[0]?.label.toLowerCase()}</strong>.
        Early-stage price and uptake assumptions should be firmed up before decisions rely on the number.
      </p>
    </div>
  );
}

/* Transparent calculation trace: funnel + per-patient cost buildup + net. */
function MethodologyTab({ model, result }) {
  const cur = model.currency;
  const pp = result.perPatient;
  const s = result.summary;

  const rows = [
    ["Drug acquisition", pp.currentDrug, pp.newDrug],
    ["Administration", pp.currentAdmin, pp.newAdmin],
    ["Monitoring / labs", pp.currentMonitoring, pp.newMonitoring],
    ["Medical events (net of avoided)", pp.currentMedical, pp.newMedical],
  ];

  return (
    <>
      <div className="card">
        <div className="card-head">
          <h2>How the number is calculated</h2>
          <p>Every figure below comes from your inputs — no hidden steps.</p>
        </div>
        <div className="method-chain">
          <span>Covered population</span><i>× prevalence × diagnosed × clinical × payer × access × willingness</i>
          <span className="arrow">↓</span>
          <span><strong>Eligible patients</strong> = {count(s.year1EligiblePatients)} (year 1)</span>
          <span className="arrow">↓</span>
          <span>× current-care mix and new-drug uptake each year</span>
          <span className="arrow">↓</span>
          <span><strong>Patients treated</strong> = {count(s.peakTreatedPatients)} at peak</span>
          <span className="arrow">↓</span>
          <span>each patient costs: drug + administration + monitoring + medical events − avoided events</span>
          <span className="arrow">↓</span>
          <span><strong>Net budget impact</strong> = (with-intervention − without-intervention) spend = {money(s.netBudgetImpactTotal, cur)}</span>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Population funnel (year 1)</h2>
          <p>How covered lives narrow to the treatable pool.</p>
        </div>
        <Funnel model={model} />
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Annual cost per patient</h2>
          <p>Blended current care vs the new intervention, adjusted for adherence and persistence.</p>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Component</th><th>Without intervention</th><th>With intervention</th></tr>
            </thead>
            <tbody>
              {rows.map(([label, a, b]) => (
                <tr key={label}>
                  <td>{label}</td>
                  <td>{money(a, cur)}</td>
                  <td>{money(b, cur)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Total per patient / year</td>
                <td>{money(pp.currentTotal, cur)}</td>
                <td>{money(pp.newTotal, cur)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <ValidationCard result={result} cur={cur} />

      <div className="card">
        <div className="card-head"><h2>Scope and limitations</h2></div>
        <ul className="limits">
          <li>This is a <strong>budget impact analysis</strong>, not a cost-effectiveness analysis: it estimates affordability (spend over time), not value per QALY or clinical superiority.</li>
          <li>Every result depends on the assumptions entered. Defaults are illustrative starting points, not validated country estimates.</li>
          <li>The tool does not claim clinical effectiveness, cost-effectiveness, or a reimbursement recommendation.</li>
          <li>It supports early-stage decisions; it does not replace a formal HEOR model or HTA submission.</li>
        </ul>
      </div>
    </>
  );
}

/* Reference-case consistency check — compares the model's net impact against a
   number the user pastes from a published or independently built analysis. It
   checks reproducibility, NOT clinical validity, and says so. */
function ValidationCard({ result, cur }) {
  const [ref, setRef] = useState("");
  const model = result.summary.netBudgetImpactTotal;
  const refVal = Number(ref);
  const valid = ref !== "" && Number.isFinite(refVal) && refVal !== 0;
  const absDiff = valid ? model - refVal : 0;
  const pctDiff = valid ? (absDiff / Math.abs(refVal)) * 100 : 0;
  const within = Math.abs(pctDiff);

  return (
    <div className="card">
      <div className="card-head">
        <h2>Reference-case consistency check</h2>
        <p>Enter a budget-impact figure from a published or independent analysis to see how closely this model reproduces it. This checks reproducibility, not clinical validity.</p>
      </div>
      <div className="grid" style={{ maxWidth: 640 }}>
        <div className="field">
          <label>Reference net budget impact ({cur})</label>
          <input type="number" value={ref} placeholder="e.g. 52400000" onChange={(e) => setRef(e.target.value)} />
          <span className="hint">Total over the same horizon, same currency.</span>
        </div>
        <div className="field">
          <label>This model</label>
          <input type="text" value={money(model, cur)} readOnly />
        </div>
      </div>
      {valid && (
        <div className={`conclusion ${within <= 5 ? "pos" : ""}`} style={{ marginTop: 16 }}>
          <strong>Difference:</strong> {money(absDiff, cur)} ({pctDiff >= 0 ? "+" : ""}{pctDiff.toFixed(2)}%).{" "}
          {within <= 5
            ? `The model reproduces the reference result within ${within.toFixed(2)}%.`
            : `The model differs from the reference by ${within.toFixed(2)}% — check that the inputs match the reference case.`}
        </div>
      )}
    </div>
  );
}
