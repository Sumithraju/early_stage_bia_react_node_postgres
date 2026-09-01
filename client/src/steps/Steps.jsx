import { DISEASE_LIST, DISEASES, subgroupsFor } from "../lib/diseases.js";
import { newId, count, money } from "../lib/util.js";
import Funnel, { buildFunnel } from "../components/Funnel.jsx";
import Comparators from "../components/Comparators.jsx";
import {
  MoneyField,
  NumberField,
  PercentField,
  SelectField,
  TextField,
} from "../components/Fields.jsx";

/* 1 ----------------------------------------------------------------- */
/* Therapy area comes first: the review noted the disease was buried at
   step 5, after the user had already entered numbers for it. Time horizon
   and perspective sit here too, above anything cost-related.            */
export function StepTherapy({ model, set, onDisease }) {
  return (
    <>
      <div className="section-label">Therapy area</div>
      <div className="grid">
        <SelectField
          label="Therapy area"
          value={model.therapyArea}
          onChange={(v) => set({ therapyArea: v })}
          options={[...new Set(DISEASE_LIST.map(() => "Cardiometabolic"))]}
          hint="This build is scoped to one area"
        />
        <SelectField
          label="Disease"
          value={model.diseaseCode}
          onChange={(v) => onDisease && onDisease(v)}
          options={DISEASE_LIST.map((d) => ({ value: d.code, label: d.label }))}
          hint="Switching reloads that disease's defaults"
        />
        <SelectField
          label="Subgroup"
          value={model.subgroup}
          onChange={(v) => set({ subgroup: v })}
          options={[
            { value: "ALL", label: "All eligible patients" },
            ...subgroupsFor(model.diseaseCode).map((sg) => ({ value: sg.code, label: sg.label })),
          ]}
        />
      </div>

      <div className="section-label">Perspective and horizon</div>
      <div className="grid">
        <SelectField
          label="Payer perspective"
          value={model.perspective}
          onChange={(v) => set({ perspective: v })}
          options={[
            "Government payer",
            "Private insurer",
            "Employer",
            "Health system",
          ]}
        />
        <NumberField
          label="Time horizon"
          value={model.timeHorizonYears}
          min={1}
          max={10}
          onChange={(v) => set({ timeHorizonYears: Math.min(10, Math.max(1, v)) })}
          suffix="years"
          hint="Typically 3-5"
        />
        <NumberField
          label="Base year"
          value={model.baseYear}
          min={2000}
          max={2100}
          onChange={(v) => set({ baseYear: v })}
        />
        <SelectField
          label="Currency"
          value={model.currency}
          onChange={(v) => set({ currency: v })}
          options={["INR", "USD", "EUR", "GBP"]}
        />
      </div>
    </>
  );
}

/* 2 ----------------------------------------------------------------- */
/* Population, epidemiology, eligibility and the funnel in one tab, so the
   eligible-patient number moves as the rates that produce it are edited. */
