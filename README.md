# Early-Stage Budget Impact Estimation Tool
## React + Node.js + PostgreSQL

A full-stack proof-of-concept for a disease-agnostic early-stage Budget Impact Analysis (BIA) platform.

**New here?** Start with the [demo guide](docs/demo/README.md) — a tab-by-tab
walkthrough of the built-in scenario with screenshots, the inputs to enter, and
the numbers you should see. For how the system is put together, see the
[architecture and test documentation](docs/architecture.md).

### Main features

- React dashboard
- Node.js / Express REST API
- PostgreSQL
- Dynamic disease and subgroup model
- Excel `.xlsx` import
- Public-source parameter store
- User override precedence
- Current-care vs new-intervention budget impact
- 1–5 year uptake
- Treatment behaviour
- Medical-cost offsets
- Base / Low / High scenarios
- Parameter audit trail
- Historical model runs
- Public-data sync scaffold (off by default on free-tier hosting)
- World Bank population adapter
- ClinicalTrials.gov adapter
- openFDA drug-label adapter
- WHO / NPPA adapters left as explicit extension points because public endpoints/formats may vary

---

## Architecture

```text
                PUBLIC DATA SOURCES
          World Bank | ClinicalTrials.gov
                    openFDA
                         |
              sync, min 48h between runs
              (disabled by default)
                         |
                         v
                  PostgreSQL
                         ^
                         |
          Excel Upload / User Overrides
                         |
                         v
                Parameter Resolver
                         |
                         v
               Budget Impact Engine
                         |
                         v
                  REST API
                         |
                         v
                 React Dashboard
```

### Parameter precedence

```text
USER_OVERRIDE
    >
VALIDATED_CURATED
    >
PUBLIC_SOURCE
    >
DEFAULT_ASSUMPTION
```

Public source records are versioned. A user override does not destroy the public value.

---

## Enable the AI assistant (optional)

The assistant works out of the box in **Local mode** — it answers budget-impact
questions from a built-in knowledge base grounded in your live results, with no
key and no network. To upgrade it to free-form LLM answers, add a free key.

**Recommended — server-side (secure, any provider).** Get a free key, then set
these as environment variables on the web service (Render → the service →
Environment). The key stays on the server and never reaches the browser.

| Variable | Example | Notes |
| --- | --- | --- |
| `LLM_API_KEY` | *your key* | Enables the assistant's AI mode |
| `LLM_PROVIDER` | `groq` | `groq` (free Llama), `openrouter`, `huggingface`, or `xai` |
| `LLM_MODEL` | *(optional)* | Override the provider's default model |

