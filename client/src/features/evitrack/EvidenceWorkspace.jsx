import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { modelLabel } from "./SearchBox.jsx";

function buildEvidenceContext(
  evidence,
) {
  return evidence
    .map(
      (item, index) => `
EVIDENCE ${index + 1}
Source: ${item.source}
Source ID: ${item.source_id ?? "Not provided"}
Year: ${item.year ?? "Not provided"}
Title: ${item.title}
Authors: ${
        item.authors.length > 0
          ? item.authors.join(", ")
          : "Not provided"
      }
Evidence type: ${item.evidence_type ?? "Not provided"}
DOI: ${item.doi ?? "Not provided"}
URL: ${item.url ?? "Not provided"}
Relevance: ${
        item.relevance !== null
          ? item.relevance
          : "Not provided"
      }
Abstract/content:
${item.abstract ?? "No abstract/content provided"}
`,
    )
    .join("\n");
}

export default function EvidenceWorkspace({
  selectedEvidence,
  onRemove,
  onClear,
  selectedModel,
}) {
  const [summary, setSummary] = useState("");
  const [summaryLoading, setSummaryLoading] =
    useState(false);
  const [summaryError, setSummaryError] =
    useState("");

  const [question, setQuestion] = useState("");
  const [chatMessages, setChatMessages] =
    useState([]);
  const [chatLoading, setChatLoading] =
    useState(false);
  const [chatError, setChatError] = useState("");

  async function handleSummarize() {
    if (selectedEvidence.length === 0) return;

    setSummaryLoading(true);
    setSummaryError("");

    try {
      const response = await fetch(
        "/api/v1/llm/summarize-evidence",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            evidence: selectedEvidence,
            model: selectedModel,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail ||
            "Evidence summarization failed.",
        );
      }

      setSummary(data.summary ?? "");
    } catch (error) {
      setSummaryError(
        error instanceof Error
          ? error.message
          : "AI evidence summarization failed.",
      );
    } finally {
      setSummaryLoading(false);
    }
  }

  async function handleAskAI() {
    const trimmedQuestion = question.trim();

    if (
      !trimmedQuestion ||
      selectedEvidence.length === 0 ||
      chatLoading
    ) {
      return;
    }

    setChatLoading(true);
    setChatError("");

    setChatMessages((previous) => [
      ...previous,
      {
        role: "user",
        content: trimmedQuestion,
      },
    ]);

    setQuestion("");

    const evidenceContext =
      buildEvidenceContext(selectedEvidence);

    const prompt = `
You are the selected AI Evidence Assistant inside a pharmaceutical Budget Impact Analysis application.
a pharmaceutical Budget Impact Analysis tool.

Answer the user's question using ONLY the supplied
evidence records.

STRICT RULES:
1. Do not invent facts, numbers, studies, sources,
   or conclusions.
2. Do not use outside knowledge.
3. Every factual claim must be supported by the supplied
   evidence.
4. Preserve numerical values exactly as supplied.
5. Clearly distinguish reported evidence from interpretation.
6. If the evidence is insufficient, explicitly say so.
7. If evidence conflicts, identify the conflict.
8. Do not create or modify BIA model inputs.
9. Do not change deterministic BIA calculations.
10. Mention the relevant source when useful.

USER QUESTION:
${trimmedQuestion}

SUPPLIED EVIDENCE:
${evidenceContext}
`.trim();

    try {
      const response = await fetch(
        "/api/v1/llm/generate",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt,
            model: selectedModel,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail ||
            "AI assistant request failed.",
        );
      }

      setChatMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          content:
            data.response ||
            "AI assistant returned an empty response.",
        },
      ]);
    } catch (error) {
      setChatError(
        error instanceof Error
          ? error.message
          : "AI assistant request failed.",
      );
    } finally {
      setChatLoading(false);
    }
  }

  function handleClear() {
    onClear();
    setSummary("");
    setSummaryError("");
    setChatMessages([]);
    setChatError("");
    setQuestion("");
  }

  return (
    <section className="evitrack-section">
      <div className="evitrack-workspace-header">
        <div>
          <h3>Evidence workspace</h3>
          <p>
            Curate supporting evidence before using it
            in your analysis.
          </p>
        </div>

        {selectedEvidence.length > 0 && (
          <div
            style={{
              display: "flex",
              gap: "8px",
            }}
          >
            <button
              type="button"
              className="btn primary sm"
              onClick={handleSummarize}
              disabled={summaryLoading}
            >
              {summaryLoading
                ? "Summarizing..."
                :  "Summarise selected"}
            </button>

            <button
              type="button"
              className="btn sm"
              onClick={handleClear}
            >
              Clear all
            </button>
          </div>
        )}
      </div>

          <div
            style={{
              marginTop: "24px",
              paddingTop: "20px",
              borderTop:
                "1px solid var(--border)",
            }}
          >
            <div>
              <h4>
                Evidence assistant
                <span className="evitrack-model-tag">{modelLabel(selectedModel)}</span>
              </h4>

              <p>
                Ask questions about the selected
                evidence — answered using only the evidence
                records you have added above.
              </p>
            </div>

            {chatMessages.length > 0 && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                  marginBottom: "16px",
                }}
              >
                {chatMessages.map(
                  (message, index) => (
                    <div
                      key={`${message.role}-${index}`}
                      style={{
                        padding: "12px",
                        border:
                          "1px solid var(--border)",
                        borderRadius: "8px",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          marginBottom: "6px",
                          textTransform:
                            "uppercase",
                        }}
                      >
                        {message.role ===
                        "user"
                          ? "You"
                          : selectedModel}
                      </div>

                      {message.role ===
                      "assistant" ? (
                        <ReactMarkdown>
                          {message.content}
                        </ReactMarkdown>
                      ) : (
                        <div>
                          {message.content}
                        </div>
                      )}
                    </div>
                  ),
                )}
              </div>
            )}

            {chatError && (
              <div
                role="alert"
                style={{
                  marginBottom: "12px",
                  padding: "10px",
                  border:
                    "1px solid var(--border)",
                }}
              >
                {chatError}
              </div>
            )}

            {selectedEvidence.length === 0 && (
              <p className="evitrack-hint">
                Add at least one evidence record above
                before asking the AI assistant a question.
              </p>
            )}

            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                gap: "10px",
                alignItems: "flex-end",
              }}
            >
              <textarea
                value={question}
                onChange={(event) =>
                  setQuestion(event.target.value)
                }
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" &&
                    !event.shiftKey
                  ) {
                    event.preventDefault();
                    void handleAskAI();
                  }
                }}
                placeholder="Ask a question about the selected evidence…"
                rows={3}
                className="evitrack-ask-input"
              />

              <button
                type="button"
                className="btn primary"
                onClick={() =>
                  void handleAskAI()
                }
                disabled={
                  chatLoading ||
                  !question.trim() ||
                  selectedEvidence.length === 0
                }
              >
                {chatLoading
                  ? "Thinking..."
                  :  "Ask"}
              </button>
            </div>

            <p
              style={{
                marginTop: "8px",
                fontSize: "11px",
                color: "var(--ink-muted)",
              }}
            >
              The AI assistant does not modify BIA inputs or
              deterministic calculations.
            </p>
          </div>

      {selectedEvidence.length === 0 ? (
        <p>
          No evidence selected. Add relevant
          publications from the search results to build
          an evidence set for review.
        </p>
      ) : (
        <>
          <div
            style={{
              marginBottom: "20px",
              fontSize: "13px",
            }}
          >
            <strong>
              {selectedEvidence.length} evidence{" "}
              {selectedEvidence.length === 1
                ? "record"
                : "records"}{" "}
              selected
            </strong>
          </div>

          {selectedEvidence.map((item) => (
            <article
              key={item.source_id ?? item.title}
              style={{
                padding: "12px 0",
                borderTop:
                  "1px solid var(--border)",
              }}
            >
              <div>
                <strong>{item.title}</strong>
              </div>

              <div
                style={{
                  marginTop: "4px",
                  fontSize: "12px",
                }}
              >
                {item.source}
                {item.year
                  ? ` · ${item.year}`
                  : ""}
                {item.source_id
                  ? ` · ${item.source_id}`
                  : ""}
              </div>

              <button
                type="button"
                onClick={() =>
                  onRemove(
                    item.source_id ?? item.title,
                  )
                }
                style={{
                  marginTop: "8px",
                }}
              >
                Remove
              </button>
            </article>
          ))}

          {summaryError && (
            <div
              role="alert"
              style={{
                marginTop: "16px",
                padding: "12px",
                border:
                  "1px solid var(--border)",
              }}
            >
              {summaryError}
            </div>
          )}

          {summary && (
            <div
              style={{
                marginTop: "20px",
                paddingTop: "16px",
                borderTop:
                  "1px solid var(--border)",
              }}
            >
              <h4>
                Evidence summary
                <span className="evitrack-model-tag">{modelLabel(selectedModel)}</span>
              </h4>

              <div className="evitrack-summary-content">
                <ReactMarkdown>
                  {summary}
                </ReactMarkdown>
              </div>
            </div>
          )}


        </>
      )}
    </section>
  );
}
