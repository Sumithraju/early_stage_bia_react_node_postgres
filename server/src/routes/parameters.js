import express from "express";
import { query } from "../db/query.js";
import { resolveParameterMap } from "../services/parameterResolver.js";

export const parameterRouter = express.Router();

parameterRouter.get("/", async (req, res, next) => {
  try {
    const {
      diseaseCode = "OBESITY",
      countryCode = "IND",
      scenarioId = "BASE",
    } = req.query;

    const result = await query(
      `SELECT *
       FROM model_parameter
       WHERE disease_code=$1
         AND (country_code=$2 OR country_code IS NULL)
         AND scenario_id=$3
         AND is_active=true
       ORDER BY parameter_name, retrieved_at DESC`,
      [diseaseCode, countryCode, scenarioId]
    );

    res.json({
      raw: result.rows,
      resolved: resolveParameterMap(result.rows),
    });
  } catch (error) {
    next(error);
  }
});

parameterRouter.post("/", async (req, res, next) => {
  try {
    const p = req.body;

    const result = await query(
      `INSERT INTO model_parameter
       (
         disease_code, indication, subgroup_dimension, subgroup_value,
         country_code, region, payer_type, perspective, scenario_id,
         parameter_category, parameter_name, parameter_value, parameter_text,
         unit, lower_bound, upper_bound, source_code, source_record_id,
         source_url, data_origin, validation_status, is_user_override,
         is_active, created_by
       )
       VALUES
       ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,true,$23)
       RETURNING *`,
      [
        p.diseaseCode,
        p.indication || null,
        p.subgroupDimension || null,
        p.subgroupValue || null,
        p.countryCode || null,
        p.region || null,
        p.payerType || null,
        p.perspective || null,
        p.scenarioId || "BASE",
        p.parameterCategory || "CUSTOM",
        p.parameterName,
        p.parameterValue ?? null,
        p.parameterText ?? null,
        p.unit || null,
        p.lowerBound ?? null,
        p.upperBound ?? null,
        p.sourceCode || null,
        p.sourceRecordId || null,
        p.sourceUrl || null,
        p.dataOrigin || "USER_OVERRIDE",
        p.validationStatus || "VERIFIED",
        p.isUserOverride ?? true,
        p.createdBy || "demo-user",
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

parameterRouter.patch("/:id/deactivate", async (req, res, next) => {
  try {
    const result = await query(
      `UPDATE model_parameter
       SET is_active=false, updated_at=now()
       WHERE id=$1
       RETURNING *`,
      [req.params.id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});
