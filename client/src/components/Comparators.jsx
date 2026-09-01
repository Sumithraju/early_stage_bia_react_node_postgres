import { newId, pct } from "../lib/util.js";
import { MoneyField, PercentField, TextField } from "./Fields.jsx";

function blankComparator() {
  return {
    treatmentCode: newId(),
    treatmentName: "",
    marketShare: 0,
    annualDrugCost: 0,
    annualAdminCost: 0,
    annualMonitoringCost: 0,
    annualDeviceCost: 0,
    adherence: 0.8,
    persistence: 0.75,
    discontinuation: 0.2,
  };
}

/**
 * Current-care comparators, one card per column. The review asked for
 * comparators to be freely addable and removable, so "+ Add comparator" appends
 * a whole blank column and every column past the first can be deleted.
 *
 * Shares must total 100% for the mix to mean anything, so the running total is
 * always visible and one click rescales the existing columns to fit.
 */
export default function Comparators({ list, currency, onChange }) {
  const total = list.reduce((sum, row) => sum + (Number(row.marketShare) || 0), 0);
  const balanced = Math.abs(total - 1) < 0.001;

  const update = (index, patch) =>
    onChange(list.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  const add = () => onChange([...list, blankComparator()]);

  const remove = (index) => onChange(list.filter((_, i) => i !== index));

  const normalise = () => {
    if (total <= 0) {
      const even = 1 / list.length;
      return onChange(list.map((row) => ({ ...row, marketShare: even })));
    }
    onChange(
      list.map((row) => ({
        ...row,
        marketShare: (Number(row.marketShare) || 0) / total,
      }))
    );
  };

  return (
    <>
      <div className="comparators">
        {list.map((row, i) => (
          <div className="comparator-col" key={row.treatmentCode}>
            <header>
              <span className="tag">Comparator {i + 1}</span>
              {list.length > 1 && (
                <button
                  type="button"
                  className="btn danger sm"
                  onClick={() => remove(i)}
                  title="Remove this comparator"
                >
                  Remove
                </button>
              )}
            </header>

            <TextField
              label="Name"
              placeholder="e.g. Lifestyle programme"
              value={row.treatmentName}
              onChange={(v) => update(i, { treatmentName: v })}
            />
            <PercentField
              label="Share of current care"
              value={row.marketShare}
              onChange={(v) => update(i, { marketShare: v })}
            />
            <MoneyField
              label="Annual drug cost"
              currency={currency}
              value={row.annualDrugCost}
              onChange={(v) => update(i, { annualDrugCost: v })}
            />
            <MoneyField
              label="Admin / procedure cost"
              currency={currency}
              value={row.annualAdminCost}
              onChange={(v) => update(i, { annualAdminCost: v })}
            />
            <MoneyField
              label="Monitoring cost"
              currency={currency}
              value={row.annualMonitoringCost}
              onChange={(v) => update(i, { annualMonitoringCost: v })}
            />
            <PercentField
              label="Adherence"
              value={row.adherence}
              onChange={(v) => update(i, { adherence: v })}
            />
            <PercentField
              label="Persistence"
              value={row.persistence}
              onChange={(v) => update(i, { persistence: v })}
            />
          </div>
        ))}

        <button type="button" className="add-comparator" onClick={add}>
          <span className="plus">+</span>
          Add comparator
        </button>
      </div>

      <div className="nav-row" style={{ marginTop: 4, paddingTop: 14 }}>
        <span className={balanced ? "muted" : ""} style={{ fontSize: 13 }}>
          Total share:{" "}
          <strong style={{ color: balanced ? "var(--positive)" : "var(--negative)" }}>
            {pct(total, 1)}
          </strong>
          {!balanced && <span className="muted"> · must equal 100%</span>}
        </span>
        <span className="spacer" />
        {!balanced && (
          <button type="button" className="btn sm" onClick={normalise}>
            Rescale to 100%
          </button>
        )}
      </div>
    </>
  );
}