export function StepPopulation({ model, set }) {
  const funnel = buildFunnel(model);
  const eligible = funnel.at(-1).value;

  return (
    <>
      <div className="section-label">Covered population</div>
      <div className="grid">
        <NumberField
          label="Covered lives"
          value={model.coveredPopulation}
          step={10000}
          min={0}
          onChange={(v) => set({ coveredPopulation: v })}
        />
        <NumberField
          label="Age from"
          value={model.ageMin}
          min={0}
          max={120}
          onChange={(v) => set({ ageMin: v })}
          suffix="yrs"
        />
        <NumberField
          label="Age to"
          value={model.ageMax}
          min={0}
          max={120}
          onChange={(v) => set({ ageMax: v })}
          suffix="yrs"
        />
        <PercentField
          label="Annual population growth"
          value={model.annualPopulationGrowth}
          onChange={(v) => set({ annualPopulationGrowth: v })}
        />
      </div>

      <div className="section-label">Epidemiology</div>
      <div className="grid">
        <PercentField
          label={`${model.diseaseName} prevalence`}
          value={model.prevalence}
          onChange={(v) => set({ prevalence: v })}
        />
        <PercentField
          label="Annual prevalence growth"
          value={model.annualPrevalenceGrowth}
          onChange={(v) => set({ annualPrevalenceGrowth: v })}
        />
        <PercentField
          label="Diagnosed share"
          value={model.diagnosisRate}
          onChange={(v) => set({ diagnosisRate: v })}
        />
      </div>

      <div className="section-label">Eligibility</div>
      <div className="grid">
        <NumberField
          label={
            (DISEASES[model.diseaseCode]?.eligibilityUnit || "BMI") === "HbA1c"
              ? "HbA1c threshold"
              : "BMI threshold"
          }
          value={model.bmiThreshold}
          step={0.5}
          min={0}
          max={60}
          onChange={(v) => set({ bmiThreshold: v })}
          suffix={
            (DISEASES[model.diseaseCode]?.eligibilityUnit || "BMI") === "HbA1c"
              ? "%"
              : "kg/m²"
          }
        />
        <TextField
          label="Comorbidity requirement"
          value={model.comorbidityRequirement}
          onChange={(v) => set({ comorbidityRequirement: v })}
        />
        <PercentField
          label="Meets clinical criteria"
          value={model.clinicalEligibility}
          onChange={(v) => set({ clinicalEligibility: v })}
        />
        <PercentField
          label="Payer eligible"
          value={model.payerEligibility}
          onChange={(v) => set({ payerEligibility: v })}
        />
        <PercentField
          label="Able to access"
          value={model.accessRate}
          onChange={(v) => set({ accessRate: v })}
        />
        <PercentField
          label="Willing to treat"
          value={model.willingnessRate}
          onChange={(v) => set({ willingnessRate: v })}
        />
      </div>

      <div className="section-label">Eligible population funnel</div>
      <Funnel model={model} />
      <p className="muted" style={{ fontSize: 13, marginTop: 14, marginBottom: 0 }}>
        <strong style={{ color: "var(--ink)" }}>{count(eligible)}</strong> patients
        reach the treatable pool in year 1.
      </p>
    </>
  );
}

/* 3 ----------------------------------------------------------------- */
export function StepComparators({ model, set }) {
  return (
    <>
      <p className="muted" style={{ marginTop: 0 }}>
        The mix of care these patients receive today. Add or remove comparators
        freely — shares must total 100%.
      </p>
      <Comparators
        list={model.currentTreatments}
        currency={model.currency}
        onChange={(currentTreatments) => set({ currentTreatments })}
      />
    </>
  );
}

/* 4 ----------------------------------------------------------------- */
export function StepIntervention({ model, set }) {
  const n = model.newIntervention;
  const setNew = (patch) => set({ newIntervention: { ...n, ...patch } });

  return (
    <>
      <div className="section-label">The new intervention</div>
      <div className="grid">
        <TextField
          label="Name"
          value={n.treatmentName}
          onChange={(v) => setNew({ treatmentName: v })}
          placeholder="e.g. GLP-1 receptor agonist"
        />
        <MoneyField
          label="Annual treatment price"
          currency={model.currency}
          value={n.annualDrugCost}
          onChange={(v) => setNew({ annualDrugCost: v })}
          hint="Price per patient per year"
        />
        <MoneyField
          label="Administration cost"
          currency={model.currency}
          value={n.annualAdminCost}
          onChange={(v) => setNew({ annualAdminCost: v })}
        />
        <MoneyField
          label="Monitoring / lab cost"
          currency={model.currency}
          value={n.annualMonitoringCost}
          onChange={(v) => setNew({ annualMonitoringCost: v })}
        />
        <MoneyField
          label="Device cost"
          currency={model.currency}
          value={n.annualDeviceCost}
          onChange={(v) => setNew({ annualDeviceCost: v })}
        />
      </div>
      <p className="muted" style={{ fontSize: 13, marginTop: 16, marginBottom: 0 }}>
        Full annual cost per treated patient before adherence:{" "}
        <strong style={{ color: "var(--ink)" }}>
          {money(
            (n.annualDrugCost || 0) +
              (n.annualAdminCost || 0) +
              (n.annualMonitoringCost || 0) +
              (n.annualDeviceCost || 0),
            model.currency
          )}
        </strong>
      </p>
    </>
  );
}

