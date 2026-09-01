# Early-Stage Budget Impact Estimation Tool
## React + Node.js + PostgreSQL

A full-stack proof-of-concept for a disease-agnostic early-stage Budget Impact Analysis (BIA) platform.

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
- 48-hour public-data sync scaffold
- World Bank population adapter
- ClinicalTrials.gov adapter
- openFDA drug-label adapter
- WHO / NPPA adapters left as explicit extension points because public endpoints/formats may vary

---

## Architecture

```text
                PUBLIC DATA SOURCES
          World Bank | ClinicalTrials.gov
               openFDA | WHO | NPPA
                         |
                    48-hour sync
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

## Deploy to Render

The repository ships a Render Blueprint (`render.yaml`). It provisions:

| Resource | Type | Purpose |
| --- | --- | --- |
| `bia-postgres` | PostgreSQL 16 (free) | BIA schema and reference data |
| `early-stage-bia` | Node web service (free) | Express API on `/api` **and** the compiled React bundle on every other path |

The client is served by the API service, so the browser stays on one origin:
no CORS configuration, and no API hostname has to be baked into the Vite build.

### Steps

1. Push this branch to GitHub.
2. In Render: **New → Blueprint**, then select this repository.
3. Render reads `render.yaml`, shows the database plus the web service, and you
   confirm with **Apply**.
4. Wait for the first deploy. On boot the service applies `sql/schema.sql` and
   `sql/seed.sql` to the new database automatically.
5. Open the service URL. `"/api/health"` should report `database: connected`.

`DATABASE_URL` is wired from the database automatically — you do not paste it in.

### Build and start commands

```text
build: npm run build     # installs server + client deps, runs vite build
start: npm start         # runs migrations, then serves API + client
```

### Environment variables

| Variable | Set by | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Blueprint | Internal connection string for `bia-postgres` |
| `NODE_VERSION` | Blueprint | `20` |
| `RUN_MIGRATIONS` | Blueprint | `true` — applies schema/seed on boot |
| `ENABLE_PUBLIC_SYNC` | Blueprint | `false` — a free instance sleeps, so the nightly cron would not fire reliably |
| `CLIENT_ORIGIN` | unset | Only needed if the client is hosted separately; accepts a comma-separated list |
| `DATABASE_SSL` | unset | TLS is chosen from the database host; set `true`/`false` to force it |

### Things worth knowing

- **Free Postgres expires after 30 days.** Render deletes it unless you upgrade
  to a paid instance. Export anything you need before then.
- **Free web services sleep after 15 minutes idle**, so the first request after
  a pause takes roughly 50 seconds while the instance wakes.
- **Region** is `oregon` in `render.yaml`. Change it on both the database and the
  service — they must match for the internal connection string to resolve.
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

Scheduled automatically every 48 hours while the server is running.

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
