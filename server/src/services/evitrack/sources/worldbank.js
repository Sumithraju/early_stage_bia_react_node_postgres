import { evitrackGet } from "../http.js";
import { EvidenceSource } from "./base.js";
import { createEvidenceResult } from "../evidence.js";

const BASE_URL = "https://api.worldbank.org/v2/indicator";

export class WorldBankSource extends EvidenceSource {
  constructor() {
    super("WorldBank");
  }

  async search(query, { limit = 10 } = {}) {
    const normalizedQuery = query?.trim().toLowerCase();

    if (!normalizedQuery) return [];

    const matches = [];
    let page = 1;

    while (matches.length < limit) {
      const response = await evitrackGet(BASE_URL, {
        params: {
          format: "json",
          per_page: 1000,
          page,
        },
        timeout: 20000,
      });

      const payload = response.data;

      if (!Array.isArray(payload) || !payload[1]) {
        break;
      }

      for (const indicator of payload[1]) {
        const name = indicator?.name || "";

        if (name.toLowerCase().includes(normalizedQuery)) {
          matches.push(indicator);

          if (matches.length >= limit) {
            break;
          }
        }
      }

      const totalPages = Number(payload[0]?.pages || page);

      if (page >= totalPages) {
        break;
      }

      page += 1;
    }

    return matches.map((indicator) =>
      createEvidenceResult({
        title: `${indicator.name} — World Bank indicator`,
        source: "WorldBank",
        source_id: indicator.id || null,
        year: null,
        authors: [],
        abstract: null,
        doi: null,
        url: `https://data.worldbank.org/indicator/${indicator.id}`,
        evidence_type: "economic_indicator",
        relevance: null,
      })
    );
  }
}
