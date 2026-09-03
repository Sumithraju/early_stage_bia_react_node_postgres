import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { query } from "./db/query.js";
import { databaseConfigured } from "./db/pool.js";
import { runMigrations } from "./db/migrate.js";
import { modelRouter } from "./routes/model.js";
import { importRouter } from "./routes/import.js";
import { parameterRouter } from "./routes/parameters.js";
import { referenceRouter } from "./routes/reference.js";
import { publicDataRouter } from "./routes/publicData.js";
import { chatRouter, llmConfigured, llmProviderName } from "./routes/chat.js";
import { notFound, errorHandler } from "./middleware/error.js";
import { startPublicSyncScheduler } from "./jobs/publicSyncScheduler.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const port = Number(process.env.PORT || 4000);

// Render terminates TLS at its proxy; trust it so req.protocol and rate
// limiting see the real client rather than the load balancer.
app.set("trust proxy", 1);

/**
 * CLIENT_ORIGIN accepts a comma-separated list and tolerates bare hostnames,
 * because Render's `fromService` blueprint property yields `foo.onrender.com`
 * rather than a full URL. Empty list => same-origin only, which is the case
 * when this service also serves the built client.
 */
const allowedOrigins = (process.env.CLIENT_ORIGIN || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean)
  .map((value) => (/^https?:\/\//.test(value) ? value : `https://${value}`))
  .map((value) => value.replace(/\/$/, ""));

app.use(
  cors({
    origin(origin, callback) {
      // Same-origin requests and server-to-server calls send no Origin header.
      if (!origin) return callback(null, true);
      if (allowedOrigins.length === 0) return callback(null, true);
      if (allowedOrigins.includes(origin.replace(/\/$/, ""))) {
        return callback(null, true);
      }
      const denied = new Error(`Origin ${origin} is not allowed by CORS.`);
      denied.status = 403;
      return callback(denied);
    },
  })
);
app.use(express.json({ limit: "5mb" }));

app.get("/api/health", async (req, res) => {
  if (!databaseConfigured) {
    return res.json({
      status: "ok",
      database: "not configured",
      llm: llmConfigured() ? llmProviderName() : "not configured",
      note: "The BIET interface computes in the browser and needs no database.",
      serverTime: new Date().toISOString(),
    });
  }

  try {
    const db = await query("SELECT now() as now");
    res.json({ status: "ok", database: "connected", llm: llmConfigured() ? llmProviderName() : "not configured", serverTime: db.rows[0].now });
  } catch (error) {
    // Reachability is a data-layer problem, not a reason to report the served
    // UI as down, so this stays a 200 with a degraded database field.
    res.json({
      status: "ok",
      database: "unavailable",
      error: error.message,
      serverTime: new Date().toISOString(),
    });
  }
});

app.use("/api/model", modelRouter);
app.use("/api/import", importRouter);
app.use("/api/parameters", parameterRouter);
app.use("/api/reference", referenceRouter);
app.use("/api/public", publicDataRouter);
app.use("/api/chat", chatRouter);

/**
 * On Render this one web service also serves the Vite build, so the browser
 * talks to /api on its own origin and no cross-service URL has to be wired up
 * at build time. Locally the client keeps running on the Vite dev server and
 * this block is simply skipped.
 */
const clientDist = path.resolve(__dirname, "../../client/dist");

if (fs.existsSync(path.join(clientDist, "index.html"))) {
  app.use(express.static(clientDist));

  // SPA fallback for everything that is not an API route.
  app.get(/^\/(?!api\/).*/, (req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });

  console.log(`Serving client build from ${clientDist}`);
} else {
  console.log("No client build found - running in API-only mode.");
}

app.use(notFound);
app.use(errorHandler);

async function start() {
  if (String(process.env.RUN_MIGRATIONS || "true").toLowerCase() === "true") {
    try {
      await runMigrations();
    } catch (error) {
      // Never fatal: the interface is served from client/dist and works
      // whether or not the optional REST API has a database behind it.
      console.error("Database migration failed (continuing):", error.message);
    }
  }

  // Bind on 0.0.0.0 so Render's proxy can reach the container.
  app.listen(port, "0.0.0.0", () => {
    console.log(`BIA API listening on port ${port}`);

    if (
      String(process.env.ENABLE_PUBLIC_SYNC || "false").toLowerCase() === "true"
    ) {
      startPublicSyncScheduler();
    }
  });
}

start();
