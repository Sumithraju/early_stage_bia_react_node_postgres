export function createEvidenceResult({
  title,
  source,
  source_id = null,
  year = null,
  authors = [],
  abstract = null,
  doi = null,
  url,
  evidence_type,
  relevance = null,
}) {
  return {
    title,
    source,
    source_id,
    year,
    authors,
    abstract,
    doi,
    url,
    evidence_type,
    relevance,
  };
}
