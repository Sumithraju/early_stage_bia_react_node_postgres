import { useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { count, money, moneyShort, pct } from "../lib/util.js";

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

export default function Results({ model, result }) {
  const [tab, setTab] = useState("impact");
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

      <div className="tabs">
        <button className={`tab${tab === "impact" ? " active" : ""}`} onClick={() => setTab("impact")}>
          Budget impact
        </button>
        <button className={`tab${tab === "scenarios" ? " active" : ""}`} onClick={() => setTab("scenarios")}>
          Scenarios
        </button>
        <button className={`tab${tab === "clinical" ? " active" : ""}`} onClick={() => setTab("clinical")}>
          Clinical outcomes
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
    </>
  );
}
