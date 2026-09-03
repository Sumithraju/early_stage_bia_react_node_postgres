import { evitrackGet } from "../http.js";
import { EvidenceSource } from "./base.js";
import { createEvidenceResult } from "../evidence.js";

const BASE_URL = "https://api.fda.gov/drug/drugsfda.json";

export class OpenFdaSource extends EvidenceSource {
  constructor() {
    super("openFDA");
  }

  async search(query, { limit = 10 } = {}) {
    if (!query?.trim()) {
      return [];
    }

    const response = await evitrackGet(BASE_URL, {
      params: {
        search: `products.brand_name:"${query.trim()}"`,
        limit,
      },
      timeout: 20000,
      validateStatus: (status) => status === 200 || status === 404,
    });

    if (response.status === 404) {
      return [];
    }

    const records = response.data?.results || [];

    return records.map((record) => {
      const applicationNumber =
        record?.application_number || null;

      const sponsor =
        record?.sponsor_name || "";

      const brands = Array.isArray(record?.products)
        ? record.products
            .map((product) => product?.brand_name)
            .filter(Boolean)
        : [];

      const uniqueBrands = [...new Set(brands)];

      const brandText = uniqueBrands.join(", ");

      let title = brandText
        ? `${brandText} — FDA drug approval`
        : "FDA drug approval record";

      if (sponsor) {
        title += ` (${sponsor})`;
      }

      if (!applicationNumber) {
        title = "FDA drug approval record";
      }

      return createEvidenceResult({
        title,
        source: "openFDA",
        source_id: applicationNumber,
        year: null,
        authors: [],
        abstract: null,
        doi: null,
        url: "https://www.accessdata.fda.gov/scripts/cder/daf/",
        evidence_type: "regulatory_record",
        relevance: null,
      });
    });
  }
}
