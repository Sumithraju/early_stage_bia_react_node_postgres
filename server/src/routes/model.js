import express from "express";
import { getDefaultModel } from "../services/defaultModel.js";
import { calculateBudgetImpact } from "../services/biaEngine.js";
import { query } from "../db/query.js";

export const modelRouter = express.Router();

modelRouter.get("/default", (req, res) => {
  res.json(getDefaultModel());
});

modelRouter.post("/calculate", (req, res, next) => {
  try {
    const result = calculateBudgetImpact(req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

modelRouter.post("/runs", async (req, res, next) => {
  try {
    const { input, result } = req.body;

    const saved = await query(
      `INSERT INTO budget_impact_run
       (
         disease_code, country_code, scenario_id, model_name, currency,
         perspective, base_year, time_horizon_years, inputs_json,
         summary_json, annual_results_json
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11::jsonb)
       RETURNING id, created_at`,
      [
        input.diseaseCode,
        input.countryCode,
        input.scenarioId || "BASE",
        input.modelName,
        input.currency,
        input.perspective,
        input.baseYear,
        input.timeHorizonYears,
        JSON.stringify(input),
        JSON.stringify(result.summary),
        JSON.stringify(result.annualResults),
      ]
    );

    res.status(201).json(saved.rows[0]);
  } catch (error) {
    next(error);
  }
});

modelRouter.get("/runs", async (req, res, next) => {
  try {
    const result = await query(
      `SELECT id, disease_code, country_code, scenario_id,
              model_name, currency, perspective, base_year,
              time_horizon_years, summary_json, created_at
       FROM budget_impact_run
       ORDER BY created_at DESC
       LIMIT 100`
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

modelRouter.get("/runs/:id", async (req, res, next) => {
  try {
    const result = await query(
      `SELECT * FROM budget_impact_run WHERE id=$1`,
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Run not found" });
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});
