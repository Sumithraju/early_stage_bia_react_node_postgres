export default function SearchBox({
  onSearch,
  selectedModel,
  onModelChange,
}) {
  const handleSearch = (value) => {
    onSearch(value.trim());
  };

  return (
    <div className="evitrack-search">
      <label htmlFor="evitrack-ai-model">
        AI model:
      </label>

      <select
        id="evitrack-ai-model"
        value={selectedModel}
        onChange={(event) => onModelChange(event.target.value)}
      >
        <option value="gemini-3.6-flash">
          Gemini 3.6 Flash
        </option>

        <option value="gemini-3.5-flash-lite">
          Gemini 3.5 Flash-Lite
        </option>

        <option value="openai/gpt-oss-120b">
          Groq — GPT-OSS 120B
        </option>
      </select>

      <input
        type="search"
        placeholder="Search for prevalence, population, costs, efficacy..."
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            handleSearch(event.currentTarget.value);
          }
        }}
      />

      <button
        type="button"
        className="btn"
        onClick={(event) => {
          const input = event.currentTarget
            .previousElementSibling;

          handleSearch(input?.value ?? "");
        }}
      >
        Search
      </button>
    </div>
  );
}
