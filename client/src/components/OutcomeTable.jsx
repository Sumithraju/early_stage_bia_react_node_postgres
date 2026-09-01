export default function OutcomeTable({ rows, onChange }) {
  function update(index, key, value) {
    const next = [...rows];
    next[index] = { ...next[index], [key]: value };
    onChange(next);
  }

  function add() {
    onChange([
      ...rows,
      {
        outcomeCode: `OUTCOME_${rows.length + 1}`,
        outcomeName: "New outcome",
        currentAnnualRate: 0,
        newRelativeRisk: 1,
        costPerEvent: 0,
      },
    ]);
  }

  function remove(index) {
    onChange(rows.filter((_, i) => i !== index));
  }

  return (
    <div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Outcome</th>
              <th>Current annual rate</th>
              <th>RR on new intervention</th>
              <th>Cost/event</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`${r.outcomeCode}-${i}`}>
                <td>
                  <input
                    value={r.outcomeName}
                    onChange={(e) =>
                      update(i, "outcomeName", e.target.value)
                    }
                  />
                </td>
                <td>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={r.currentAnnualRate}
                    onChange={(e) =>
                      update(i, "currentAnnualRate", Number(e.target.value))
                    }
                  />
                </td>
                <td>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={r.newRelativeRisk}
                    onChange={(e) =>
                      update(i, "newRelativeRisk", Number(e.target.value))
                    }
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min="0"
                    value={r.costPerEvent}
                    onChange={(e) =>
                      update(i, "costPerEvent", Number(e.target.value))
                    }
                  />
                </td>
                <td>
                  <button className="danger-link" onClick={() => remove(i)}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button className="secondary" onClick={add}>
        + Add outcome
      </button>
    </div>
  );
}
