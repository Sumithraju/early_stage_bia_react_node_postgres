import axios from "axios";

function getProxyConfig() {
  const proxyUrl =
    process.env.HTTPS_PROXY ||
    process.env.HTTP_PROXY ||
    process.env.https_proxy ||
    process.env.http_proxy;

  if (!proxyUrl) {
    return undefined;
  }

  const parsed = new URL(proxyUrl);

  return {
    protocol: parsed.protocol.replace(":", ""),
    host: parsed.hostname,
    port: Number(parsed.port),
    auth:
      parsed.username || parsed.password
        ? {
            username: decodeURIComponent(parsed.username),
            password: decodeURIComponent(parsed.password),
          }
        : undefined,
  };
}

export class GroqService {
  static ALLOWED_MODELS = new Set([
    "openai/gpt-oss-120b",
  ]);

  constructor(model = null) {
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      throw new Error("GROQ_API_KEY is not configured");
    }

    const selectedModel =
      model ||
      process.env.GROQ_MODEL ||
      "openai/gpt-oss-120b";

    if (!GroqService.ALLOWED_MODELS.has(selectedModel)) {
      throw new Error(
        `Unsupported Groq model: ${selectedModel}. ` +
        `Allowed models: ${[...GroqService.ALLOWED_MODELS].join(", ")}`
      );
    }

    this.apiKey = apiKey;
    this.model = selectedModel;
  }

  async generate(prompt) {
    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: this.model,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        max_tokens: 1000,
      },
      {
        proxy: getProxyConfig(),
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        timeout: 90000,
      }
    );

    return (
      response.data?.choices?.[0]?.message?.content ||
      ""
    );
  }
}
