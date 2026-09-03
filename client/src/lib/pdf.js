import { money, moneyRate, moneyShort, count, pct } from "./util.js";

/**
 * jsPDF's built-in Helvetica has no rupee glyph (it renders as a stray
 * character), so the report substitutes the ISO code for the currency symbol
 * throughout — "INR 374 Cr" instead of "₹374 Cr". ISO codes are standard in
 * HEOR reporting anyway.
 */
const SYMBOL = { INR: "₹", USD: "$", EUR: "€", GBP: "£" };
const pdfMoney = (n, cur) => money(n, cur).replaceAll(SYMBOL[cur] || "", (cur || "") + " ");
const pdfShort = (n, cur) => moneyShort(n, cur).replaceAll(SYMBOL[cur] || "", (cur || "") + " ");
// Per-member rates need cents, or a PMPM of 0.21 prints as "0" in the report.
const pdfRate = (n, cur) => moneyRate(n, cur).replaceAll(SYMBOL[cur] || "", (cur || "") + " ");

/**
 * Client-side PDF report. jsPDF + autotable are ~150 kB gzipped and only needed
 * when the user clicks Export, so both are lazy-loaded. The report is drawn as
 * real text and tables (not a screenshot), so it stays crisp and selectable.
 */
let libPromise = null;
async function loadLibs() {
  if (!libPromise) {
    libPromise = (async () => {
      const { jsPDF } = await import("jspdf");
      await import("jspdf-autotable");
      return jsPDF;
    })();
  }
  return libPromise;
}

// Brand + semantic colours as RGB triples (jsPDF wants numbers, not CSS vars).
const INDIGO = [79, 70, 229];
const VIOLET = [124, 58, 237];
const INK = [24, 24, 27];
const MUTED = [113, 113, 122];
const NEG = [220, 38, 38];
const POS = [5, 150, 105];
const LINE = [228, 228, 231];

