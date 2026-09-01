import dotenv from "dotenv";
dotenv.config();

import {
  syncWorldBankPopulation,
  syncClinicalTrials,
} from "../services/publicSources.js";
import { pool } from "../db/pool.js";

async function main() {
  try {
    const population = await syncWorldBankPopulation({
      countryCode: "IND",
      diseaseCode: "OBESITY",
    });
    console.log(population);

    const trials = await syncClinicalTrials({
      diseaseCode: "OBESITY",
      condition: "obesity",
      pageSize: 20,
    });
    console.log(trials);
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
