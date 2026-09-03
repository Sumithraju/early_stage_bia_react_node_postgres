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

  // Try the configured model first (if any), then the provider's known-good
  // candidates. Model names get retired, so this self-heals across the list.
  const candidates = [
    ...(process.env.LLM_MODEL ? [process.env.LLM_MODEL] : []),
    ...provider.models,
  ].filter((m, i, a) => a.indexOf(m) === i);

  try {
    let last = null;
    for (const model of candidates) {
      const r = await call(model);
      if (r.ok) {
        const reply = JSON.parse(r.text).choices?.[0]?.message?.content?.trim();
        if (reply) return res.json({ reply, provider: providerName, model });
        last = { status: 502, text: "Empty response from the LLM." };
        continue;
      }
      last = r;
      // Only keep trying other models when the failure is a model problem;
      // auth / rate-limit errors will fail identically for every model.
      const modelIssue = r.status === 404 || /model|not found|decommission|does not exist/i.test(r.text);
      if (!modelIssue) break;
    }

    let detail = (last?.text || "").slice(0, 300);
    try { detail = JSON.parse(last.text).error?.message || detail; } catch {}
    return res.status(502).json({
      error: `Upstream LLM error (${last?.status ?? "?"})`,
      detail,
      triedModels: candidates,
    });
  } catch (error) {
    next(error);
  }
});
