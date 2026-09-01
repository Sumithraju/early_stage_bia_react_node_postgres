import axios from "axios";
import { withTransaction, query } from "../db/query.js";

async function logStart(sourceCode) {
  const res = await query(
    `INSERT INTO data_refresh_log(source_code, status)
     VALUES ($1, 'RUNNING') RETURNING id`,
    [sourceCode]
  );
  return res.rows[0].id;
}

async function logFinish(id, payload) {
  await query(
    `UPDATE data_refresh_log
     SET job_completed_at=now(),
         records_requested=$2,
         records_received=$3,
         records_inserted=$4,
         records_updated=$5,
         records_unchanged=$6,
         records_failed=$7,
         status=$8,
         error_message=$9
     WHERE id=$1`,
    [
      id,
      payload.requested || 0,
      payload.received || 0,
      payload.inserted || 0,
      payload.updated || 0,
      payload.unchanged || 0,
      payload.failed || 0,
      payload.status || "SUCCESS",
      payload.error || null,
    ]
  );
}

export async function syncWorldBankPopulation({
  countryCode = "IND",
  diseaseCode = "OBESITY",
} = {}) {
  const logId = await logStart("WORLD_BANK");
  const url =
    `https://api.worldbank.org/v2/country/${countryCode}/indicator/SP.POP.TOTL` +
    `?format=json&per_page=10`;

  try {
    const { data } = await axios.get(url, { timeout: 30000 });
    const rows = Array.isArray(data) && Array.isArray(data[1]) ? data[1] : [];
    const latest = rows.find((x) => x.value !== null && x.value !== undefined);

    if (!latest) throw new Error("No population record returned.");

    await query(
      `INSERT INTO model_parameter
       (
         disease_code, country_code, scenario_id, parameter_category,
         parameter_name, parameter_value, unit, source_code, source_record_id,
         source_url, retrieved_at, data_origin, validation_status,
         is_user_override, is_active
       )
       VALUES
       ($1,$2,'BASE','POPULATION','covered_population_reference',$3,'people',
        'WORLD_BANK',$4,$5,now(),'PUBLIC_API','AUTO_VALIDATED',false,true)`,
      [diseaseCode, countryCode, Number(latest.value), latest.date, url]
    );

    await query(
      `UPDATE source_registry
       SET last_checked_at=now(), last_success_at=now()
       WHERE source_code='WORLD_BANK'`
    );

    await logFinish(logId, {
      requested: 1,
      received: 1,
      inserted: 1,
      status: "SUCCESS",
    });

    return {
      source: "WORLD_BANK",
      parameter: "covered_population_reference",
      value: Number(latest.value),
      year: Number(latest.date),
    };
  } catch (error) {
    await logFinish(logId, {
      requested: 1,
      failed: 1,
      status: "FAILED",
      error: error.message,
    });
    throw error;
  }
}

export async function syncClinicalTrials({
  diseaseCode = "OBESITY",
  condition = "obesity",
  pageSize = 20,
} = {}) {
  const logId = await logStart("CLINICALTRIALS");
  const url = "https://clinicaltrials.gov/api/v2/studies";

  try {
    const { data } = await axios.get(url, {
      params: {
        "query.cond": condition,
        pageSize,
        format: "json",
      },
      timeout: 30000,
    });

    const studies = data.studies || [];

    let inserted = 0;
    await withTransaction(async (client) => {
      for (const study of studies) {
        const p = study.protocolSection || {};
        const identification = p.identificationModule || {};
        const status = p.statusModule || {};
        const design = p.designModule || {};
        const sponsor = p.sponsorCollaboratorsModule || {};
        const eligibility = p.eligibilityModule || {};
        const conditions = p.conditionsModule || {};
        const arms = p.armsInterventionsModule || {};
        const outcomes = p.outcomesModule || {};

        const interventionName =
          arms.interventions?.map((x) => x.name).filter(Boolean).join("; ") ||
          null;

        await client.query(
          `INSERT INTO clinical_trial_snapshot
           (
             nct_id, disease_code, condition_text, intervention_name,
             phase, overall_status, sponsor, enrollment,
             min_age, max_age, sex, primary_outcomes, secondary_outcomes,
             source_url, source_last_updated, retrieved_at
           )
           VALUES
           ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13::jsonb,$14,$15,now())`,
          [
            identification.nctId,
            diseaseCode,
            (conditions.conditions || []).join("; "),
            interventionName,
            (design.phases || []).join("; "),
            status.overallStatus || null,
            sponsor.leadSponsor?.name || null,
            design.enrollmentInfo?.count || null,
            eligibility.minimumAge || null,
            eligibility.maximumAge || null,
            eligibility.sex || null,
            JSON.stringify(outcomes.primaryOutcomes || []),
            JSON.stringify(outcomes.secondaryOutcomes || []),
            `https://clinicaltrials.gov/study/${identification.nctId}`,
            status.studyFirstPostDateStruct?.date || null,
          ]
        );
        inserted += 1;
      }
    });

    await query(
      `UPDATE source_registry
       SET last_checked_at=now(), last_success_at=now()
       WHERE source_code='CLINICALTRIALS'`
    );

    await logFinish(logId, {
      requested: pageSize,
      received: studies.length,
      inserted,
      status: "SUCCESS",
    });

    return { source: "CLINICALTRIALS", inserted };
  } catch (error) {
    await logFinish(logId, {
      requested: pageSize,
      failed: 1,
      status: "FAILED",
      error: error.message,
    });
    throw error;
  }
}

export async function fetchOpenFdaLabels(search = "semaglutide", limit = 10) {
  const url = "https://api.fda.gov/drug/label.json";

  const { data } = await axios.get(url, {
    params: {
      search: `openfda.generic_name:"${search}"`,
      limit,
    },
    timeout: 30000,
  });

  return (data.results || []).map((x) => ({
    id: x.id,
    effectiveTime: x.effective_time,
    genericName: x.openfda?.generic_name?.[0] || null,
    brandName: x.openfda?.brand_name?.[0] || null,
    manufacturer: x.openfda?.manufacturer_name?.[0] || null,
    route: x.openfda?.route?.join("; ") || null,
    indicationsAndUsage: x.indications_and_usage?.join("\n") || null,
    contraindications: x.contraindications?.join("\n") || null,
  }));
}

/*
  WHO and NPPA adapters should be implemented source-by-source because
  endpoint/file structures can vary.

  Recommended pattern:
    1. Fetch raw source
    2. Normalize to model_parameter or treatment_cost records
    3. Store source URL and retrieval time
    4. Never destroy previous public records
    5. Set validation_status=PENDING_REVIEW unless the transformation is deterministic
*/
