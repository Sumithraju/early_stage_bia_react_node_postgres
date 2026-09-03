import { PubMedSource } from "./pubmed.js";
import { ClinicalTrialsSource } from "./clinicaltrials.js";
import { WorldBankSource } from "./worldbank.js";
import { WhoGhoSource } from "./who_gho.js";
import { OpenFdaSource } from "./openfda.js";

export class EvidenceSourceRegistry {
  constructor() {
    this.sources = new Map();

    this.register(new PubMedSource(), "pubmed");
    this.register(new ClinicalTrialsSource(), "clinicaltrials");
    this.register(new WorldBankSource(), "worldbank");
    this.register(new WhoGhoSource(), "who");
    this.register(new OpenFdaSource(), "openfda");
  }

  register(source, key = source.name) {
    const normalizedKey = String(key).trim().toLowerCase();

    if (!normalizedKey) {
      throw new Error("Evidence source key cannot be empty.");
    }

    if (this.sources.has(normalizedKey)) {
      throw new Error(
        `Evidence source already registered: ${normalizedKey}`
      );
    }

    this.sources.set(normalizedKey, source);
  }

  get(key) {
    const normalizedKey = String(key).trim().toLowerCase();

    const source = this.sources.get(normalizedKey);

    if (!source) {
      throw new Error(`Unknown evidence source: ${key}`);
    }

    return source;
  }

  list() {
    return [...this.sources.keys()].sort();
  }
}

export const evidenceSourceRegistry = new EvidenceSourceRegistry();
