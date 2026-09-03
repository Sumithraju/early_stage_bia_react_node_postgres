import { money, moneyShort, count, pct } from "./util.js";

/**
 * The assistant has two modes.
 *
 * 1. LOCAL (default): a keyword-matched knowledge base that explains budget-
 *    impact concepts and reads the user's *current* model and results, so
 *    "what is my break-even?" returns the live number. No key, no network, so
 *    the demo never depends on anything.
 *
 * 2. QWEN (optional): if the user pastes a free OpenRouter API key, free-form
 *    questions are sent to a Qwen model with the current model + results as
 *    grounding context. The key is entered at runtime and kept in the session
 *    only -- never committed, never bundled.
 */

/* ---------------- context grounding ---------------- */

export function buildContext(model, result) {
  if (!result) return { model, result: null, facts: {} };
  const s = result.summary;
  const increases = s.netBudgetImpactTotal >= 0;
  return {
    model,
    result,
    facts: {
      disease: model.diseaseName,
      perspective: model.perspective,
      horizon: model.timeHorizonYears,
      currency: model.currency,
      intervention: model.newIntervention?.treatmentName,
      price: model.newIntervention?.annualDrugCost,
      net: s.netBudgetImpactTotal,
      increases,
      pmpm1: s.year1PMPM,
      pmpmAvg: s.averagePMPM,
      patients: s.peakTreatedPatients,
      patientYears: s.treatedPatientYears,
      costPer: s.costPerTreatedPatient,
      breakEven: s.breakEvenAnnualPrice,
      events: s.eventsAvoidedTotal,
      hospSaved: s.hospitalCostAvoidedTotal,
      responders: s.weightLossResponders,
      scenarios: result.scenarios,
    },
  };
}

/* ---------------- local knowledge base ---------------- */

