/**
 * EviTrack was written with its own GEMINI_API_KEY / GROQ_API_KEY variables,
 * while the assistant uses LLM_API_KEY + LLM_PROVIDER. Requiring the operator
 * to set the same key twice under two names is a needless way to break a
 * deployment, so a provider-specific key wins if present and otherwise we fall
 * back to the shared key when LLM_PROVIDER names that provider.
 */
export function resolveKey(provider) {
  const specific = process.env[`${provider.toUpperCase()}_API_KEY`];
  if (specific) return specific;

  const shared = process.env.LLM_API_KEY;
  const sharedProvider = (process.env.LLM_PROVIDER || "groq").toLowerCase();
  return shared && sharedProvider === provider ? shared : null;
}

/** Which LLM provider this deployment can actually reach, if any. */
export function availableProvider() {
  if (resolveKey("groq")) return "groq";
  if (resolveKey("gemini")) return "gemini";
  return null;
}
