import express from "express";
import {
  syncWorldBankPopulation,
  syncClinicalTrials,
  fetchOpenFdaLabels,
} from "../services/publicSources.js";

export const publicDataRouter = express.Router();

publicDataRouter.post("/sync/world-bank", async (req, res, next) => {
  try {
    const result = await syncWorldBankPopulation(req.body || {});
    res.json(result);
  } catch (error) {
    next(error);
  }
});

publicDataRouter.post("/sync/clinical-trials", async (req, res, next) => {
  try {
    const result = await syncClinicalTrials(req.body || {});
    res.json(result);
  } catch (error) {
    next(error);
  }
});

publicDataRouter.get("/openfda/labels", async (req, res, next) => {
  try {
    const result = await fetchOpenFdaLabels(
      req.query.search || "semaglutide",
      Number(req.query.limit || 10)
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});