const KB = [
  {
    keys: /\b(budget impact|what is bia|what.s bia|purpose|what does this tool)\b/i,
    answer: () =>
      "A budget impact analysis (BIA) estimates the change in total spend for a payer if a new treatment is introduced, versus continuing current care. Unlike cost-effectiveness, it answers an affordability question: “what will this cost my budget over the next few years?”",
  },
  {
    keys: /\b(net (budget )?impact|net impact|total cost|bottom line|headline)\b/i,
    answer: (c) =>
      c.facts.net === undefined
        ? "Net impact is the difference between spend with the intervention and spend on current care, summed over the horizon."
        : `Your net budget impact over ${c.facts.horizon} years is ${money(c.facts.net, c.facts.currency)} — ${c.facts.increases ? "an additional cost" : "a net saving"} versus current care. It is the with-intervention spend minus the current-care spend, added up across every year.`,
  },
  {
    keys: /\b(pmpm|per member per month|per member)\b/i,
    answer: (c) =>
      c.facts.pmpm1 === undefined
        ? "PMPM (per-member-per-month) spreads the net impact across every covered life and every month, so payers can compare it to a premium."
        : `PMPM spreads the net impact across all covered lives and 12 months. Yours is ${money(c.facts.pmpm1, c.facts.currency)} in year 1 and averages ${money(c.facts.pmpmAvg, c.facts.currency)} across the horizon. It lets a payer weigh the impact against a monthly premium.`,
  },
  {
    keys: /\b(break.?even|breakeven|what price|price to)\b/i,
    answer: (c) =>
      c.facts.breakEven == null
        ? "Break-even price is the annual treatment price at which net budget impact reaches zero — where added drug cost exactly matches the medical costs avoided."
        : `Your break-even annual price is ${money(c.facts.breakEven, c.facts.currency)}. At that price the added drug spend is exactly offset by the medical costs avoided, so net impact is zero. Your current price is ${money(c.facts.price, c.facts.currency)}${c.facts.price > c.facts.breakEven ? ", which is above break-even — hence a net cost." : ", at or below break-even."}`,
  },
  {
    keys: /\b(uptake|adoption|market share of new|penetration)\b/i,
    answer: () =>
      "Uptake is the share of eligible patients who switch to the new intervention each year. It usually starts low and ramps up. Because impact scales almost linearly with uptake, the Scenarios tab replays your model at half (low) and one-and-a-half times (high) the base uptake.",
  },
  {
    keys: /\b(funnel|eligible|eligibility|how many patients|covered)\b/i,
    answer: (c) =>
      `The population funnel narrows covered lives down to treatable patients by applying, in turn: prevalence, diagnosed share, clinical eligibility, payer eligibility, access, and willingness. ${c.facts.patients ? `In your model, about ${count(c.facts.patients)} patients are treated at peak year.` : ""}`,
  },
  {
    keys: /\b(adherence|persistence|discontinu)\b/i,
    answer: () =>
      "Adherence is the share of prescribed doses actually taken; persistence is the share of patients still on treatment at year end. Drug cost is scaled by both, so lower adherence/persistence means lower realised cost — and usually a smaller clinical benefit.",
  },
  {
    keys: /\b(scenario|low.*high|sensitivity|best case|worst case)\b/i,
    answer: (c) => {
      if (!c.facts.scenarios) return "The Scenarios tab shows low, base, and high uptake so you can see the range of budget impact.";
      const [low, base, high] = c.facts.scenarios;
      return `Across uptake scenarios your net impact ranges from ${moneyShort(low.netBudgetImpactTotal, c.facts.currency)} (low) to ${moneyShort(high.netBudgetImpactTotal, c.facts.currency)} (high), with a base case of ${moneyShort(base.netBudgetImpactTotal, c.facts.currency)}.`;
    },
  },
  {
    keys: /\b(relative risk|events avoided|outcomes|complications|offset)\b/i,
    answer: (c) =>
      `Each clinical outcome has a background event rate and a relative risk on the new drug (below 100% means fewer events). The events avoided translate into medical costs avoided, which offset the drug cost. ${c.facts.events ? `Your model avoids about ${count(c.facts.events)} events and ${moneyShort(c.facts.hospSaved, c.facts.currency)} in medical costs over the horizon.` : ""}`,
  },
  {
    keys: /\b(responder|weight loss|weight regain|regain)\b/i,
    answer: () =>
      "Responder rate is the share of treated patients who reach the target weight loss (or glycaemic target); only responders carry the outcome benefit. Weight regain erodes that benefit each year, so the relative-risk advantage decays over the horizon.",
  },
  {
    keys: /\b(comparator|current care|add.*drug|remove|competitor)\b/i,
    answer: () =>
      "Comparators are the treatments patients receive today. On the Current care step you can add a comparator column with the + button or remove any column; their market shares must total 100%. The blended current-care cost is what the new intervention is measured against.",
  },
  {
    keys: /\b(perspective|payer|who pays|government|insurer|employer)\b/i,
    answer: (c) =>
      `Perspective sets whose budget is measured — government payer, private insurer, employer, or health system. It does not change the maths, but frames the result. Yours is set to ${c.facts.perspective || "a payer"}.`,
  },
  {
    keys: /\b(disease|diabetes|obesity|subgroup|switch)\b/i,
    answer: (c) =>
      `This build models obesity and type 2 diabetes, one at a time, chosen on the Therapy area step. Switching disease loads that disease's defaults and subgroups. You are currently modelling ${c.facts.disease || "the selected disease"}.`,
  },
  {
    keys: /\b(excel|import|upload|template|spreadsheet|download)\b/i,
    answer: () =>
      "Use Template (top bar) to download an Excel workbook pre-filled with the current model, edit the numbers offline, then Import Excel to load them back. Any sheet you leave out keeps its current values, so a partial workbook is a valid partial update.",
  },
  {
    keys: /\b(run|save|compare|history|previous)\b/i,
    answer: () =>
      "On the Results page, Save run stores a snapshot of the current inputs and outputs. The Runs tab lines up run 1, run 2, run 3 … side by side so you can compare, for example, two prices or two uptake curves. Runs live in the session and clear when you close the tab.",
  },
];

const FALLBACK =
  "I can explain any part of this budget-impact model — net impact, PMPM, break-even price, uptake, the population funnel, adherence, scenarios, events avoided, comparators, or how to save and compare runs. Ask about any of those, or connect a QWEN key (gear icon) for free-form answers.";

