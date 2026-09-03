import { useState } from "react";

export default function SearchResults({
  results,
  selectedIds = [],
  onAdd,
  selectedModel,
}) {
  const [explanations, setExplanations] = useState({});
  const [loadingIds, setLoadingIds] = useState({});
  const [errorIds, setErrorIds] = useState({});

  async function handleExplain(result, resultKey) {
    setLoadingIds((current) => ({
      ...current,
      [resultKey]: true,
    }));

    setErrorIds((current) => {
      const next = { ...current };
      delete next[resultKey];
      return next;
    });

    try {
      const response = await fetch("/api/v1/llm/search-insights", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          results: [
            {
              index: 1,
              title: result.title,
              source: result.source,
              source_id: result.source_id,
              year: result.year,
              abstract: result.abstract,
            },
          ],
          model: selectedModel,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || `AI explanation failed (${response.status})`,
        );
      }

      const insight = data.insights?.[0]?.insight;

      if (!insight) {
        throw new Error("AI did not return an explanation.");
      }

      setExplanations((current) => ({
        ...current,
        [resultKey]: insight,
      }));
    } catch (err) {
      setErrorIds((current) => ({
        ...current,
        [resultKey]:
          err instanceof Error
            ? err.message
            : "Unable to generate explanation.",
      }));
    } finally {
      setLoadingIds((current) => ({
        ...current,
        [resultKey]: false,
      }));
    }
  }

  return (
    <section className="evitrack-section">
      <h3>External evidence</h3>

      {results.length === 0 ? (
        <p>No external evidence found.</p>
      ) : (
        results.map((result) => {
          const resultKey =
            `${result.source}-${result.source_id ?? result.title}`;

          const selected =
            result.source_id !== null &&
            selectedIds.includes(result.source_id);

          const isExplaining = loadingIds[resultKey] === true;
          const explanation = explanations[resultKey];
          const explanationError = errorIds[resultKey];

          return (
            <article key={resultKey} className="evitrack-result">
              <div className="evitrack-result-header">
                <span className="evitrack-source">{result.source}</span>

                {result.year !== null && (
                  <span className="evitrack-year">{result.year}</span>
                )}
              </div>

              <h4>{result.title}</h4>

              {result.authors.length > 0 && (
                <p className="evitrack-authors">
                  {result.authors.slice(0, 5).join(", ")}
                  {result.authors.length > 5 && " et al."}
                </p>
              )}

              <p className="evitrack-type">
                {result.evidence_type.replaceAll("_", " ")}
              </p>

              {result.doi !== null && (
                <p className="evitrack-doi">DOI: {result.doi}</p>
              )}

              {result.relevance !== null && (
                <small>
                  Search relevance: {result.relevance.toFixed(2)}
                </small>
              )}

              <div className="evitrack-actions">
                <a
                  href={result.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="evitrack-button"
                >
                  Open source
                </a>

                <button
                  type="button"
                  onClick={() => handleExplain(result, resultKey)}
                  disabled={isExplaining}
                  className="evitrack-button"
                >
                  {isExplaining ? "Explaining..." : "Explain"}
                </button>

                {onAdd !== undefined && result.source_id !== null && (
                  <button
                    type="button"
                    onClick={() => onAdd(result)}
                    disabled={selected}
                    className="evitrack-button"
                  >
                    {selected ? "Added" : "Add evidence"}
                  </button>
                )}
              </div>

              {explanation && (
                <div className="evitrack-explanation">
                  <strong>{selectedModel} explanation</strong>
                  <p>{explanation}</p>
                </div>
              )}

              {explanationError && (
                <p className="evitrack-explanation-error" role="alert">
                  {selectedModel} explanation unavailable: {explanationError}
                </p>
              )}
            </article>
          );
        })
      )}
    </section>
  );
}
