export default function UptakeTable({ rows, onChange, years }) {
  const normalized = Array.from({ length: years }, (_, i) => {
    const year = i + 1;
    return rows.find((x) => Number(x.year) === year) || {
      year,
      uptake: Math.min(0.05 * year, 0.3),
    };
  });

  function update(index, value) {
    const next = normalized.map((x) => ({ ...x }));
    next[index].uptake = Number(value);
    onChange(next);
  }

  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Year</th>
            <th>New intervention uptake</th>
          </tr>
        </thead>
        <tbody>
          {normalized.map((row, i) => (
            <tr key={row.year}>
              <td>{row.year}</td>
              <td>
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.01"
                  value={row.uptake}
                  onChange={(e) => update(i, e.target.value)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
