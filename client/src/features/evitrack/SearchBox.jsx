import { useState } from "react";

export const MODELS = [
  { value: "gemini-3.6-flash", label: "Gemini 3.6 Flash", provider: "gemini" },
  { value: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash-Lite", provider: "gemini" },
  { value: "openai/gpt-oss-120b", label: "Groq — GPT-OSS 120B", provider: "groq" },
];

/** Human label for a model id — raw ids like "openai/gpt-oss-120b" read badly
 *  as headings and placeholder text. */
export function modelLabel(value) {
  return MODELS.find((m) => m.value === value)?.label || value || "AI";
}

export default function SearchBox({
  onSearch,
  selectedModel,
  onModelChange,
  provider = null,
  llmKnown = false,
  searching = false,
}) {
  const [query, setQuery] = useState("");

  // Only offer models this deployment holds a key for. Listing all three and
  // failing on the two that cannot run is a confusing way to present a choice.
  const options = provider
    ? MODELS.filter((m) => m.provider === provider)
    : llmKnown
      ? []          // server answered: no key configured, so no model can run
      : MODELS;     // status not back yet, do not flicker the list

  const submit = () => {
    const value = query.trim();
    if (value) onSearch(value);
  };

  return (
    <div className="evitrack-search">
      <label htmlFor="evitrack-ai-model">AI model</label>

      <select
        id="evitrack-ai-model"
        value={selectedModel}
        onChange={(event) => onModelChange(event.target.value)}
        disabled={options.length === 0}
        title={
          options.length === 0
            ? "No LLM key is configured on this server"
            : "Model used for evidence insights"
        }
      >
        {options.length === 0 ? (
          <option value="">Not configured</option>
        ) : (
          options.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))
        )}
      </select>

      <input
        type="search"
        value={query}
        aria-label="Search external evidence"
        placeholder="Search evidence — prevalence, population, costs, efficacy…"
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") submit();
        }}
      />

      <button
        type="button"
        className="btn primary"
        onClick={submit}
        disabled={searching || query.trim() === ""}
      >
        {searching ? "Searching…" : "Search"}
      </button>
    </div>
  );
}
