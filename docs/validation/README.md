# Literature validation set

Four published budget impact analyses reproduced in BIET, used as regression tests
against `client/src/lib/literatureValidation.test.js`. The tests import these
workbooks through the real `importWorkbook()` rather than building a model
object, because the failure they guard was an import failure: the engine
produced the right numbers all along while the application fed it the wrong
inputs.

Every figure a workbook claims is checked against a benchmark the paper — or
the workbook's own Evidence sheet — actually reports. Nothing is written into
the engine, and no expected output is hard-coded anywhere in `client/src/lib`.

---

## Current cases

### 1. GLP-1 receptor agonists for type 2 diabetes, India

`BIET_T2D_India_GLP1_ISPOR_2025.xlsx`

Thakur L, Bisen R, Puthran D. *Budget Impact Analysis of GLP-1 Receptor
Agonists for Type 2 Diabetes Management in India.* Value in Health / ISPOR
Europe 2025. doi:10.1016/j.jval.2025.09.469

100,000-patient T2D cohort, payer perspective, 2025–2029, INR. Reproduces the
per-drug five-year spend recorded on the workbook's Evidence sheet to the
rupee:

| | Benchmark | BIET |
| --- | --- | --- |
| Semaglutide, 5 yr | ₹3,447,884,379 | ₹3,447,884,379 |
| Dulaglutide, 5 yr | ₹1,563,575,474 | ₹1,563,575,474 |
| Tirzepatide, 5 yr | ₹15,936,442 | ₹15,936,442 |
| Eligible 2025 → 2029 | 3,657 → 5,044 | 3,657 → 5,044 |

### 2. Expanded Medicare coverage of GLP-1s for obesity, US

`BIET_Obesity_Medicare_GLP1_JAMA_2025.xlsx`

Hwang JH et al. *Fiscal Impact of Expanded Medicare Coverage for GLP-1
Receptor Agonists to Treat Obesity.* JAMA Health Forum. 2025;6(4):e250905.
doi:10.1001/jamahealthforum.2025.0905

15.6M Part D beneficiaries, 2026–2030, USD. Validates the **medication budget
component only** — the paper's net fiscal impact also runs a DOC-M
microsimulation for downstream savings, which a budget impact tool does not
model. Cumulative medication expenditure, in billions:

| | 2026 | 2027 | 2028 | 2029 | 2030 |
| --- | --- | --- | --- | --- | --- |
| Published | 11.3 | 16.0 | 21.2 | 26.5 | 32.0 |
| BIET | 11.3 | 16.0 | 21.2 | 26.5 | 32.0 |

### 3. Expanding Medicare GLP-1 coverage for obesity, ISPOR 2026

`BIET_Validation_Obesity_Medicare_GLP1_ISPOR_2026.xlsx`

*Pharmacy Budget Impact of Expanding Medicare Coverage for GLP-1 Receptor
Agonists in the Treatment of Obesity under Alternative Pricing Scenarios.*
ISPOR 2026, poster session 2-4.

69M Medicare beneficiaries, 7% target prevalence, 10% first-year uptake, one
year, USD. Pharmacy spend only — the source study excludes downstream medical
offsets, so the Outcomes sheet is deliberately inert.

| | Published | BIET |
| --- | --- | --- |
| Eligible patients | 4,830,000 | 4,830,000 |
| Patients treated | 483,000 | 483,000 |
| Annual pharmacy budget | $2,498,114,254 | $2,497,728,240 (−0.015%) |
| PMPM | $3.02 | $3.0166 |
| PPPM | $431.01 | $430.94 |

### 4. Oral semaglutide vs sitagliptin, US, 2021

`BIET_Validation_T2D_OralSemaglutide_vs_Sitagliptin_US_2021.xlsx`

Wehler E et al. *Budget Impact of Oral Semaglutide Intensification versus
Sitagliptin among US Patients with Type 2 Diabetes Mellitus Uncontrolled with
Metformin.* PharmacoEconomics. doi:10.1007/s40273-020-00967-7