export function answerLocally(question, ctx) {
  const q = String(question || "");
  for (const entry of KB) {
    if (entry.keys.test(q)) return entry.answer(ctx);
  }
  // Greetings
  if (/\b(hi|hello|hey|help)\b/i.test(q)) {
    return `Hi — I'm the BIET assistant. ${FALLBACK}`;
  }
  return FALLBACK;
}

/* ---------------- server-proxied LLM (recommended) ---------------- */

/**
 * Ask the app's own /api/chat proxy, which forwards to whatever free provider is
 * configured server-side (Groq / OpenRouter / HuggingFace / xAI). The key never
 * touches the browser. Returns null if the server has no LLM configured, so the
 * caller can fall back to local answers.
 */
export async function serverLLMStatus() {
  try {
    const res = await fetch("/api/chat/status", { headers: { Accept: "application/json" } });
    if (!res.ok) return { configured: false };
    return await res.json();
  } catch {
    return { configured: false };
  }
}

export async function askServer(question, history, ctx) {
  const messages = [
    { role: "system", content: systemPrompt(ctx) },
    ...history.map((m) => ({ role: m.role === "bot" ? "assistant" : "user", content: m.text })),
    { role: "user", content: question },
  ];
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const parts = [body.error || `Server LLM error (${res.status})`];
    if (body.detail) parts.push(body.detail);
    throw new Error(parts.join(" — "));
  }
  const data = await res.json();
  if (!data.reply) throw new Error("Empty response from the server LLM.");
  return data.reply;
}

/* ---------------- optional QWEN via OpenRouter ---------------- */

const QWEN_SETTINGS_KEY = "biet.qwen.v1";

export function loadQwenSettings() {
  try {
    return JSON.parse(sessionStorage.getItem(QWEN_SETTINGS_KEY) || "null") || {
      apiKey: "",
      model: "qwen/qwen-2.5-72b-instruct:free",
    };
  } catch {
    return { apiKey: "", model: "qwen/qwen-2.5-72b-instruct:free" };
  }
}

export function saveQwenSettings(settings) {
  try {
    sessionStorage.setItem(QWEN_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* non-fatal */
  }
}

function systemPrompt(ctx) {
  const f = ctx.facts;
  return [
    "You are the assistant embedded in BIET, a budget impact estimation tool for early-stage health economics.",
    "Answer briefly and practically. Explain payer/HEOR concepts in plain language.",
    "Here is the user's CURRENT model and results as JSON. Use these exact numbers when they ask about their model:",
    JSON.stringify(
      {
        disease: f.disease,
        perspective: f.perspective,
        horizonYears: f.horizon,
        currency: f.currency,
        intervention: f.intervention,
        annualPrice: f.price,
        netBudgetImpact: f.net,
        isCostIncrease: f.increases,
        year1PMPM: f.pmpm1,
        breakEvenPrice: f.breakEven,
        patientsTreatedPeak: f.patients,
        eventsAvoided: f.events,
      },
      null,
      0
    ),
    "If asked something outside budget-impact modelling, answer briefly and steer back to the tool.",
  ].join("\n");
}

/** Calls a Qwen model through OpenRouter's OpenAI-compatible endpoint. */
export async function askQwen(question, history, ctx, settings) {
  const messages = [
    { role: "system", content: systemPrompt(ctx) },
    ...history.map((m) => ({ role: m.role === "bot" ? "assistant" : "user", content: m.text })),
    { role: "user", content: question },
  ];

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.apiKey}`,
      "HTTP-Referer": location.origin,
      "X-Title": "BIET",
    },
    body: JSON.stringify({
      model: settings.model || "qwen/qwen-2.5-72b-instruct:free",
      messages,
      temperature: 0.3,
      max_tokens: 500,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `QWEN request failed (${res.status}). ${
        res.status === 401 ? "Check the API key." : detail.slice(0, 140)
      }`
    );
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("QWEN returned an empty response.");
  return text;
}
