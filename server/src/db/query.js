import { pool, databaseConfigured } from "./pool.js";

function requirePool() {
  if (!databaseConfigured || !pool) {
    const err = new Error(
      "No database configured. The BIET interface runs without one; only the optional REST API needs DATABASE_URL."
    );
    err.status = 503;
    throw err;
  }
  return pool;
}

export async function query(text, params = []) {
  return requirePool().query(text, params);
}

export async function withTransaction(callback) {
  const client = await requirePool().connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
