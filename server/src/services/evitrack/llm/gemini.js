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

export class GeminiService {
  static ALLOWED_MODELS = new Set([
    "gemini-3.6-flash",
    "gemini-3.5-flash-lite",
  ]);

  constructor(model = null) {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    const selectedModel =
      model ||
      process.env.GEMINI_MODEL ||
      "gemini-3.6-flash";

    if (!GeminiService.ALLOWED_MODELS.has(selectedModel)) {
      throw new Error(
        `Unsupported Gemini model: ${selectedModel}. ` +
        `Allowed models: ${[...GeminiService.ALLOWED_MODELS].join(", ")}`
      );
    }

    this.apiKey = apiKey;
    this.model = selectedModel;
  }

  async generate(prompt) {
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/` +
      `${this.model}:generateContent`;

    const response = await axios.post(
      url,
      {
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
      },
      {
        proxy: getProxyConfig(),
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": this.apiKey,
        },
        timeout: 90000,
      }
    );

    return (
      response.data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      ""
    );
  }
}
