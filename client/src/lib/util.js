/* Formatting + session persistence. No backend: the whole model lives in the
   browser session, so a refresh keeps your work and closing the tab clears it. */

const CRORE = 1e7;
const LAKH = 1e5;

export const SYMBOLS = { INR: "₹", USD: "$", EUR: "€", GBP: "£" };

export function symbolFor(currency) {
  return SYMBOLS[currency] || "";
}

/** Full amount with thousands separators, e.g. ₹1,20,000. */
export function money(value, currency = "INR") {
  const n = Number(value) || 0;
  const locale = currency === "INR" ? "en-IN" : "en-US";
  return (
    symbolFor(currency) +
    Math.round(n).toLocaleString(locale)
  );
}

/**
 * Short form for headline figures. Indian currency uses crore/lakh because a
 * payer audience reads "₹374 Cr" far faster than eleven digits.
 */
export function moneyShort(value, currency = "INR") {
  const n = Number(value) || 0;
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  const sym = symbolFor(currency);

  if (currency === "INR") {
    if (abs >= CRORE) return `${sign}${sym}${(abs / CRORE).toFixed(abs / CRORE >= 100 ? 0 : 1)} Cr`;
    if (abs >= LAKH) return `${sign}${sym}${(abs / LAKH).toFixed(1)} L`;
    return `${sign}${sym}${Math.round(abs).toLocaleString("en-IN")}`;
  }

  if (abs >= 1e9) return `${sign}${sym}${(abs / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${sign}${sym}${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}${sym}${(abs / 1e3).toFixed(1)}K`;
  return `${sign}${sym}${Math.round(abs)}`;
}

export function count(value) {
  return Math.round(Number(value) || 0).toLocaleString("en-IN");
}

export function pct(value, digits = 1) {
  return `${((Number(value) || 0) * 100).toFixed(digits)}%`;
}

/* ---------------- session state ---------------- */

const KEY = "biet.model.v1";

export function loadSession(fallback) {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw) return { ...fallback, ...JSON.parse(raw) };
  } catch {
    /* private mode, blocked storage - fall through to defaults */
  }
  return fallback;
}

export function saveSession(model) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(model));
  } catch {
    /* non-fatal: the model still lives in React state for this page view */
  }
}

export function clearSession() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* nothing to do */
  }
}

/** Stable id for dynamically added comparators. */
export function newId(prefix = "CMP") {
  return `${prefix}_${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}
