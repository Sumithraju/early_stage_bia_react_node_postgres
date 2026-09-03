import { evitrackGet } from "../http.js";
import { EvidenceSource } from "./base.js";
import { createEvidenceResult } from "../evidence.js";

const BASE_URL = "https://clinicaltrials.gov/api/v2/studies";

function extractYear(value) {
  if (!value) return null;

  const match = String(value).match(/\b(\d{4})\b/);
  return match ? Number(match[1]) : null;
}

export class ClinicalTrialsSource extends EvidenceSource {
  constructor() {
    super("ClinicalTrials.gov");
  }

  async search(query, { limit = 10 } = {}) {
    if (!query?.trim()) return [];

    const response = await evitrackGet(BASE_URL, {
      params: {
        "query.term": query.trim(),
        pageSize: limit,
        format: "json",
      },
      timeout: 20000,
    });

    const studies = response.data?.studies || [];

    return studies.map((study) => {
      const protocol = study?.protocolSection || {};
      const identification = protocol?.identificationModule || {};
      const status = protocol?.statusModule || {};

      const nctId = identification?.nctId || null;
      const title =
        identification?.briefTitle ||
        identification?.officialTitle ||
        "Untitled clinical trial";

      return createEvidenceResult({
        title,
        source: "ClinicalTrials.gov",
        source_id: nctId,
        year: extractYear(status?.startDateStruct?.date),
        authors: [],
        abstract: null,
        doi: null,
        url: nctId
          ? `https://clinicaltrials.gov/study/${nctId}`
          : "https://clinicaltrials.gov/",
        evidence_type: "clinical_trial",
        relevance: null,
      });
    });
  }
}
