const ORIGIN_PRIORITY = {
  USER_OVERRIDE: 400,
  COMPANY_INTERNAL: 390,
  VALIDATED_CURATED: 300,
  REGULATORY_SOURCE: 250,
  PEER_REVIEWED_LITERATURE: 240,
  PUBLIC_API: 200,
  PUBLIC_DATASET: 190,
  DEFAULT_ASSUMPTION: 100,
};

export function choosePreferredParameter(rows) {
  if (!rows?.length) return null;

  return [...rows].sort((a, b) => {
    const ap = ORIGIN_PRIORITY[a.data_origin] || 0;
    const bp = ORIGIN_PRIORITY[b.data_origin] || 0;
    if (bp !== ap) return bp - ap;

    const av = a.validation_status === "VERIFIED" ? 50 : 0;
    const bv = b.validation_status === "VERIFIED" ? 50 : 0;
    if (bv !== av) return bv - av;

    return new Date(b.retrieved_at || 0) - new Date(a.retrieved_at || 0);
  })[0];
}

export function resolveParameterMap(rows) {
  const groups = new Map();

  for (const row of rows || []) {
    const key = [
      row.parameter_name,
      row.subgroup_dimension || "",
      row.subgroup_value || "",
      row.scenario_id || "BASE",
    ].join("::");

    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }

  const result = {};
  for (const [key, list] of groups.entries()) {
    result[key] = choosePreferredParameter(list);
  }

  return result;
}
