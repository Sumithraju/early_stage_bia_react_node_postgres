import { Children, useEffect, useRef } from "react";
import Icon from "./Icons.jsx";

/**
 * The demo runbook, in a dialog over the app.
 *
 * The walkthrough used to live only in docs/, which is the wrong place when the
 * point of it is to be read while driving the tool. Screenshots are left out on
 * purpose: in-app they would be pictures of the screen you are already looking
 * at, and they would add ~3 MB to the bundle.
 *
 * `onLoadDemo` fills the tabs with the scenario described here. It sits inside
 * the runbook rather than in the top bar so the button is next to the
 * explanation of what it does.
 */
export default function Runbook({ open, onClose, onLoadDemo }) {
  const ref = useRef(null);

  // <dialog> gives Esc-to-close and an inert backdrop for free, but only when
  // it is opened as a modal rather than with an `open` attribute.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog className="runbook" ref={ref} onClose={onClose} aria-label="Demo runbook">
      <header className="runbook-head">
        <div>
          <h2>Demo runbook</h2>
          <p>Drug X, an early-stage GLP-1, in Germany · statutory health insurer · 5 years</p>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close runbook" title="Close (Esc)">
          <Icon name="close" size={17} />
        </button>
      </header>

      <div className="runbook-body">
        <div className="runbook-cta">
          <div>
            <strong>Load this scenario</strong>
            <span>Fills every tab and leaves you on Therapy area, ready to walk through.</span>
          </div>
          <button
            className="btn primary"
            onClick={() => { onLoadDemo(); onClose(); }}
          >
            ▶ Load demo
          </button>
        </div>

        <p className="runbook-warn">
          All values are illustrative. They are plausible for a demonstration but are not
          drawn from a validated published source, and any PDF exported from this scenario
          says so in its footer.
        </p>

        <Step n="1" title="Therapy area" why="Fixes what is modelled, for whom, and over how long. Everything downstream inherits it.">
          <Row k="Disease" v="Type 2 diabetes" />
          <Row k="Country · currency" v="Germany · EUR" />
          <Row k="Perspective" v="Statutory health insurer" />
          <Row k="Base year · horizon" v="2026 · 5 years" />
          <Say>A BIA answers “what does saying yes to this drug do to my budget?” — not “is it good value?” That second question is cost-effectiveness, a different model.</Say>
        </Step>

        <Step n="2" title="Population" why="Narrows a covered population down to the patients actually treated. This funnel drives every currency figure.">
          <Row k="Covered population" v="8,000,000" />
          <Row k="Prevalence · annual incidence" v="9% · 0.6%" />
          <Row k="Diagnosed" v="75%" />
          <Row k="Clinically eligible" v="55%" />
          <Row k="Payer eligible" v="85%" />
          <Row k="Able to access · willing" v="90% · 80%" />
          <Expect>The funnel ends at <b>181,764</b> eligible patients in year 1.</Expect>
          <Say>Prevalence and incidence are separate on purpose: prevalence is the standing pool, incidence adds new cases each year. A prevalence-only model understates a growing disease.</Say>
        </Step>

        <Step n="3" title="Current care" why="What the payer funds today — the comparison the new drug is measured against. The + button adds a comparator as a whole column.">
          <Row k="Metformin ± SU · 60%" v="€250 drug · €300 monitoring" />
          <Row k="Basal insulin · 25%" v="€1,400 · €120 · €600 · €250" />
          <Row k="DPP-4 inhibitor · 15%" v="€900 drug · €300 monitoring" />
          <Expect>Current care totals <b>€1.73 billion</b> over five years.</Expect>
          <Say>Adherence and persistence matter: a patient who stops in month three does not consume a full year of drug.</Say>
        </Step>

        <Step n="4" title="Intervention" why="The new drug, on the same cost structure as the comparators so the comparison is like-for-like.">
          <Row k="Annual drug cost" v="€3,200" />
          <Row k="Administration · monitoring" v="€120 · €400" />
          <Row k="Adherence · persistence" v="85% · 78%" />
          <Say>The headline price is not the cost. €3,200 list becomes €2,527 per treated patient per year once adherence and persistence apply — and that gap is what a payer argues about.</Say>
        </Step>

        <Step n="5" title="Uptake" why="Share of eligible patients on the new drug each year. Budget impact is dominated by this curve.">
          <Row k="Years 1 – 5" v="4% · 9% · 15% · 22% · 28%" />
          <Expect><b>67,083</b> patients treated at peak, in year 5.</Expect>
        </Step>

        <Step n="6" title="Outcomes" why="Events the drug is expected to prevent, and what each costs. Without this a BIA only ever shows a drug bill.">
          <Row k="MACE" v="2.2% · RR 0.80 · €12,000" />
          <Row k="CKD progression" v="3.0% · RR 0.76 · €9,000" />
          <Row k="Severe hypoglycaemia" v="4.0% · RR 0.68 · €3,500" />
          <Row k="Retinopathy" v="2.5% · RR 0.85 · €4,000" />
          <Row k="Foot ulcer / amputation" v="0.8% · RR 0.74 · €20,000" />
          <Expect><b>2,480</b> events avoided, worth <b>€17.96M</b> in medical cost.</Expect>
        </Step>

        <h3 className="runbook-h3">Results — what each tab tells you</h3>
        <div className="runbook-rows">
          <Row k="Budget impact" v="The headline answer" />
          <Row k="Current vs new" v="Where the money moves" />
          <Row k="Scenarios" v="How wrong could uptake be" />
          <Row k="Sensitivity" v="What would change the answer" />
          <Row k="Clinical outcomes" v="What the spend buys" />
          <Row k="Methodology" v="How the number was reached" />
          <Row k="Runs" v="This model versus the last one" />
        </div>
        <dl className="runbook-defs">
          <dt>Budget impact</dt>
          <dd>Net impact over the horizon, the affordability metrics (PMPM, PPPM),
            patients treated, cost per patient and break-even price, plus the
            year-by-year table. Start and finish here.</dd>
          <dt>Current vs new</dt>
          <dd>Both scenarios split into cost components — drug, administration,
            monitoring, device, medical events — so you can see which component
            drives the difference rather than only that a difference exists.
            Component totals reconcile exactly to the scenario totals.</dd>
          <dt>Scenarios</dt>
          <dd>The whole model re-run at half and one-and-a-half times the base
            uptake curve. Uptake is usually the least certain input, so this is
            the range a payer should plan against, not a single number.</dd>
          <dt>Sensitivity</dt>
          <dd>A one-way tornado: each of ten parameters moved ±20% on its own,
            sorted by how far the answer swings. The top bar is where more
            evidence would be worth buying.</dd>
          <dt>Clinical outcomes</dt>
          <dd>Events avoided per outcome and the medical cost that removes — the
            offset against the drug bill. Benefit applies only to responders and
            decays with the regain rate, so it is never assumed permanent.</dd>
          <dt>Methodology</dt>
          <dd>The full calculation chain, per-patient costs and every assumption
            in force. This is the audit tab: a reviewer can trace a number from
            input to headline without reading the code.</dd>
          <dt>Runs</dt>
          <dd>Save a run, change one input, save again. Runs line up side by side
            so you can show the effect of a single change. They live in the
            session and clear when the tab closes.</dd>
        </dl>

        <h3 className="runbook-h3">Results — what you should see</h3>
        <div className="runbook-table">
          <table>
            <tbody>
              <tr><td>Net impact, 5 years</td><td>€296,601,076</td></tr>
              <tr><td>Without intervention</td><td>€1,727,701,189</td></tr>
              <tr><td>With intervention</td><td>€2,024,302,265</td></tr>
              <tr><td>Affordability — PMPM (Y1)</td><td>€0.13</td></tr>
              <tr><td>Affordability — PPPM (Y1)</td><td>€141</td></tr>
              <tr><td>Patients treated at peak</td><td>67,083</td></tr>
              <tr><td>Cost per treated patient</td><td>€2,527</td></tr>
              <tr><td>Break-even annual price</td><td>€613</td></tr>
              <tr><td>Events avoided</td><td>2,480</td></tr>
            </tbody>
          </table>
        </div>
        <p className="runbook-note">
          If any of these differ, an input has been edited. Press <b>Reset</b>, then load the
          demo again.
        </p>

        <h3 className="runbook-h3">The 90-second version</h3>
        <ol className="runbook-script">
          <li><b>Load demo.</b> “Drug X, a GLP-1, in Germany. Five years, the insurer's view.”</li>
          <li><b>Population.</b> “Eight million lives down to 181,764 eligible. Prevalence and incidence, because the pool grows.”</li>
          <li><b>Uptake.</b> “Four per cent to twenty-eight. This curve drives the answer more than price does.”</li>
          <li><b>Results.</b> “€296.6 million over five years — which is thirteen cents per member per month, the number you actually negotiate on.”</li>
          <li><b>Sensitivity.</b> “And here is what would change that answer.”</li>
        </ol>

        <h3 className="runbook-h3">EviTrack — the evidence module</h3>
        <p className="runbook-why">
          Reached from <b>EviTrack</b> in the top bar. A budget impact model is only as
          defensible as its inputs, and the usual challenge is “where did that number come
          from?” EviTrack is the answer to that question: it searches published evidence
          and keeps what you select alongside the model.
        </p>
        <div className="runbook-rows">
          <Row k="PubMed" v="Published literature" />
          <Row k="ClinicalTrials.gov" v="Trial registrations and results" />
          <Row k="openFDA" v="Label and adverse-event data" />
          <Row k="WHO GHO" v="Country epidemiology indicators" />
          <Row k="World Bank" v="Population and health expenditure" />
        </div>
        <div className="runbook-say">
          <span>Say</span>
          <p>
            Search a term, read the results, and add the relevant ones to the evidence
            workspace. Where an AI key is configured it also summarises each result — but
            only from the retrieved text, and it is explicitly barred from changing any BIA
            input or calculation. Search works with no database configured; records simply
            are not kept between sessions.
          </p>
        </div>

        <h3 className="runbook-h3">The assistant</h3>
        <p className="runbook-why">
          The robot button, bottom right. It answers questions about the model currently on
          screen — what PMPM means, why the break-even price is what it is, how uptake feeds
          the result — using your actual numbers rather than generic definitions.
        </p>
        <div className="runbook-say">
          <span>Say</span>
          <p>
            With no AI key configured it still answers from a built-in set covering the
            common budget-impact concepts, so the demo never depends on a network call. With
            a key it answers freely, and the badge in its header shows which mode it is in.
            It explains the model; it does not change it.
          </p>
        </div>
      </div>
    </dialog>
  );
}

function Step({ n, title, why, children }) {
  // Key-value rows belong inside the bordered box; the Expect/Say callouts sit
  // below it, or they read as another table row.
  const kids = Children.toArray(children);
  const rows = kids.filter((c) => c.type === Row);
  const notes = kids.filter((c) => c.type !== Row);
  return (
    <section className="runbook-step">
      <h3><span className="runbook-n">{n}</span>{title}</h3>
      <p className="runbook-why">{why}</p>
      {rows.length > 0 && <div className="runbook-rows">{rows}</div>}
      {notes}
    </section>
  );
}
const Row = ({ k, v }) => (
  <div className="runbook-row"><span>{k}</span><span>{v}</span></div>
);
const Expect = ({ children }) => (
  <div className="runbook-expect"><span>Expect</span><p>{children}</p></div>
);
const Say = ({ children }) => (
  <div className="runbook-say"><span>Say</span><p>{children}</p></div>
);