export async function exportReport(model, result) {
  const jsPDF = await loadLibs();
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const M = 40; // margin
  const cur = model.currency;
  const s = result.summary;
  const increases = s.netBudgetImpactTotal >= 0;

  /* ---- header band ---- */
  doc.setFillColor(...INDIGO);
  doc.rect(0, 0, W, 84, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("BIET", M, 38);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text("Budget Impact Report", M + 52, 38);
  doc.setFontSize(9);
  doc.setTextColor(230, 230, 250);
  doc.text(
    `${model.diseaseName}${model.subgroup && model.subgroup !== "ALL" ? " · " + model.subgroup : ""}`,
    M,
    58
  );
  doc.text(
    `${model.perspective} · ${model.timeHorizonYears}-year horizon · ${model.countryName} · ${cur}`,
    M,
    72
  );
  doc.text(new Date().toLocaleString(), W - M, 58, { align: "right" });

  /* ---- headline ---- */
  let y = 118;
  doc.setTextColor(...MUTED);
  doc.setFontSize(10);
  doc.text("Net budget impact vs current care", M, y);
  y += 26;
  doc.setTextColor(...(increases ? NEG : POS));
  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.text(pdfMoney(s.netBudgetImpactTotal, cur), M, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  doc.text(
    `${increases ? "Additional spend" : "Net saving"} over ${model.timeHorizonYears} years`,
    M,
    y + 16
  );

  // Executive recommendation, wrapped.
  const driver = s.biggestDriver;
  const offset = s.biggestOffset;
  const rec =
    `Recommendation: ${model.newIntervention.treatmentName} ${increases ? "raises" : "lowers"} the ` +
    `${model.perspective.toLowerCase()} budget by ${pdfShort(Math.abs(s.netBudgetImpactTotal), cur)} over ` +
    `${model.timeHorizonYears} years (${pdfRate(s.averagePMPM, cur)} PMPM). Largest driver: ` +
    `${driver.label.toLowerCase()} (${pdfShort(driver.diff, cur)})` +
    `${offset && offset.diff < 0 ? `, offset by lower ${offset.label.toLowerCase()}` : ""}. ` +
    `Validate price and uptake assumptions before reimbursement planning.`;
  doc.setFontSize(9);
  doc.setTextColor(...INK);
  const recLines = doc.splitTextToSize(rec, W - M * 2);
  doc.text(recLines, M, y + 34);
  y += recLines.length * 11;

  /* ---- KPI grid ---- */
  const kpis = [
    ["Without intervention", pdfShort(s.currentCostTotal, cur)],
    ["With intervention", pdfShort(s.newCostTotal, cur)],
    ["Affordability - PMPM (Y1)", pdfRate(s.year1PMPM, cur)],
    ["Affordability - PMPY (Y1)", pdfMoney(s.year1PMPY, cur)],
    ["Patients treated (peak)", count(s.peakTreatedPatients, cur)],
    ["Cost / treated patient", pdfMoney(s.costPerTreatedPatient, cur)],
    ["Break-even price", s.breakEvenAnnualPrice == null ? "n/a" : pdfMoney(s.breakEvenAnnualPrice, cur)],
    ["Hospital cost avoided", pdfShort(s.hospitalCostAvoidedTotal, cur)],
  ];
  y += 44;
  const colW = (W - M * 2) / 4;
  kpis.forEach(([label, val], i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const x = M + col * colW;
    const ky = y + row * 52;
    doc.setDrawColor(...LINE);
    doc.roundedRect(x, ky, colW - 8, 44, 4, 4, "S");
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(label.toUpperCase(), x + 8, ky + 15);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...INK);
    doc.text(String(val), x + 8, ky + 33);
    doc.setFont("helvetica", "normal");
  });
  y += 52 * 2 + 18;

  /* ---- net impact by year: simple drawn bars ---- */
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...INK);
  doc.text("Budget impact by year", M, y);
  doc.setFont("helvetica", "normal");
  y += 12;

  const years = result.annualResults;
  const maxAbs = Math.max(...years.map((r) => Math.abs(r.netBudgetImpact)), 1);
  const chartH = 90;
  const barGap = 14;
  const barW = (W - M * 2 - barGap * (years.length - 1)) / years.length;
  const baseY = y + chartH;
  years.forEach((r, i) => {
    const x = M + i * (barW + barGap);
    const h = (Math.abs(r.netBudgetImpact) / maxAbs) * chartH;
    doc.setFillColor(...(r.netBudgetImpact >= 0 ? NEG : POS));
    doc.rect(x, baseY - h, barW, h, "F");
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(`Y${r.modelYear}`, x + barW / 2, baseY + 12, { align: "center" });
    doc.setTextColor(...INK);
    doc.text(pdfShort(r.netBudgetImpact, cur), x + barW / 2, baseY - h - 4, { align: "center" });
  });
  y = baseY + 30;

  /* ---- year-by-year table ---- */
  doc.autoTable({
    startY: y,
    margin: { left: M, right: M },
    head: [["Year", "Patients treated", "Without intervention", "With intervention", "Net impact", "PMPM"]],
    body: years.map((r) => [
      r.calendarYear,
      count(r.newInterventionPatients, cur),
      pdfMoney(r.currentScenarioCost, cur),
      pdfMoney(r.newScenarioCost, cur),
      pdfMoney(r.netBudgetImpact, cur),
      pdfRate(r.pmpm, cur),
    ]),
    foot: [[
      "Total",
      count(s.treatedPatientYears, cur),
      pdfMoney(s.currentCostTotal, cur),
      pdfMoney(s.newCostTotal, cur),
      pdfMoney(s.netBudgetImpactTotal, cur),
      pdfRate(s.averagePMPM, cur),
    ]],
    styles: { fontSize: 8, cellPadding: 4, textColor: INK, lineColor: LINE },
    headStyles: { fillColor: INDIGO, textColor: [255, 255, 255], fontSize: 8 },
    footStyles: { fillColor: [244, 244, 245], textColor: INK, fontStyle: "bold" },
    columnStyles: { 0: { halign: "left" } },
    theme: "grid",
  });

  /* ---- current vs new, by cost component ---- */
  if (result.comparison) {
    doc.autoTable({
      startY: doc.lastAutoTable.finalY + 22,
      margin: { left: M, right: M },
      head: [["Cost component", "Without intervention", "With intervention", "Difference"]],
      body: result.comparison.categories.map((c) => [
        c.label,
        pdfMoney(c.current, cur),
        pdfMoney(c.new, cur),
        (c.diff >= 0 ? "+" : "") + pdfMoney(c.diff, cur),
      ]),
      foot: [[
        "Total",
        pdfMoney(result.comparison.totalCurrent, cur),
        pdfMoney(result.comparison.totalNew, cur),
        (result.comparison.difference >= 0 ? "+" : "") + pdfMoney(result.comparison.difference, cur),
      ]],
      styles: { fontSize: 8, cellPadding: 4, textColor: INK, lineColor: LINE },
      headStyles: { fillColor: INDIGO, textColor: [255, 255, 255], fontSize: 8 },
      footStyles: { fillColor: [244, 244, 245], textColor: INK, fontStyle: "bold" },
      columnStyles: { 0: { halign: "left" } },
      theme: "grid",
    });
  }

  /* ---- scenarios ---- */
  doc.autoTable({
    startY: doc.lastAutoTable.finalY + 22,
    margin: { left: M, right: M },
    head: [["Uptake scenario", "Uptake", "Patient-years", "Net impact", "Year 1 PMPM"]],
    body: result.scenarios.map((sc) => [
      sc.label,
      `${(sc.uptakeScale * 100).toFixed(0)}% of base`,
      count(sc.treatedPatientYears, cur),
      pdfMoney(sc.netBudgetImpactTotal, cur),
      pdfRate(sc.year1PMPM, cur),
    ]),
    styles: { fontSize: 8, cellPadding: 4, textColor: INK, lineColor: LINE },
    headStyles: { fillColor: VIOLET, textColor: [255, 255, 255], fontSize: 8 },
    columnStyles: { 0: { halign: "left" } },
    theme: "grid",
    didParseCell: (d) => {
      d.row.section === "body" && (d.cell.styles.fontStyle = d.row.index === 1 ? "bold" : "normal");
    },
  });

  /* ---- clinical outcomes ---- */
  if (result.eventsAvoided?.length) {
    doc.autoTable({
      startY: doc.lastAutoTable.finalY + 22,
      margin: { left: M, right: M },
      head: [["Clinical outcome", "Events avoided", "Cost avoided"]],
      body: result.eventsAvoided.map((e) => [
        e.outcomeName,
        count(e.eventsAvoided, cur),
        pdfMoney(e.costAvoided, cur),
      ]),
      foot: [["Total", count(s.eventsAvoidedTotal, cur), pdfMoney(s.hospitalCostAvoidedTotal, cur)]],
      styles: { fontSize: 8, cellPadding: 4, textColor: INK, lineColor: LINE },
      headStyles: { fillColor: [13, 148, 136], textColor: [255, 255, 255], fontSize: 8 },
      footStyles: { fillColor: [244, 244, 245], textColor: INK, fontStyle: "bold" },
      columnStyles: { 0: { halign: "left" } },
      theme: "grid",
    });
  }

  /* ---- footer on every page ---- */
  const pages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pages; i += 1) {
    doc.setPage(i);
    const H = doc.internal.pageSize.getHeight();
    doc.setDrawColor(...LINE);
    doc.line(M, H - 34, W - M, H - 34);
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(
      model.isDemo
        ? "BIET demonstration scenario - illustrative values, not real product data. Not a validated HTA submission model."
        : "BIET early-stage estimate. Not a validated HTA submission model; review assumptions before decision use.",
      M,
      H - 20
    );
    doc.text(`Page ${i} of ${pages}`, W - M, H - 20, { align: "right" });
  }

  const stamp = new Date().toISOString().slice(0, 10);
  doc.save(`BIET-report-${model.diseaseCode}-${stamp}.pdf`);
}
