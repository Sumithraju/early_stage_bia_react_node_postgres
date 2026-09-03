export class EvidenceSource {
  constructor(name) {
    this.name = name;
  }

  async search(query, options = {}) {
    throw new Error(`${this.name} source must implement search().`);
  }
}
