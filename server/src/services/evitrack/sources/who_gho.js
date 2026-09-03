import axios from "axios";
import { evitrackGet } from "../http.js";
import { EvidenceSource } from "./base.js";
import { createEvidenceResult } from "../evidence.js";

const BASE_URL = "https://ghoapi.azureedge.net/api";

let indicatorCatalogue = null;

function tokenize(query) {
  return query
    .toLowerCase()
    .split(/[\s,]+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function scoreIndicator(name, query) {
  const normalizedName = name.toLowerCase();
  const normalizedQuery = query.toLowerCase();

  let score = 0;

  const usefulTerms = [
    "prevalence",
    "incidence",
    "mortality",
    "consumption",
    "rate",
    "coverage",
    "number of",
    "mean",
  ];

  const projectionTerms = [
    "projection",
    "projected",
    "forecast",
    "forecasting",
    "projections to",
    "projected estimates",
  ];

  for (const term of usefulTerms) {
    if (normalizedName.includes(term)) {
      score += 10;
    }
  }

  for (const term of projectionTerms) {
    if (normalizedName.includes(term)) {
      score += 8;
    }
  }

  if (
    normalizedName.includes("estimate") ||
    normalizedName.includes("estimated") ||
    normalizedName.includes("model-based")
  ) {
    score += 6;
  }

  if (normalizedName.includes(normalizedQuery)) {
    score += 20;
  }

  if (normalizedName.includes("adult")) {
    score += 5;
  }

  return score;
}

function isObesityPrevalenceMatch(query, indicator) {
  const normalizedQuery = query.toLowerCase();
  const normalizedName = String(indicator?.IndicatorName || "").toLowerCase();

  const obesity =
    normalizedQuery.includes("obesity") ||
    normalizedQuery.includes("bmi");

  const prevalence =
    normalizedQuery.includes("prevalence") ||
    normalizedQuery.includes("prevalent");

  if (!obesity || !prevalence) {
    return false;
  }

  return (
    indicator?.IndicatorCode === "NCD_BMI_30A" ||
    indicator?.IndicatorCode === "NCD_BMI_30C" ||
    (
      normalizedName.includes("obesity among adults") &&
      normalizedName.includes("bmi")
    )
  );
}

async function getIndicatorCatalogue() {
  if (indicatorCatalogue) {
    return indicatorCatalogue;
  }

  const response = await evitrackGet(`${BASE_URL}/Indicator`, {
    timeout: 15000,
  });

  indicatorCatalogue = Array.isArray(response.data?.value)
    ? response.data.value
    : [];

  return indicatorCatalogue;
}

function extractLatestYear(rows) {
  const years = rows
    .map((row) => Number(row?.TimeDim))
    .filter((year) => Number.isFinite(year));

  if (!years.length) {
    return null;
  }

  return Math.max(...years);
}

function getCountryRows(rows, country) {
  if (!country) {
    return rows;
  }

  const normalizedCountry = country.toUpperCase();

  return rows.filter(
    (row) =>
      String(row?.SpatialDim || "").toUpperCase() === normalizedCountry &&
      String(row?.SpatialDimType || "").toUpperCase() === "COUNTRY"
  );
}

function buildDetails(indicator, row) {
  const details = [
    `Indicator: ${indicator?.IndicatorName || ""}`,
    `Location: ${row?.SpatialDim || ""}`,
    `Location type: ${row?.SpatialDimType || ""}`,
    `Year: ${row?.TimeDim || ""}`,
    `Numeric value: ${row?.NumericValue ?? ""}`,
    `Reported value: ${row?.Value || ""}`,
  ];

  if (row?.Low) {
    details.push(`Lower uncertainty bound: ${row.Low}`);
  }

  if (row?.High) {
    details.push(`Upper uncertainty bound: ${row.High}`);
  }

  if (row?.DataSource) {
    details.push(`Data source: ${row.DataSource}`);
  }

  if (row?.Date) {
    details.push(`WHO record date: ${row.Date}`);
  }

  return details.filter((item) => !item.endsWith(": ")).join("; ");
}

export class WhoGhoSource extends EvidenceSource {
  constructor() {
    super("WHO GHO");
  }

  async search(query, { limit = 10, country = "IND" } = {}) {
    if (!query?.trim()) {
      return [];
    }

    const normalizedQuery = query.trim();
    const tokens = tokenize(normalizedQuery);

    const catalogue = await getIndicatorCatalogue();

    const candidates = catalogue.filter((indicator) => {
      const name = String(indicator?.IndicatorName || "").toLowerCase();

      const tokenMatch = tokens.every((token) => name.includes(token));

      return (
        tokenMatch ||
        isObesityPrevalenceMatch(normalizedQuery, indicator)
      );
    });

    candidates.sort((a, b) => {
      const scoreA = scoreIndicator(
        String(a?.IndicatorName || ""),
        normalizedQuery
      );

      const scoreB = scoreIndicator(
        String(b?.IndicatorName || ""),
        normalizedQuery
      );

      if (scoreB !== scoreA) {
        return scoreB - scoreA;
      }

      return String(a?.IndicatorName || "").localeCompare(
        String(b?.IndicatorName || "")
      );
    });

    const results = [];

    for (const indicator of candidates.slice(0, limit)) {
      const indicatorId = indicator?.IndicatorCode;

      if (!indicatorId) {
        continue;
      }

      try {
        const response = await evitrackGet(
          `${BASE_URL}/${encodeURIComponent(indicatorId)}`,
          {
            params: {
              "$top": 1000,
            },
            timeout: 20000,
          }
        );

        const rows = Array.isArray(response.data?.value)
          ? response.data.value
          : [];

        if (!rows.length) {
          continue;
        }

        const countryRows = getCountryRows(rows, country);

        if (country && !countryRows.length) {
          continue;
        }

        const usableRows = country ? countryRows : rows;
        const latestYear = extractLatestYear(usableRows);

        if (latestYear === null) {
          continue;
        }

        const latestRows = usableRows.filter(
          (row) => Number(row?.TimeDim) === latestYear
        );

        const row = latestRows[0];

        if (!row) {
          continue;
        }

        const indicatorName = String(
          indicator?.IndicatorName || indicatorId
        );

        const lowerName = indicatorName.toLowerCase();

        const isProjection =
          lowerName.includes("projection") ||
          lowerName.includes("projected") ||
          lowerName.includes("forecast") ||
          lowerName.includes("forecasting") ||
          lowerName.includes("projections to") ||
          lowerName.includes("projected estimates");

        results.push(
          createEvidenceResult({
            title: `${indicatorName} — WHO Global Health Observatory`,
            source: "WHO GHO",
            source_id: indicatorId,
            year: latestYear,
            authors: [],
            abstract: buildDetails(indicator, row),
            doi: null,
            url: `${BASE_URL}/${encodeURIComponent(indicatorId)}`,
            evidence_type: isProjection
              ? "epidemiology_projection"
              : "epidemiology_indicator",
            relevance: null,
          })
        );
      } catch (error) {
        if (axios.isAxiosError(error)) {
          continue;
        }

        continue;
      }
    }

    return results;
  }
}
