import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import { query } from "./db/query.js";
import { modelRouter } from "./routes/model.js";
import { importRouter } from "./routes/import.js";
import { parameterRouter } from "./routes/parameters.js";
import { referenceRouter } from "./routes/reference.js";
import { publicDataRouter } from "./routes/publicData.js";
import { notFound, errorHandler } from "./middleware/error.js";
import { startPublicSyncScheduler } from "./jobs/publicSyncScheduler.js";

const app = express();
const port = Number(process.env.PORT || 4000);

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
  })
);
app.use(express.json({ limit: "5mb" }));

app.get("/api/health", async (req, res, next) => {
  try {
    const db = await query("SELECT now() as now");
    res.json({
      status: "ok",
      database: "connected",
      serverTime: db.rows[0].now,
    });
  } catch (error) {
    next(error);
  }
});

app.use("/api/model", modelRouter);
app.use("/api/import", importRouter);
app.use("/api/parameters", parameterRouter);
app.use("/api/reference", referenceRouter);
app.use("/api/public", publicDataRouter);

app.use(notFound);
app.use(errorHandler);

app.listen(port, () => {
  console.log(`BIA API running on http://localhost:${port}`);

  if (
    String(process.env.ENABLE_PUBLIC_SYNC || "false").toLowerCase() === "true"
  ) {
    startPublicSyncScheduler();
  }
});
