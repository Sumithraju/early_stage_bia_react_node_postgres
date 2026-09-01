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

Then run:

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
