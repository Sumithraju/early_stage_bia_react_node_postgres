import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { pool, databaseConfigured } from "./pool.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * The SQL lives at the repository root, but this module runs from three
 * different layouts: the repo checkout on Render (<root>/sql), the server
 * Docker image (/app/sql), and an arbitrary working directory in development.
 * Probe the candidates in order rather than assuming one.
 */
function resolveSqlDir() {
  const candidates = [
    process.env.SQL_DIR,
    path.resolve(__dirname, "../../../sql"), // <repo>/sql
    path.resolve(__dirname, "../../sql"), // <server>/sql (Docker image)
    path.resolve(process.cwd(), "sql"),
    path.resolve(process.cwd(), "../sql"),
  ].filter(Boolean);

  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, "schema.sql"))) return dir;
  }
  return null;
}

async function isRecorded(client, name) {
  const result = await client.query(
    "SELECT 1 FROM schema_migrations WHERE name = $1",
    [name]
  );
  return result.rowCount > 0;
}

async function record(client, name) {
  await client.query(
    `INSERT INTO schema_migrations (name) VALUES ($1)
     ON CONFLICT (name) DO UPDATE SET applied_at = now()`,
    [name]
  );
}

/**
 * `seed.sql` inserts reference data. Most of its statements carry ON CONFLICT
 * guards, but the treatment_cost insert has no unique target to conflict on, so
 * replaying the file would duplicate those rows. Treat the presence of seeded
 * data as equivalent to a recorded run, which also covers databases first
 * populated by the docker-compose initdb mounts.
 */
async function alreadySeeded(client) {
  if (await isRecorded(client, "seed.sql")) return true;

  const result = await client.query("SELECT 1 FROM disease_master LIMIT 1");
  return result.rowCount > 0;
}

export async function runMigrations() {
  if (!databaseConfigured) {
    console.log("[migrate] No DATABASE_URL - skipping (UI does not need one).");
    return;
  }

  const sqlDir = resolveSqlDir();

  if (!sqlDir) {
    console.warn("[migrate] No sql/ directory found - skipping migrations.");
    return;
  }

  const client = await pool.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    // schema.sql is written entirely with CREATE ... IF NOT EXISTS, so it is
    // replayed on every boot and picks up newly added tables and indexes.
    await client.query("BEGIN");
    await client.query(fs.readFileSync(path.join(sqlDir, "schema.sql"), "utf8"));
    await record(client, "schema.sql");
    await client.query("COMMIT");
    console.log("[migrate] schema.sql applied.");

    const seedFile = path.join(sqlDir, "seed.sql");

    if (!fs.existsSync(seedFile)) {
      console.log("[migrate] seed.sql not present - skipping.");
    } else if (await alreadySeeded(client)) {
      console.log("[migrate] reference data already present - skipping seed.");
      await record(client, "seed.sql");
    } else {
      await client.query("BEGIN");
      await client.query(fs.readFileSync(seedFile, "utf8"));
      await record(client, "seed.sql");
      await client.query("COMMIT");
      console.log("[migrate] seed.sql applied.");
    }
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

// Allow `node server/src/db/migrate.js` as a standalone step.
if (process.argv[1] && path.basename(process.argv[1]) === "migrate.js") {
  runMigrations()
    .then(() => {
      console.log("[migrate] done.");
      return pool.end();
    })
    .catch((error) => {
      console.error("[migrate] failed:", error.message);
      process.exit(1);
    });
}
