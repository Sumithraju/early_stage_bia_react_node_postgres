import express from "express";
import { query } from "../db/query.js";

export const referenceRouter = express.Router();

referenceRouter.get("/diseases", async (req, res, next) => {
  try {
    const result = await query(
      `SELECT disease_code, disease_name, therapeutic_area
       FROM disease_master
       WHERE is_active=true
       ORDER BY therapeutic_area, disease_name`
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

referenceRouter.get("/subgroups/:diseaseCode", async (req, res, next) => {
  try {
    const result = await query(
      `SELECT subgroup_dimension, subgroup_code, subgroup_label, sort_order
       FROM subgroup_master
       WHERE disease_code=$1 AND is_active=true
       ORDER BY subgroup_dimension, sort_order, subgroup_label`,
      [req.params.diseaseCode]
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

referenceRouter.get("/refresh-log", async (req, res, next) => {
  try {
    const result = await query(
      `SELECT *
       FROM data_refresh_log
       ORDER BY job_started_at DESC
       LIMIT 100`
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

referenceRouter.get("/trials", async (req, res, next) => {
  try {
    const { diseaseCode = "OBESITY" } = req.query;
    const result = await query(
      `SELECT DISTINCT ON (nct_id)
         nct_id, disease_code, condition_text, intervention_name, phase,
         overall_status, sponsor, enrollment, min_age, max_age, sex,
         primary_outcomes, secondary_outcomes, source_url,
         source_last_updated, retrieved_at
       FROM clinical_trial_snapshot
       WHERE disease_code=$1
       ORDER BY nct_id, retrieved_at DESC`,
      [diseaseCode]
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});
