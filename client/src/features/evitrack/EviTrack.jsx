import { useState } from "react";
import SearchBox from "./SearchBox";
import SearchResults from "./SearchResults";
import EvidenceWorkspace from "./EvidenceWorkspace";
import { WHOChart } from "./WHOChart";
import "./styles.css";

export default function EviTrack() {
  const [results, setResults] = useState([]);

  const [selectedEvidence, setSelectedEvidence] =
    useState([]);

  const [selectedModel, setSelectedModel] =
    useState("gemini-3.6-flash");

  const [loading, setLoading] = useState(false);
  const [insightLoading, setInsightLoading] =
    useState(false);

  const [error, setError] =
    useState(null);

  const [insightError, setInsightError] =
    useState(null);

  async function generateSearchInsights(
    searchResults,
  ) {
    if (searchResults.length === 0) {
      return;
    }

    setInsightLoading(true);
    setInsightError(null);

    try {
      const response = await fetch(
        "/api/v1/llm/search-insights",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: selectedModel,
            results: searchResults.map(
              (result, index) => ({
                index: index + 1,
                title: result.title,
                source: result.source,
                source_id: result.source_id,
                year: result.year,
                abstract: result.abstract,
              }),
            ),
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail ||
            `${selectedModel} insights failed (${response.status})`,
        );
      }

      const insights =
        data.insights ?? [];

      const insightMap = new Map(
        insights.map((item) => [
          item.index,
          item.insight,
        ]),
      );

      setResults(
        searchResults.map((result, index) => ({
          ...result,
          aiInsight:
            insightMap.get(index + 1) ?? undefined,
        })),
      );
    } catch (err) {
      setInsightError(
        err instanceof Error
          ? err.message
          : "Unable to generate insights.",
      );
    } finally {
      setInsightLoading(false);
    }
  }

  async function handleSearch(query) {
    if (!query.trim()) {
      setResults([]);
      setInsightError(null);
      return;
    }

    setLoading(true);
    setInsightLoading(false);
    setError(null);
    setInsightError(null);

    try {
      const params = new URLSearchParams({
        q: query,
        source: "all",
        limit: "10",
      });

      const response = await fetch(
        `/api/v1/evitrack/search?${params.toString()}`,
      );

      if (!response.ok) {
        throw new Error(
          `Search failed (${response.status})`,
        );
      }

      const data = await response.json();
      const searchResults =
        data.results ?? [];

      setResults(searchResults);

      if (searchResults.length > 0) {
        void generateSearchInsights(
          searchResults,
        );
      }
    } catch (err) {
      setResults([]);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to search evidence.",
      );
    } finally {
      setLoading(false);
    }
  }

  function handleAddEvidence(
    result,
  ) {
    if (result.source_id === null) {
      return;
    }

    setSelectedEvidence((current) => {
      const alreadySelected = current.some(
        (item) =>
          item.source_id === result.source_id,
      );

      if (alreadySelected) {
        return current;
      }

      return [...current, result];
    });
  }

  function handleRemoveEvidence(
    sourceId,
  ) {
    setSelectedEvidence((current) =>
      current.filter(
        (item) => item.source_id !== sourceId,
      ),
    );
  }

  function handleClearEvidence() {
    setSelectedEvidence([]);
  }

  const selectedIds = selectedEvidence
    .map((result) => result.source_id)
    .filter(
      (id) => id !== null,
    );

  return (
    <section className="evitrack">
      <header className="evitrack-header">
        <div>
          <h2>EviTrack</h2>
          <p>
            Find, curate and manage external evidence
            for your BIA.
          </p>
        </div>

        {selectedEvidence.length > 0 && (
          <div className="evitrack-count">
            {selectedEvidence.length} selected
          </div>
        )}
      </header>

      <SearchBox
        onSearch={handleSearch}
        selectedModel={selectedModel}
        onModelChange={setSelectedModel}
      />

      {loading && (
        <p>Searching evidence...</p>
      )}

      {error && (
        <p role="alert">{error}</p>
      )}

      {!loading &&
        !error &&
        insightLoading &&
        results.length > 0 && (
          <p>
            {selectedModel} is generating key evidence
            insights...
          </p>
        )}

      {!loading &&
        !error &&
        insightError && (
          <p role="alert">
            {selectedModel} insights unavailable:{" "}
            {insightError}
          </p>
        )}

      {!loading &&
        !error &&
        results.some(
          (r) => r.source === "WHO GHO",
        ) && (
          <WHOChart
            results={results.filter(
              (r) => r.source === "WHO GHO",
            )}
          />
        )}

      {!loading && !error && (
        <SearchResults
          results={results}
          selectedIds={selectedIds}
          onAdd={handleAddEvidence}
          selectedModel={selectedModel}
        />
      )}

      <EvidenceWorkspace
        selectedEvidence={selectedEvidence}
        onRemove={handleRemoveEvidence}
        onClear={handleClearEvidence}
        selectedModel={selectedModel}
      />
    </section>
  );
}
