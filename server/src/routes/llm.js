import express from "express";
import { GeminiService } from "../services/evitrack/llm/gemini.js";
import { GroqService } from "../services/evitrack/llm/groq.js";
import { availableProvider } from "../services/evitrack/llm/keys.js";

export const llmRouter = express.Router();

const ALLOWED_MODELS = new Set([
  "gemini-3.6-flash",
  "gemini-3.5-flash-lite",
  "openai/gpt-oss-120b",
]);

function getLlmService(model = null) {
  if (model && !ALLOWED_MODELS.has(model)) {
    throw new Error(`Unsupported model: ${model}`);
  }

  if (model === "openai/gpt-oss-120b") {
    return new GroqService(model);
  }
  if (model) {
    return new GeminiService(model);
  }

  // No model asked for: use whichever provider this deployment has a key for,
  // rather than defaulting to one and failing when the other is configured.
  return availableProvider() === "groq"
    ? new GroqService()
    : new GeminiService(model);
}

/**
 * AI insights are an enhancement, not a requirement: with no key configured
 * the endpoints say so plainly (503) instead of surfacing a 500, and the UI
 * keeps working without them.
 */
function llmUnavailable(res) {
  if (availableProvider()) return false;
  res.status(503).json({
    error:
      "AI insights are not configured. Set LLM_API_KEY (with LLM_PROVIDER), " +
      "GROQ_API_KEY, or GEMINI_API_KEY on the server to enable them.",
  });
  return true;
}

function cleanJsonResponse(rawResponse) {
  let text = String(rawResponse || "").trim();

  if (text.startsWith("```")) {
    text = text.replace(/^```json\s*/i, "");
    text = text.replace(/^```\s*/i, "");
    text = text.replace(/\s*```$/i, "");
    text = text.trim();
  }

  return text;
}

llmRouter.get("/status", (_req, res) => {
  const provider = availableProvider();
  res.json({ configured: Boolean(provider), provider });
});

llmRouter.post("/generate", async (req, res, next) => {
  try {
    if (llmUnavailable(res)) return;

    const { prompt, model = null } = req.body || {};

    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({
        error: "Prompt is required.",
      });
    }

    const service = getLlmService(model);
    const response = await service.generate(prompt);

    return res.json({
      response,
    });
  } catch (error) {
    return next(error);
  }
});

llmRouter.post("/search-insights", async (req, res, next) => {
  try {
    if (llmUnavailable(res)) return;

    const { results, model = null } = req.body || {};

    if (!Array.isArray(results) || results.length < 1 || results.length > 25) {
      return res.status(400).json({
        error: "results must contain between 1 and 25 items.",
      });
    }

    const resultText = results.map((item) => `
RESULT ${item.index}
Source: ${item.source}
Source ID: ${item.source_id || "Not provided"}
Year: ${item.year || "Not provided"}
Title: ${item.title}
Abstract/content:
${item.abstract || "No abstract/content provided"}
`.trim());

    const prompt = `
You are the evidence-highlighting assistant inside EviTrack,
a pharmaceutical Budget Impact Analysis tool.

For EACH supplied search result, write ONE important
evidence insight for the user.

STRICT RULES:
1. Use ONLY the supplied result.
2. Do not use outside knowledge.
3. Do not invent facts, numbers, findings, or conclusions.
4. Preserve important numerical values exactly.
5. Each insight MUST contain approximately 150-400 characters.
6. Focus on the most useful information for evaluating
   the evidence for a Budget Impact Analysis.
7. If the supplied result has insufficient information,
   explicitly say that the available information is limited.
8. Do not recommend changing BIA assumptions.
9. Do not create BIA model inputs.
10. Return valid JSON only.
11. Return exactly one insight for every supplied result.
12. Preserve the original result index.

Return exactly this JSON structure:

{
  "insights": [
    {
      "index": 1,
      "insight": "150-400 character insight"
    }
  ]
}

SUPPLIED SEARCH RESULTS:

${resultText.join("\n")}
`.trim();

    const service = getLlmService(model);
    const rawResponse = await service.generate(prompt);
    const parsed = JSON.parse(cleanJsonResponse(rawResponse));

    const insights = (parsed.insights || []).map((item) => ({
      index: Number(item.index),
      insight: String(item.insight || "").trim(),
    }));

    return res.json({
      insights,
    });
  } catch (error) {
    return next(error);
  }
});

llmRouter.post("/summarize-evidence", async (req, res, next) => {
  try {
    const { evidence, model = null } = req.body || {};

    if (!Array.isArray(evidence) || evidence.length < 1 || evidence.length > 25) {
      return res.status(400).json({
        error: "evidence must contain between 1 and 25 items.",
      });
    }

    const evidenceText = evidence.map((item, index) => `
EVIDENCE ${index + 1}
Source: ${item.source}
Source ID: ${item.source_id || "Not provided"}
Year: ${item.year || "Not provided"}
Title: ${item.title}
Authors: ${
  Array.isArray(item.authors) && item.authors.length
    ? item.authors.join(", ")
    : "Not provided"
}
Evidence type: ${item.evidence_type || "Not provided"}
DOI: ${item.doi || "Not provided"}
URL: ${item.url || "Not provided"}
Relevance score: ${
  item.relevance !== undefined && item.relevance !== null
    ? item.relevance
    : "Not provided"
}
Abstract/content:
${item.abstract || "No abstract/content provided"}
`.trim());

    const prompt = `
You are the evidence-synthesis assistant inside a pharmaceutical
Budget Impact Analysis tool called EviTrack.

Your task is to summarize ONLY the evidence records supplied below.

STRICT RULES:
1. Do not invent facts, numbers, studies, sources, or conclusions.
2. Do not use outside knowledge.
3. Every factual claim must be supported by one or more supplied
   evidence records.
4. Preserve important numerical values exactly as supplied.
5. Clearly distinguish reported evidence from interpretation.
6. If evidence conflicts, explicitly state that the evidence is
   conflicting and identify the relevant sources.
7. If the supplied evidence is insufficient to answer something,
   explicitly say that it is insufficient.
8. Do not convert evidence into BIA model inputs.
9. Do not recommend changing any BIA assumption or calculation.
10. This is an evidence-supporting summary only; it does not modify
    the deterministic BIA engine.

Return the answer using exactly these sections:

## Evidence Summary
A concise synthesis of the supplied evidence.

## Key Findings
- Important findings supported by the supplied records.

## Evidence Differences or Conflicts
- Describe meaningful differences, disagreements, or limitations.
- If none are apparent, say "No clear conflicts identified in the supplied evidence."

## BIA Relevance
Explain which types of BIA inputs the evidence could potentially inform,
without assigning values or changing the BIA model.

## Sources
List each supplied source using its source name, source ID, year, and URL
when available.

SUPPLIED EVIDENCE:
${evidenceText.join("\n")}
`.trim();

    const service = getLlmService(model);
    const summary = await service.generate(prompt);

    return res.json({
      summary,
    });
  } catch (error) {
    return next(error);
  }
});