1-million-life private plan, five years, USD. The cohort is a fixed 1,993
current sitagliptin users, so prevalence here is an already-sized target share
rather than epidemiology, and there is no incidence term. The published
five-year per-patient direct-care cost is annualised into the treatment-cost
field so the clinical outcomes are not counted a second time.

| | Published | BIET |
| --- | --- | --- |
| Target population | 1,993 | 1,993 |
| Oral semaglutide patients | 279 | 279 |
| 5-year current care | $46,698,940 | $46,707,948 (+0.019%) |
| 5-year with intervention | $51,319,140 | $51,328,467 (+0.018%) |
| **Incremental impact** | **$4,620,201** | **$4,620,519 (+0.007%)** |
| Average PMPM | $0.08 | $0.0770, rounds to $0.08 |

---

## What these tests do and do not prove

They prove that BIET, fed each workbook through the real importer, reproduces
the benchmark **recorded on that workbook's own Benchmark or Evidence sheet**,
and that no value leaks in from the previously loaded disease — each case is
imported onto a deliberately wrong default to force that.

They do not independently verify the published figures against the papers. The
sandbox these tests were built in can reach GitHub and nothing else, so the
citations were taken as given. Anyone presenting these numbers should check the
Benchmark sheet against the source before quoting it.

---

## Workbook format

Eight sheets. The first three are `field` / `value` pairs; the rest are one row
per record. `downloadTemplate()` in `client/src/lib/excel.js` writes this shape,
and `KV_SHEETS` / `TREATMENT_COLUMNS` there is the authoritative label list.

| Sheet | Contents |
| --- | --- |
| `Setup` | Therapy area, disease, subgroup, perspective, country, currency, base year, horizon |
| `Population` | Covered population, growth, prevalence, prevalence growth, **annual incidence**, funnel rates |
| `Behaviour` | Expected weight loss, responder rate, annual regain |
| `Comparators` | One row per current-care therapy: name, market share, costs, adherence, persistence |
| `NewIntervention` | One row, same columns |
| `Uptake` | `Year` / `Uptake`, one row per year |
| `Outcomes` | Event name, current annual rate, relative risk on the new drug, cost per event |
| `Evidence` | Provenance: field, value, evidence status, derivation, source URL |

### Always state annual incidence explicitly

The first two workbooks here were built from a template that predated the
incidence mapping, so neither mentioned the field. `importWorkbook()` treats a
partial workbook as a partial update, so the field silently kept whatever the
previously loaded disease had.

On the T2D file that mattered. It reaches the published 2029 endpoint with a
CAGR on the eligible share, so a leftover 0.7% incidence compounded on top of a
growth term that was already doing the work: **7,844 eligible in 2029 against a
published 5,044**, and a net impact 32% too large. `validateModel()` now warns
when incidence and prevalence growth are both above zero, but the workbook
should carry `Annual incidence` regardless — as `0` if the model grows the
population some other way.

Write every field the calculation touches, even the zeroes. A row that is
absent is not a zero; it is whatever was on screen before the import.

---

## Adding a case

A paper is usable if it reports, or lets you transparently derive, all of:

1. **Denominator** — the covered/plan population the budget is measured against.
2. **Eligible population** — either an absolute count, or a prevalence and the
   funnel rates that narrow it. If the paper gives only start and end counts,
   derive the growth term and record the derivation on the Evidence sheet.
3. **Comparators** — each current-care therapy, its per-patient annual cost and
   its market share. Shares must total 1.0 or validation blocks the run.
4. **The new intervention** — per-patient annual cost on the same basis.
5. **Uptake** — share of eligible patients on the new drug, per year.
6. **A published result to check against** — total budget impact, per-year
   spend, or PMPM. Without this the workbook is an input file, not a validation.

Papers that will not fit without redesigning the model: one-off gene-therapy
payments (no annual cost basis), microsimulation outputs BIET does not compute,
and per-course vaccine schedules.

Mark every Evidence row `Reported`, `Derived`, or `Not reported` and give the
source URL. A derived value is legitimate; an undocumented one is not.

Then drop the workbook in this directory and add a `describe` block to
`client/src/lib/literatureValidation.test.js` following the two already there.
