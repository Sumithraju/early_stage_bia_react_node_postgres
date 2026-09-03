import express from "express";
import { searchEvidence } from "../services/evitrack/search.js";
import { listEvidence, saveEvidence } from "../services/evitrack/evidenceRepository.js";
import { pool } from "../db/pool.js";
import { evidenceSourceRegistry } from "../services/evitrack/sources/registry.js";

export const evitrackRouter = express.Router();

evitrackRouter.get("/search", async (req, res, next) => {
  try {
    const query = String(req.query.q || "").trim();
    const source = String(req.query.source || "all").trim().toLowerCase();

    const requestedLimit = Number(req.query.limit || 10);
    const limit = Math.min(
      Math.max(Number.isFinite(requestedLimit) ? requestedLimit : 10, 1),
      25
    );

    const country = String(req.query.country || "IND").trim();

    if (!query) {
      return res.status(400).json({
        detail: "Query parameter 'q' is required.",
      });
    }

    const results = await searchEvidence({
      query,
      source,
      limit,
      country,
    });

    let newCount = 0;
    let existingCount = 0;
    const savedResults = [];

    for (const result of results) {
      let existing = null;

      if (result.source_id) {
        const existingResult = await pool.query(
          `SELECT evidence_id
           FROM evidence_records
           WHERE source = $1
             AND source_id = $2
           LIMIT 1`,
          [result.source, result.source_id]
        );

        existing = existingResult.rowCount > 0
          ? existingResult.rows[0]
          : null;
      }

      const saved = await saveEvidence(result);

      if (existing) {
        existingCount += 1;
      } else {
        newCount += 1;
      }

      savedResults.push({
        ...result,
        evidence_id: saved.evidence_id,
      });
    }

    return res.json({
      query,
      source: results[0]?.source || source,
      saved_count: savedResults.length,
      new_count: newCount,
      existing_count: existingCount,
      results: savedResults,
    });
  } catch (error) {
    return next(error);
  }
});


evitrackRouter.get("/evidence", async (req, res, next) => {
  try {
    const requestedLimit = Number(req.query.limit || 100);
    const limit = Math.min(
      Math.max(Number.isFinite(requestedLimit) ? requestedLimit : 100, 1),
      500
    );

    const results = await listEvidence(limit);

    return res.json({
      count: results.length,
      results,
    });
  } catch (error) {
    return next(error);
  }
});

evitrackRouter.post("/evidence", async (req, res, next) => {
  try {
    const evidence = req.body;

    if (!evidence || typeof evidence !== "object") {
      return res.status(400).json({
        detail: "Evidence object is required.",
      });
    }

    const saved = await saveEvidence(evidence);

    return res.json({
      status: "saved",
      evidence_id: saved.evidence_id,
      evidence,
    });
  } catch (error) {
    return next(error);
  }
});

evitrackRouter.get("/health", (_req, res) => {
  return res.json({
    module: "evitrack",
    status: "ok",
  });
});

evitrackRouter.get("/sources", (_req, res) => {
  return res.json({
    sources: evidenceSourceRegistry.list().map((name) => ({
      name,
    })),
  });
});
