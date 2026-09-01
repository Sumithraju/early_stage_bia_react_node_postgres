import { count, pct } from "../lib/util.js";

/**
 * Population funnel. Riya's review asked for this to sit inside the Population
 * tab rather than in the results, so the user watches the eligible number move
 * as they type the rates that produce it.
 */
export function buildFunnel(model) {
  const pop = Number(model.coveredPopulation) || 0;
  const steps = [
    { label: "Covered population", rate: null },
    { label: "Living with obesity", rate: model.prevalence },
    { label: "Diagnosed", rate: model.diagnosisRate },
    { label: "Clinically eligible", rate: model.clinicalEligibility },
    { label: "Payer eligible", rate: model.payerEligibility },
    { label: "Able to access", rate: model.accessRate },
    { label: "Willing to treat", rate: model.willingnessRate },
  ];

  let running = pop;
  return steps.map((step, i) => {
    if (i > 0) running *= Math.min(1, Math.max(0, Number(step.rate) || 0));
    return {
      ...step,
      value: running,
      share: pop > 0 ? running / pop : 0,
      terminal: i === steps.length - 1,
    };
  });
}

export default function Funnel({ model }) {
  const rows = buildFunnel(model);

  return (
    <div className="funnel">
      {rows.map((row) => (
        <div className="funnel-row" key={row.label}>
          <div>
            <div className="funnel-label">
              {row.label}
              {row.rate !== null && (
                <span className="muted"> · {pct(row.rate, 0)}</span>
              )}
            </div>
            <div className="funnel-bar-wrap">
              <div
                className={`funnel-bar${row.terminal ? " terminal" : ""}`}
                style={{ width: `${Math.max(row.share * 100, 0.4)}%` }}
              />
            </div>
          </div>
          <div className="funnel-value">{count(row.value)}</div>
        </div>
      ))}
    </div>
  );
}
