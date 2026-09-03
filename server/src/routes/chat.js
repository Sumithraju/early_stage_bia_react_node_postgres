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
    model: "llama-3.3-70b-versatile",
  },
  openrouter: {
    url: "https://openrouter.ai/api/v1/chat/completions",
    model: "meta-llama/llama-3.3-70b-instruct:free",
  },
  huggingface: {
    url: "https://router.huggingface.co/v1/chat/completions",
    model: "meta-llama/Llama-3.1-8B-Instruct",
  },
  xai: {
    url: "https://api.x.ai/v1/chat/completions",
    model: "grok-2-latest",
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

  try {
    const upstream = await fetch(provider.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
        // OpenRouter asks callers to identify themselves; harmless elsewhere.
        "HTTP-Referer": process.env.PUBLIC_URL || "https://early-stage-bia.onrender.com",
        "X-Title": "BIET",
      },
      body: JSON.stringify({
        model: process.env.LLM_MODEL || provider.model,
        messages,
        temperature: 0.3,
        max_tokens: 500,
      }),
    });

    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => "");
      return res.status(502).json({
        error: `Upstream LLM error (${upstream.status}).`,
        detail: detail.slice(0, 300),
      });
    }

    const data = await upstream.json();
    const reply = data.choices?.[0]?.message?.content?.trim();
    if (!reply) return res.status(502).json({ error: "Empty response from the LLM." });

    res.json({ reply, provider: providerName });
  } catch (error) {
    next(error);
  }
});
