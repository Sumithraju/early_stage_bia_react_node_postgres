import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required.");
}

/**
 * Render's managed Postgres needs TLS when it is reached over its *external*
 * hostname (`dpg-xxxx-a.oregon-postgres.render.com`), but its *internal*
 * hostname (`dpg-xxxx-a`) and a local Docker/dev database do not offer it.
 * Pick the right mode from the host so the same code works everywhere, and
 * allow an explicit override through DATABASE_SSL.
 */
function resolveSsl(connectionString) {
  // An empty or blank value counts as "not set" so that a cleared dashboard
  // field falls back to host detection instead of silently disabling TLS.
  const override = (process.env.DATABASE_SSL || "").trim().toLowerCase();
  if (override) {
    return override === "true" || override === "require"
      ? { rejectUnauthorized: false }
      : false;
  }

  let hostname;
  try {
    hostname = new URL(connectionString).hostname;
  } catch {
    return false;
  }

  const isLocal =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "postgres"; // docker-compose service name

  // Render internal hostnames are single-label (no dots) and speak plaintext.
  const isInternal = !hostname.includes(".");

  if (isLocal || isInternal) return false;

  // Render terminates TLS with a certificate the client cannot chain to a
  // public root, so verification has to be relaxed for managed Postgres.
  return { rejectUnauthorized: false };
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: resolveSsl(process.env.DATABASE_URL),
  max: Number(process.env.PG_POOL_MAX || 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 15_000,
});

pool.on("error", (err) => {
  console.error("Unexpected PostgreSQL error", err);
});
