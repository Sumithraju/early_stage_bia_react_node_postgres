import { evitrackGet } from "../http.js";
import { EvidenceSource } from "./base.js";
import { createEvidenceResult } from "../evidence.js";

const BASE_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";

async function requestWithRetry(url, params) {
  let lastError;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await evitrackGet(url, {
        params,
        timeout: 20000,
        validateStatus: (status) =>
          status === 200 ||
          status === 502 ||
          status === 503 ||
          status === 504,
        headers: {
          "User-Agent": "BIET-EviTrack/0.1",
        },
      });

      if (response.status === 200) {
        return response;
      }

      lastError = new Error(`PubMed returned HTTP ${response.status}.`);
    } catch (error) {
      lastError = error;
    }

    if (attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
    }
  }

  throw lastError;
}

function extractYear(value) {
  if (!value) return null;

  const match = String(value).match(/\b(\d{4})\b/);
  return match ? Number(match[1]) : null;
}

function extractDoi(articleIds = []) {
  const doiEntry = articleIds.find(
    (item) => item.idtype === "doi" && item.value
  );

  return doiEntry?.value || null;
}

export class PubMedSource extends EvidenceSource {
  constructor() {
    super("PubMed");
  }

  async search(query, { limit = 10 } = {}) {
    if (!query?.trim()) return [];

    const searchResponse = await requestWithRetry(
      `${BASE_URL}/esearch.fcgi`,
      {
        db: "pubmed",
        term: query.trim(),
        retmax: limit,
        retmode: "json",
        sort: "relevance",
      }
    );

    const ids = searchResponse.data?.esearchresult?.idlist || [];

    if (!ids.length) return [];

    const summaryResponse = await requestWithRetry(
      `${BASE_URL}/esummary.fcgi`,
      {
        db: "pubmed",
        id: ids.join(","),
        retmode: "json",
      }
    );

    const result = summaryResponse.data?.result || {};

    return ids
      .map((pmid, index) => {
        const article = result[pmid];

        if (!article) return null;

        const authors = Array.isArray(article.authors)
          ? article.authors
              .map((author) => author?.name)
              .filter(Boolean)
          : [];

        const doi = extractDoi(article.articleids);

        return createEvidenceResult({
          title: article.title || "Untitled PubMed record",
          source: "PubMed",
          source_id: pmid,
          year: extractYear(article.pubdate),
          authors,
          abstract: null,
          doi,
          url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
          evidence_type: "research_article",
          relevance: Math.max(
            0,
            1 - index / Math.max(ids.length, 1)
          ),
        });
      })
      .filter(Boolean);
  }
}