/* 5 ----------------------------------------------------------------- */
export function StepUptake({ model, set }) {
  const years = model.timeHorizonYears;
  const rows = Array.from({ length: years }, (_, i) => {
    const year = i + 1;
    return model.uptake.find((u) => Number(u.year) === year) || { year, uptake: 0 };
  });

  const setYear = (year, uptake) => {
    const next = rows.map((r) => (r.year === year ? { ...r, uptake } : r));
    set({ uptake: next });
  };

  const n = model.newIntervention;
  const setNew = (patch) => set({ newIntervention: { ...n, ...patch } });

  return (
    <>
      <div className="section-label">Adoption by year</div>
      <div className="grid">
        {rows.map((row) => (
          <PercentField
            key={row.year}
            label={`Year ${row.year} (${model.baseYear + row.year - 1})`}
            value={row.uptake}
            onChange={(v) => setYear(row.year, v)}
          />
        ))}
      </div>

      <div className="section-label">Treatment behaviour</div>
      <div className="grid">
        <PercentField
          label="Adherence"
          value={n.adherence}
          onChange={(v) => setNew({ adherence: v })}
          hint="Doses actually taken"
        />
        <PercentField
          label="Persistence"
          value={n.persistence}
          onChange={(v) => setNew({ persistence: v })}
          hint="Still on treatment at year end"
        />
        <PercentField
          label="Discontinuation"
          value={n.discontinuation}
          onChange={(v) => setNew({ discontinuation: v })}
        />
        <PercentField
          label="Expected weight loss"
          value={model.expectedWeightLossPct}
          onChange={(v) => set({ expectedWeightLossPct: v })}
          hint="Mean reduction in body weight"
        />
        <PercentField
          label="Responder rate"
          value={model.responderRate}
          onChange={(v) => set({ responderRate: v })}
          hint="Share reaching target weight loss"
        />
        <PercentField
          label="Annual weight regain"
          value={model.weightRegainRate}
          onChange={(v) => set({ weightRegainRate: v })}
          hint="Erodes the outcome benefit each year"
        />
      </div>
    </>
  );
}

/* 6 ----------------------------------------------------------------- */
export function StepOutcomes({ model, set }) {
  const update = (i, patch) =>
    set({
      outcomes: model.outcomes.map((row, j) => (j === i ? { ...row, ...patch } : row)),
    });

  const add = () =>
    set({
      outcomes: [
        ...model.outcomes,
        {
          outcomeCode: newId("OUT"),
          outcomeName: "",
          currentAnnualRate: 0,
          newRelativeRisk: 1,
          costPerEvent: 0,
        },
      ],
    });

  const remove = (i) => set({ outcomes: model.outcomes.filter((_, j) => j !== i) });

  return (
    <>
      <p className="muted" style={{ marginTop: 0 }}>
        Events the intervention is expected to prevent. Relative risk below 100%
        means fewer events; the annual cost of each event drives the offset.
      </p>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Outcome</th>
              <th>Annual rate</th>
              <th>Relative risk</th>
              <th>Cost per event</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {model.outcomes.map((row, i) => (
              <tr key={row.outcomeCode}>
                <td>
                  <input
                    type="text"
                    value={row.outcomeName}
                    placeholder="Outcome name"
                    onChange={(e) => update(i, { outcomeName: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    step="0.1"
                    value={+(row.currentAnnualRate * 100).toFixed(2)}
                    onChange={(e) =>
                      update(i, { currentAnnualRate: Number(e.target.value) / 100 })
                    }
                  />
                </td>
                <td>
                  <input
                    type="number"
                    step="1"
                    value={+(row.newRelativeRisk * 100).toFixed(1)}
                    onChange={(e) =>
                      update(i, { newRelativeRisk: Number(e.target.value) / 100 })
                    }
                  />
                </td>
                <td>
                  <input
                    type="number"
                    step="1000"
                    value={row.costPerEvent}
                    onChange={(e) => update(i, { costPerEvent: Number(e.target.value) })}
                  />
                </td>
                <td>
                  {model.outcomes.length > 1 && (
                    <button
                      type="button"
                      className="btn danger sm"
                      onClick={() => remove(i)}
                    >
                      Remove
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button type="button" className="btn sm" style={{ marginTop: 12 }} onClick={add}>
        + Add outcome
      </button>
    </>
  );
}
