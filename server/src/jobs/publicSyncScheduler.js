import cron from "node-cron";
import { query } from "../db/query.js";
import {
  syncWorldBankPopulation,
  syncClinicalTrials,
} from "../services/publicSources.js";

let started = false;
const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;

async function sourceIsDue(sourceCode) {
  const result = await query(
    `SELECT last_success_at
     FROM source_registry
     WHERE source_code=$1
     LIMIT 1`,
    [sourceCode]
  );

  const last = result.rows[0]?.last_success_at;
  if (!last) return true;

  return Date.now() - new Date(last).getTime() >= FORTY_EIGHT_HOURS_MS;
}

export function startPublicSyncScheduler() {
  if (started) return;
  started = true;

  // Check every day at 02:00, but only run a source when at least 48 hours
  // have passed since its last successful refresh.
  cron.schedule("0 2 * * *", async () => {
    try {
      if (await sourceIsDue("WORLD_BANK")) {
        await syncWorldBankPopulation({
          countryCode: "IND",
          diseaseCode: "OBESITY",
        });
      }

      if (await sourceIsDue("CLINICALTRIALS")) {
        await syncClinicalTrials({
          diseaseCode: "OBESITY",
          condition: "obesity",
          pageSize: 20,
        });
      }

      console.log("Public-data scheduler check complete.");
    } catch (error) {
      console.error("Public-data scheduler failed", error.message);
    }
  });

  console.log("Public-data scheduler enabled (48-hour minimum interval).");
}
