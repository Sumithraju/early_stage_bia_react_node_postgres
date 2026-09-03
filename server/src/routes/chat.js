import express from "express";

/**
 * LLM proxy for the assistant. The browser cannot call Groq / HuggingFace / xAI
 * directly (CORS, and it would expose the key in page source), so the key lives
 * on the server as an env var and this route forwards the request. All the
 * supported providers speak the OpenAI-compatible /chat/completions shape, so
 * one forwarder covers them.
 *
 * Configure on the host (e.g. Render env vars):
 *   LLM_API_KEY   - your free key from the chosen provider (required to enable)
 *   LLM_PROVIDER  - groq | openrouter | huggingface | xai   (default: groq)
 *   LLM_MODEL     - optional model override
 *
 * With no LLM_API_KEY the route returns 503 and the client falls back to its
 * built-in local answers, so the app still works with nothing configured.
 */
const PROVIDERS = {
  groq: {
    url: "https://api.groq.com/openai/v1/chat/completions",
    models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "llama3-8b-8192"],
  },
  openrouter: {
    url: "https://openrouter.ai/api/v1/chat/completions",
    models: [
      "meta-llama/llama-3.3-70b-instruct:free",
      "meta-llama/llama-3.1-8b-instruct:free",
      "qwen/qwen-2.5-7b-instruct:free",
    ],
  },
  huggingface: {
    url: "https://router.huggingface.co/v1/chat/completions",
    models: ["meta-llama/Llama-3.1-8B-Instruct", "Qwen/Qwen2.5-7B-Instruct"],
  },
  xai: {
    url: "https://api.x.ai/v1/chat/completions",
    models: ["grok-2-latest", "grok-beta"],
  },
};

export function llmConfigured() {
  return Boolean(process.env.LLM_API_KEY);
}

export function llmProviderName() {
  return (process.env.LLM_PROVIDER || "groq").toLowerCase();
}

// Discovered models are cached per provider so we hit /models at most once,
// and the model that actually answered is remembered so repeat calls are a
// single round-trip. Both are cleared when a request fails to get any reply.
const discoveredCache = {};
const workingModel = {};

/**
 * Ask the provider which chat models this account actually has, so we never
 * depend on hardcoded names that providers retire. Filters out non-chat models
 * (speech, embeddings, guards, vision-only) and prefers instruction-tuned LLMs.
 */
async function discoverModels(providerName, provider, key) {
  if (discoveredCache[providerName]) return discoveredCache[providerName];
  const url = provider.url.replace("/chat/completions", "/models");
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${key}` } });
    if (!res.ok) return [];
    const data = await res.json();
    const ids = (data.data || data.models || [])
      .map((m) => m.id || m.name)
      .filter(Boolean)
      .filter((id) => !/whisper|tts|embed|guard|vision|moderation|rerank/i.test(id));
    // Prefer well-known instruction-tuned families, largest first-ish.
    const score = (id) =>
      (/llama|qwen|gemma|mixtral|mistral|deepseek/i.test(id) ? 2 : 0) +
      (/70b|72b|-large|versatile/i.test(id) ? 1 : 0);
    ids.sort((a, b) => score(b) - score(a));
    discoveredCache[providerName] = ids;
    return ids;
  } catch {
    return [];
  }
}

export const chatRouter = express.Router();

chatRouter.get("/status", (req, res) => {
  res.json({
    configured: llmConfigured(),
    provider: llmConfigured() ? llmProviderName() : null,
  });
});

chatRouter.post("/", async (req, res, next) => {
  const key = process.env.LLM_API_KEY;
  if (!key) {
    return res.status(503).json({
      error: "LLM not configured. Set LLM_API_KEY on the server to enable AI answers.",
    });
  }

  const providerName = llmProviderName();
  const provider = PROVIDERS[providerName];
  if (!provider) {
    return res.status(400).json({ error: `Unknown LLM_PROVIDER "${providerName}".` });
  }

  const messages = Array.isArray(req.body?.messages) ? req.body.messages : null;
  if (!messages) {
    return res.status(400).json({ error: "messages[] is required." });
  }

  const call = async (model) => {
    const upstream = await fetch(provider.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
        // OpenRouter asks callers to identify themselves; harmless elsewhere.
        "HTTP-Referer": process.env.PUBLIC_URL || "https://early-stage-bia.onrender.com",
        "X-Title": "BIET",
      },
      body: JSON.stringify({ model, messages, temperature: 0.3, max_tokens: 500 }),
    });
    const text = await upstream.text();
    return { ok: upstream.ok, status: upstream.status, text };
  };

  const isModelIssue = (r) =>
    r.status === 404 || /model|not found|decommission|does not exist|deprecat/i.test(r.text);

  // Walks a list of model names, recording the last real upstream failure so the
  // error we surface is the provider's own message, not a generic one.
  const tryModels = async (models, state) => {
    for (const model of models) {
      if (!model || state.tried.includes(model)) continue;
      state.tried.push(model);
      const r = await call(model);
      if (r.ok) {
        const reply = JSON.parse(r.text).choices?.[0]?.message?.content?.trim();
        if (reply) return { reply, model };
        state.last = { status: 502, text: "Empty response from the LLM." };
        continue;
      }
      state.last = r;
      // Auth / quota errors fail identically for every model, so stop at once.
      if (!isModelIssue(r)) return { fail: r };
    }
    return null;
  };

  try {
    const state = { tried: [], last: null };

    // 1. An explicit LLM_MODEL wins, then whatever answered last time.
    let hit = await tryModels([process.env.LLM_MODEL, workingModel[providerName]], state);

    // 2. Ask the provider what this account can actually use. Providers retire
    //    model names without notice, so asking beats guessing.
    if (!hit) {
      const discovered = await discoverModels(providerName, provider, key);
      if (discovered.length) hit = await tryModels(discovered.slice(0, 4), state);
    }

    // 3. Last resort: the names we shipped with.
    if (!hit) hit = await tryModels(provider.models, state);

    if (hit?.reply) {
      workingModel[providerName] = hit.model;
      return res.json({ reply: hit.reply, provider: providerName, model: hit.model });
    }

    // Nothing worked: drop both caches so the next request rediscovers.
    delete workingModel[providerName];
    delete discoveredCache[providerName];

    const last = hit?.fail || state.last;
    let detail = (last?.text || "No usable chat model found for this account.").slice(0, 300);
    try { detail = JSON.parse(last.text).error?.message || detail; } catch {}
    return res.status(502).json({
      error: `Upstream LLM error (${last?.status ?? "?"})`,
      detail,
      triedModels: state.tried,
    });
  } catch (error) {
    next(error);
  }
});
