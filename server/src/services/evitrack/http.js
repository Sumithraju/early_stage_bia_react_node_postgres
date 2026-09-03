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

export async function evitrackGet(url, config = {}) {
  const proxy = getProxyConfig();

  return axios.get(url, {
    ...config,
    proxy,
  });
}
