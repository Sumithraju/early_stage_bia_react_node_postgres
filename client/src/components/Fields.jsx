import { symbolFor } from "../lib/util.js";

/**
 * Inputs are kept as raw strings while focused so a half-typed "0." or an
 * emptied box does not get coerced to 0 mid-keystroke; the parsed number is
 * pushed up on every valid change.
 */
export function NumberField({ label, hint, value, onChange, step = 1, min, max, suffix }) {
  return (
    <div className="field">
      <label>{label}</label>
      <div className={`input-wrap${suffix ? "" : ""}`}>
        <input
          type="number"
          value={value ?? ""}
          step={step}
          min={min}
          max={max}
          onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
        />
        {suffix && <span className="affix">{suffix}</span>}
      </div>
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}

/** Stored 0-1, shown 0-100 so users type "25" for 25%. */
export function PercentField({ label, hint, value, onChange, max = 100 }) {
  return (
    <div className="field">
      <label>{label}</label>
      <div className="input-wrap">
        <input
          type="number"
          value={value === null || value === undefined ? "" : +(value * 100).toFixed(2)}
          step="0.1"
          min="0"
          max={max}
          onChange={(e) =>
            onChange(e.target.value === "" ? 0 : Number(e.target.value) / 100)
          }
        />
        <span className="affix">%</span>
      </div>
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}

export function MoneyField({ label, hint, value, onChange, currency = "INR" }) {
  return (
    <div className="field">
      <label>{label}</label>
      <div className="input-wrap prefixed">
        <span className="affix">{symbolFor(currency)}</span>
        <input
          type="number"
          value={value ?? ""}
          step="100"
          min="0"
          onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
        />
      </div>
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}

export function TextField({ label, hint, value, onChange, placeholder }) {
  return (
    <div className="field">
      <label>{label}</label>
      <input
        type="text"
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}

export function SelectField({ label, hint, value, onChange, options }) {
  return (
    <div className="field">
      <label>{label}</label>
      <select value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
        {options.map((opt) => {
          const val = typeof opt === "string" ? opt : opt.value;
          const text = typeof opt === "string" ? opt : opt.label;
          return (
            <option key={val} value={val}>
              {text}
            </option>
          );
        })}
      </select>
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}
