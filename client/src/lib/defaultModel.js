import { defaultModelFor, subgroupsFor } from "./diseases.js";

/** Back-compat wrapper: obesity remains the opening model. */
export function getDefaultModel() {
  return defaultModelFor("OBESITY");
}

export const OBESITY_SUBGROUPS = subgroupsFor("OBESITY");
