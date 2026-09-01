export default function TreatmentTable({ rows, onChange }) {
  function update(index, key, value) {
    const next = [...rows];
    next[index] = { ...next[index], [key]: value };
    onChange(next);
  }

  function add() {
    onChange([
      ...rows,
      {
        treatmentCode: `CURRENT_${rows.length + 1}`,
        treatmentName: "New comparator",
        marketShare: 0,
        annualDrugCost: 0,
        annualAdminCost: 0,
        annualMonitoringCost: 0,
        annualDeviceCost: 0,
        adherence: 1,
        persistence: 1,
        discontinuation: 0,
      },
    ]);
  }

  function remove(index) {
    onChange(rows.filter((_, i) => i !== index));
  }

  const sum = rows.reduce((s, r) => s + Number(r.marketShare || 0), 0);

  return (
    <div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Treatment</th>
              <th>Share</th>
              <th>Drug cost</th>
              <th>Admin</th>
              <th>Monitoring</th>
              <th>Adherence</th>
              <th>Persistence</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`${r.treatmentCode}-${i}`}>
                <td>
                  <input
                    value={r.treatmentName}
                    onChange={(e) =>
                      update(i, "treatmentName", e.target.value)
                    }
                  />
                </td>
                <td>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={r.marketShare}
                    onChange={(e) =>
                      update(i, "marketShare", Number(e.target.value))
                    }
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={r.annualDrugCost}
                    onChange={(e) =>
                      update(i, "annualDrugCost", Number(e.target.value))
                    }
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={r.annualAdminCost}
                    onChange={(e) =>
                      update(i, "annualAdminCost", Number(e.target.value))
                    }
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={r.annualMonitoringCost}
                    onChange={(e) =>
                      update(i, "annualMonitoringCost", Number(e.target.value))
                    }
                  />
                </td>
                <td>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={r.adherence}
                    onChange={(e) =>
                      update(i, "adherence", Number(e.target.value))
                    }
                  />
                </td>
                <td>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={r.persistence}
                    onChange={(e) =>
                      update(i, "persistence", Number(e.target.value))
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

      <div className={Math.abs(sum - 1) <= 0.001 ? "share-ok" : "share-bad"}>
        Market-share total: {(sum * 100).toFixed(1)}%
      </div>

      <button className="secondary" onClick={add}>
        + Add comparator
      </button>
    </div>
  );
}
