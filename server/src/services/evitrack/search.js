import { evidenceSourceRegistry } from "./sources/registry.js";

const ALL_SOURCES = [
  "pubmed",
  "clinicaltrials",
  "worldbank",
  "who",
  "openfda",
];

export async function searchEvidence({
  query,
  source = "all",
  limit = 10,
  country = "IND",
}) {
  const normalizedQuery = query?.trim();

  if (!normalizedQuery) {
    return [];
  }

  const normalizedSource = String(source).trim().toLowerCase();

  if (normalizedSource === "all") {
    const searches = ALL_SOURCES.map(async (sourceKey) => {
      const sourceAdapter = evidenceSourceRegistry.get(sourceKey);

      return sourceAdapter.search(normalizedQuery, {
        limit,
        country,
      });
    });

    const settled = await Promise.allSettled(searches);

    const results = settled.flatMap((result) =>
      result.status === "fulfilled" ? result.value : []
    );

    return results.slice(0, limit);
  }

  const sourceAdapter = evidenceSourceRegistry.get(normalizedSource);

  return sourceAdapter.search(normalizedQuery, {
    limit,
    country,
  });
}
