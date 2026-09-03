import { pool } from "../../db/pool.js";

/**
 * The database is optional in this deployment (Render's free PostgreSQL
 * expires, and the app must keep working without it). Evidence search hits
 * public APIs and does not need storage, so when there is no pool we skip
 * persistence rather than failing the request.
 */
export function evidenceStorageAvailable() {
  return Boolean(pool);
}

export async function saveEvidence(evidence) {
  if (!pool) {
    // No storage configured: hand back the record unsaved so search still works.
    return { ...evidence, evidence_id: null };
  }

  const {
    title,
    source,
    source_id = null,
    url,
    authors = [],
    year = null,
    doi = null,
    evidence_type,
    abstract = null,
  } = evidence;

  if (source_id) {
    const existing = await pool.query(
      `SELECT
         evidence_id,
         source,
         source_id,
         source_url AS url,
         title,
         authors,
         publication_date AS year,
         doi,
         evidence_type,
         abstract
       FROM evidence_records
       WHERE source = $1
         AND source_id = $2
       LIMIT 1`,
      [source, source_id]
    );

    if (existing.rowCount > 0) {
      return existing.rows[0];
    }
  }

  const authorsText = Array.isArray(authors)
    ? authors.join("; ")
    : authors || null;

  const result = await pool.query(
    `INSERT INTO evidence_records (
       source,
       source_id,
       source_url,
       title,
       authors,
       publication_date,
       doi,
       evidence_type,
       abstract
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING
       evidence_id,
       source,
       source_id,
       source_url AS url,
       title,
       authors,
       publication_date AS year,
       doi,
       evidence_type,
       abstract`,
    [
      source,
      source_id,
      url,
      title,
      authorsText,
      year,
      doi,
      evidence_type,
      abstract,
    ]
  );

  return result.rows[0];
}


export async function listEvidence(limit = 100) {
  if (!pool) return [];

  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);

  const result = await pool.query(
    `SELECT
       evidence_id,
       title,
       source,
       source_id,
       source_url AS url,
       authors,
       publication_date AS year,
       doi,
       evidence_type,
       abstract
     FROM evidence_records
     ORDER BY evidence_id DESC
     LIMIT $1`,
    [safeLimit]
  );

  return result.rows.map((row) => ({
    ...row,
    authors: row.authors
      ? row.authors.split("; ")
      : [],
  }));
}