Free keys: [Groq](https://console.groq.com/keys) (Llama 3.3, fast),
[OpenRouter](https://openrouter.ai/keys), [HuggingFace](https://huggingface.co/settings/tokens).
The server proxies `/api/chat`, so browser CORS and key exposure are not an issue.

**Browser-only alternative.** Open the assistant's gear icon and paste an
OpenRouter key — session-only, never committed. (OpenRouter allows direct browser
calls; Groq/HuggingFace/xAI need the server option above.)

The app never invents clinical or cost values — the assistant only explains the
numbers the model computed.

---

## Deploy to Render

The repository ships a Render Blueprint (`render.yaml`). It provisions a single
Node web service that serves the Express API on `/api` **and** the compiled
React bundle on every other path. The browser therefore stays on one origin: no
CORS configuration, and no API hostname has to be baked into the Vite build.

The blueprint does **not** create a database. Render allows only one free-tier
PostgreSQL per account, so declaring one fails with *"cannot have more than one
active free tier database"* if you already have one. `DATABASE_URL` is marked
`sync: false` and you point it at your existing instance.

### Steps

1. In Render: **New → Blueprint**, then select this repository.
2. Render reads `render.yaml` from the default branch and shows the web service.
3. When prompted for `DATABASE_URL`, paste the connection string of your
   PostgreSQL instance: **Dashboard → your database → Connect → Internal
   Database URL**.
4. Confirm with **Apply**.
5. On first boot the service creates its tables and reference data in that
   database automatically.
6. Open the service URL. `/api/health` should report `database: connected`.

**Region matters.** The Internal Database URL only resolves when the service and
the database are in the same region — set `region:` in `render.yaml` to match
your database. If they must differ, use the External Database URL and open the
database's IP allow list; TLS is then negotiated automatically.

To let the blueprint manage its own database instead (after deleting the
existing free one, or on a paid plan), `render.yaml` carries the `databases:`
block commented out at the bottom along with the `DATABASE_URL` change needed.

### Build and start commands

```text
build: npm run build     # installs server + client deps, runs vite build
start: npm start         # runs migrations, then serves API + client
```

### Environment variables

| Variable | Set by | Notes |
| --- | --- | --- |
| `DATABASE_URL` | You, at sync time | Connection string of your existing Render PostgreSQL |
| `NODE_VERSION` | Blueprint | `20` |
| `RUN_MIGRATIONS` | Blueprint | `true` — applies schema/seed on boot |
| `ENABLE_PUBLIC_SYNC` | Blueprint | `false` — a free instance sleeps, so the nightly cron would not fire reliably |
| `CLIENT_ORIGIN` | unset | Only needed if the client is hosted separately; accepts a comma-separated list |
| `DATABASE_SSL` | unset | TLS is chosen from the database host; set `true`/`false` to force it |
| `LLM_API_KEY` | You, optional | Enables the AI assistant **and** EviTrack insight summaries |
| `LLM_PROVIDER` | You, optional | `groq` (default), `openrouter`, `huggingface` or `xai` |
| `GEMINI_API_KEY` | You, optional | Only if you want Gemini in EviTrack's model picker |
| `GROQ_API_KEY` | You, optional | Not needed — `LLM_API_KEY` covers Groq — but wins if set |

One key is enough: `LLM_API_KEY` with `LLM_PROVIDER=groq` powers both the
assistant and EviTrack. A provider-specific key takes precedence where present.
With no key at all, the assistant falls back to built-in local answers and
EviTrack search still works without insight summaries.

### Things worth knowing

- **Free Postgres expires 30 days after it is created.** Render deletes it
  unless you upgrade to a paid instance. Export anything you need before then.
- **Only one free database per account.** That is why the blueprint reuses an
  existing instance rather than creating its own.
- **Free web services sleep after 15 minutes idle**, so the first request after
  a pause takes roughly 50 seconds while the instance wakes.
- **Region** is `oregon` in `render.yaml`. It must match your database's region
  for the Internal Database URL to resolve.
- **Branch**: Render deploys the repository's default branch unless you pick a
  different one in the Blueprint settings.
- **Uploaded workbooks are parsed and deleted**; the disk is ephemeral, so
  imported data lives in Postgres rather than on the instance.

---

## Quick start with Docker

```bash
docker compose up --build
```

Open:

- React: http://localhost:5173
- API: http://localhost:4000/api/health
- PostgreSQL: localhost:5432

---

## Run locally without Docker

### 1. PostgreSQL

Create:

```sql
CREATE DATABASE bia;
```

The server applies `sql/schema.sql` and `sql/seed.sql` itself on startup, so no
further setup is needed. To apply them by hand instead:

```bash
psql -d bia -f sql/schema.sql
psql -d bia -f sql/seed.sql
```

### 2. Server

```bash
cd server
cp .env.example .env
npm install
npm run dev
```

### 3. Client

```bash
cd client
cp .env.example .env
npm install
npm run dev
```

---

## Core BIA population funnel

```text
Covered population
× prevalence
× diagnosis rate
× clinical eligibility
× payer eligibility
× access
× willingness
= eligible patients
```

For each year:

```text
Current scenario
= eligible patients × weighted current-care treatment cost
+ current medical event cost

New scenario
= remaining current-care patients × current-care cost
+ new-intervention patients × new-intervention cost
+ medical event cost after intervention effect

Net budget impact
= New scenario - Current scenario

PMPM
= Net budget impact / covered population / 12
```

### Current-care drug exposure

```text
annual drug cost × adherence × persistence
```

Administration and monitoring:

```text
(annual administration + annual monitoring) × persistence
```

### Medical event cost

```text
current:
annual event rate × cost per event

new intervention:
annual event rate × relative risk × cost per event
```

---

## Excel import

The API accepts an `.xlsx` workbook at:

```text
POST /api/import/excel
```

Expected sheets:

```text
01_Model_Config
04_Population
05_Epidemiology
06_Eligibility
07_Current_Treatments
08_New_Intervention
09_Market_Uptake
10_Treatment_Behaviour
11_Clinical_Outcomes
12_Healthcare_Costs
13_Scenarios
14_Data_Sources
```

For key-value sheets use columns:

```text
field | value | unit | source / note
```

---

## Public data synchronization

Manual:

```bash
cd server
npm run sync:public
```

Scheduling: a daily cron at 02:00 checks each source and refreshes it only if
at least 48 hours have passed since its last success, so the effective cadence
is 48-72 hours. It requires a database, and it is **off by default** --
`ENABLE_PUBLIC_SYNC` is `false` in `render.yaml`, because a free Render instance
sleeps when idle and the schedule would not fire reliably. Set it to `true` on
an always-on host. The manual command above works either way.

Implemented adapters:

- World Bank population
- ClinicalTrials.gov study discovery
- openFDA drug-label search

Extension points:

- WHO epidemiology
- NPPA India regulated prices

For production, verify terms of use, schemas and source-specific update policies.

---

## Important note

This is a hackathon / early-stage POC. It is not a validated HTA submission model. Clinical, payer, epidemiological, price and utilization assumptions should be reviewed by HEOR/domain experts before decision use.
# early_stage_bia_react_node_postgres
