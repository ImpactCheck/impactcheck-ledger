/**
 * Professional GHG Protocol Report PDF Generator
 *
 * Generates a multi-page HTML document designed for browser print-to-PDF,
 * structured per the GHG Protocol Corporate Standard.
 */

import { formatTonnes, formatNumber, getActivityPhase } from "@/contracts/impactcheck.v2";
import type { Report, Recommendation, PhaseTotals } from "@/contracts/impactcheck.v2";
import { REGION_LABELS } from "@/lib/regions";
import { SECTION_LABELS, type ReportSectionId } from "@/lib/report-presentation";

interface ReportPDFInput {
  report: Report;
  projectName: string;
  year: number;
  primaryRegion: string;
  companyType: string;
  recommendations: Recommendation[];
}

// ─── Helpers ──────────────────────────────────────────────────────────

function regionLabel(code: string): string {
  return REGION_LABELS[code] ?? code.replace(/_/g, " ");
}

function complianceIcon(status: string): string {
  if (status === "green") return "✅";
  if (status === "yellow") return "⚠️";
  return "❌";
}

function complianceLabel(status: string): string {
  if (status === "green") return "Compliant";
  if (status === "yellow") return "Incomplete Data";
  return "Non-Compliant";
}

function pct(value: number, total: number): string {
  if (total === 0) return "0";
  return ((value / total) * 100).toFixed(1);
}

// ─── Section Builders ─────────────────────────────────────────────────

function buildCoverPage(input: ReportPDFInput): string {
  const dateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const primaryTotal = input.report.totalsByRegion[input.primaryRegion] ?? 0;
  return `
    <div class="cover-page">
      <div class="cover-top">
        <div class="cover-badge">GHG Protocol Corporate Standard</div>
        <div class="cover-badge secondary">ISO 14064-1 Aligned</div>
      </div>
      <div class="cover-center">
        <div class="cover-logo">ImpactCheck</div>
        <h1 class="cover-title">Carbon Audit Report</h1>
        <div class="cover-divider"></div>
        <h2 class="cover-project">${input.projectName}</h2>
        <p class="cover-meta">${regionLabel(input.primaryRegion)} · Reporting Year ${input.year}</p>
        <div class="cover-total">
          <span class="cover-total-value">${formatTonnes(primaryTotal)}</span>
          <span class="cover-total-unit">tonnes CO₂e</span>
        </div>
      </div>
      <div class="cover-bottom">
        <p>Report Generated: ${dateStr}</p>
        <p>Assessment Type: ${input.companyType === "investor" ? "Investment Feasibility" : input.companyType === "regulator" ? "Regulatory Compliance" : "Corporate Emissions"}</p>
        <p class="cover-disclaimer">This report has been prepared in accordance with the GHG Protocol Corporate Accounting and Reporting Standard (Revised Edition) and the 2026 SCI for AI standard.</p>
      </div>
    </div>`;
}

function buildTOC(input: ReportPDFInput): string {
  const sections = [
    { num: "1", title: "Executive Summary" },
    { num: "2", title: "Organizational & Operational Boundaries" },
    { num: "3", title: "Emissions Quantification" },
    { num: "3.1", title: "Total Emissions by Region" },
    { num: "3.2", title: "Embodied vs Operational Split" },
    { num: "3.3", title: "Category Breakdown" },
    { num: "4", title: "Emission Hotspots" },
    { num: "5", title: "Regulatory Compliance Assessment" },
    { num: "6", title: "Data Quality & Confidence" },
    { num: "7", title: "Missing Data & Evidence Gaps" },
    { num: "8", title: "Reduction Scenarios" },
    { num: "9", title: "Traceability & Factor Metadata" },
    { num: "10", title: "Assumptions & System Boundaries" },
    { num: "11", title: "Methodology Statement" },
  ];
  const rows = sections
    .map(
      (s) =>
        `<div class="toc-row"><span class="toc-num">${s.num}</span><span class="toc-label">${s.title}</span><span class="toc-dots"></span></div>`
    )
    .join("");
  return `
    <div class="page-break"></div>
    <h2 class="section-header toc-header">Table of Contents</h2>
    <div class="toc">${rows}</div>`;
}

function buildExecutiveSummary(input: ReportPDFInput): string {
  const { report, primaryRegion } = input;
  const primaryTotal = report.totalsByRegion[primaryRegion] ?? 0;
  const phaseTotals = report.phaseTotalsByRegion?.[primaryRegion] ?? { embodied: 0, operational: 0 };
  const total = phaseTotals.embodied + phaseTotals.operational;
  const regionCount = Object.keys(report.totalsByRegion).length;
  const categories = report.categoryBreakdownByRegion?.[primaryRegion] ?? [];
  const topHotspot = report.hotspots[0];

  return `
    <div class="page-break"></div>
    <h2 class="section-header"><span class="section-num">1</span>Executive Summary</h2>
    <div class="summary-grid">
      <div class="summary-card highlight">
        <div class="summary-label">Total Lifecycle Emissions</div>
        <div class="summary-value">${formatTonnes(primaryTotal)} t CO₂e</div>
        <div class="summary-sub">${regionLabel(primaryRegion)} · Year ${input.year}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">Embodied Carbon (Year 1)</div>
        <div class="summary-value">${formatTonnes(phaseTotals.embodied)} t</div>
        <div class="summary-sub">${pct(phaseTotals.embodied, total)}% of total</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">Operational Carbon (Annual)</div>
        <div class="summary-value">${formatTonnes(phaseTotals.operational)} t</div>
        <div class="summary-sub">${pct(phaseTotals.operational, total)}% of total</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">Regions Assessed</div>
        <div class="summary-value">${regionCount}</div>
        <div class="summary-sub">${Object.keys(report.totalsByRegion).map(regionLabel).join(", ")}</div>
      </div>
    </div>
    ${report.deltaVsBaselineKg !== undefined ? `
    <div class="info-box">
      <strong>Delta vs. Baseline:</strong> ${report.deltaVsBaselineKg > 0 ? "+" : ""}${formatTonnes(report.deltaVsBaselineKg)} t CO₂e
    </div>` : ""}
    ${topHotspot ? `
    <div class="info-box warn">
      <strong>Largest Emission Source:</strong> ${topHotspot.text} — ${formatTonnes(topHotspot.co2eKg)} t CO₂e
    </div>` : ""}
    <p class="body-text">This report quantifies the greenhouse gas emissions for <strong>${input.projectName}</strong> across ${regionCount} region(s) for the reporting year ${input.year}. The assessment follows the GHG Protocol Corporate Accounting and Reporting Standard, covering Scope 1, 2, and partial Scope 3 emissions. Embodied emissions (hardware, construction, infrastructure) are attributed to Year 1 only, while operational emissions (energy, cooling, maintenance) recur annually.</p>
    ${categories.length > 0 ? `<p class="body-text">A total of <strong>${categories.length} emission categories</strong> were assessed, with ${categories.filter(c => c.co2eKg > 0).length} categories containing measurable emission data.</p>` : ""}`;
}

function buildBoundaries(input: ReportPDFInput): string {
  return `
    <div class="page-break"></div>
    <h2 class="section-header"><span class="section-num">2</span>Organizational & Operational Boundaries</h2>
    <table class="data-table">
      <tbody>
        <tr><td class="label-cell">Consolidation Approach</td><td>Operational Control</td></tr>
        <tr><td class="label-cell">Reporting Period</td><td>Calendar Year ${input.year}</td></tr>
        <tr><td class="label-cell">Primary Region</td><td>${regionLabel(input.primaryRegion)}</td></tr>
        <tr><td class="label-cell">Comparison Regions</td><td>${Object.keys(input.report.totalsByRegion).filter(r => r !== input.primaryRegion).map(regionLabel).join(", ") || "None"}</td></tr>
        <tr><td class="label-cell">Scope Coverage</td><td>Scope 1 (direct), Scope 2 (purchased energy), Scope 3 (partial — upstream & downstream where data available)</td></tr>
        <tr><td class="label-cell">Lifecycle Phases</td><td><strong>Embodied</strong> (Year 1 only: hardware, construction, infrastructure) + <strong>Operational</strong> (annual: energy, cooling, maintenance)</td></tr>
        <tr><td class="label-cell">System Boundary</td><td>Cradle-to-gate for embodied; gate-to-grave excluded unless explicitly modeled</td></tr>
      </tbody>
    </table>`;
}

function buildEmissionsQuantification(input: ReportPDFInput): string {
  const { report, primaryRegion } = input;
  const phaseTotals = report.phaseTotalsByRegion?.[primaryRegion] ?? { embodied: 0, operational: 0 };
  const categories = report.categoryBreakdownByRegion?.[primaryRegion] ?? [];
  const total = phaseTotals.embodied + phaseTotals.operational;

  // Regional totals table
  const regionRows = Object.entries(report.totalsByRegion)
    .map(([region, t]) => `<tr><td>${regionLabel(region)}${region === primaryRegion ? " <em>(Primary)</em>" : ""}</td><td class="num-cell">${formatTonnes(t)} t CO₂e</td><td class="num-cell">${formatNumber(t)} kg</td></tr>`)
    .join("");

  // Category table
  const categoryRows = categories
    .filter(c => c.co2eKg > 0)
    .sort((a, b) => b.co2eKg - a.co2eKg)
    .map(c => {
      const phase = getActivityPhase(c.category);
      return `<tr><td>${c.category}</td><td class="phase-cell ${phase}">${phase === "embodied" ? "Embodied" : "Operational"}</td><td class="num-cell">${formatTonnes(c.co2eKg)} t</td><td class="num-cell">${pct(c.co2eKg, total)}%</td></tr>`;
    })
    .join("");

  // Phase bar visualization (simple HTML)
  const embPct = total > 0 ? (phaseTotals.embodied / total) * 100 : 0;
  const opPct = total > 0 ? (phaseTotals.operational / total) * 100 : 0;

  return `
    <div class="page-break"></div>
    <h2 class="section-header"><span class="section-num">3</span>Emissions Quantification</h2>

    <h3 class="subsection-header"><span class="section-num">3.1</span>Total Emissions by Region</h3>
    <table class="data-table full">
      <thead><tr><th>Region</th><th style="text-align:right;">Total (tonnes)</th><th style="text-align:right;">Total (kg)</th></tr></thead>
      <tbody>${regionRows}</tbody>
    </table>

    <h3 class="subsection-header"><span class="section-num">3.2</span>Embodied vs Operational Split</h3>
    <p class="body-text">Per the GHG Protocol lifecycle approach, embodied emissions (hardware, construction, infrastructure deployment) are attributed exclusively to Year 1. Operational emissions (energy, cooling, maintenance) recur annually.</p>
    <div class="phase-bar-container">
      <div class="phase-bar">
        <div class="phase-segment embodied" style="width:${embPct}%;">
          ${embPct > 8 ? `${embPct.toFixed(0)}% Embodied` : ""}
        </div>
        <div class="phase-segment operational" style="width:${opPct}%;">
          ${opPct > 8 ? `${opPct.toFixed(0)}% Operational` : ""}
        </div>
      </div>
      <div class="phase-legend">
        <span><span class="dot embodied"></span>Embodied (Year 1): ${formatTonnes(phaseTotals.embodied)} t CO₂e</span>
        <span><span class="dot operational"></span>Operational (Annual): ${formatTonnes(phaseTotals.operational)} t CO₂e</span>
      </div>
    </div>

    <div class="page-break"></div>
    <h3 class="subsection-header"><span class="section-num">3.3</span>Category Breakdown — ${regionLabel(primaryRegion)}</h3>
    <table class="data-table full">
      <thead><tr><th>Category</th><th>Phase</th><th style="text-align:right;">Emissions</th><th style="text-align:right;">Share</th></tr></thead>
      <tbody>${categoryRows}</tbody>
    </table>
    ${categories.filter(c => c.co2eKg === 0).length > 0 ? `
    <div class="info-box warn" style="margin-top:16px;">
      <strong>Zero-emission categories (${categories.filter(c => c.co2eKg === 0).length}):</strong> ${categories.filter(c => c.co2eKg === 0).map(c => c.category).join(", ")}. These may indicate data gaps.
    </div>` : ""}`;
}

function buildHotspots(input: ReportPDFInput): string {
  const rows = input.report.hotspots
    .map((h, i) => {
      const phase = h.phase ?? getActivityPhase(h.text);
      return `<tr><td class="num-cell" style="width:30px;">${i + 1}</td><td>${h.text}</td><td class="phase-cell ${phase}">${phase === "embodied" ? "Embodied" : "Operational"}</td><td class="num-cell">${formatTonnes(h.co2eKg)} t</td></tr>`;
    })
    .join("");

  return `
    <div class="page-break"></div>
    <h2 class="section-header"><span class="section-num">4</span>Emission Hotspots</h2>
    <p class="body-text">The following activities represent the highest-emission sources within the assessment boundary. Prioritizing these for reduction offers the greatest potential impact.</p>
    <table class="data-table full">
      <thead><tr><th style="width:30px;">#</th><th>Activity</th><th>Phase</th><th style="text-align:right;">CO₂e</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function buildCompliance(input: ReportPDFInput): string {
  const { report } = input;
  const byRegion = report.compliance.byRegion;
  let content = "";

  if (byRegion && Object.keys(byRegion).length > 0) {
    for (const [regionKey, data] of Object.entries(byRegion)) {
      const label = regionLabel(regionKey);
      content += `<h3 class="subsection-header">${label}</h3>`;

      for (const [period, result] of [["Year 1 (Embodied + Operational)", data.year1], ["Following Years (Operational Only)", data.ongoing]] as const) {
        if (!result || result.error) {
          content += `<div class="info-box warn"><strong>${period}:</strong> ${result?.error ?? "Not evaluated"}</div>`;
          continue;
        }
        const jurisdictions = result.jurisdictions ?? {};
        for (const [jurName, jur] of Object.entries(jurisdictions)) {
          if (jur.evaluation_status === "NOT_EVALUATED") continue;
          const checks = jur.checks ?? {};
          const entries = Object.entries(checks);
          if (entries.length === 0) continue;
          const rows = entries
            .map(([name, check]) => `<tr><td>${name}</td><td class="${check.status === "PASS" ? "status-pass" : check.status === "FAIL" ? "status-fail" : "status-missing"}">${check.status}</td></tr>`)
            .join("");
          content += `
            <h4 class="jur-header">${jurName} — ${period}</h4>
            <table class="data-table full compact">
              <thead><tr><th>Check</th><th style="width:80px;">Status</th></tr></thead>
              <tbody>${rows}</tbody>
            </table>`;
        }
      }
    }
  } else {
    // Fallback to legacy compliance
    content += `
      <div class="compliance-grid">
        <div class="compliance-card ${report.compliance.us.status}">
          <h4>US (EPA)</h4>
          <div class="compliance-status">${complianceIcon(report.compliance.us.status)} ${complianceLabel(report.compliance.us.status)}</div>
          <ul>${report.compliance.us.reasons.map(r => `<li>${r}</li>`).join("")}</ul>
        </div>
        <div class="compliance-card ${report.compliance.eu.status}">
          <h4>EU (CSRD / ESRS E1)</h4>
          <div class="compliance-status">${complianceIcon(report.compliance.eu.status)} ${complianceLabel(report.compliance.eu.status)}</div>
          <ul>${report.compliance.eu.reasons.map(r => `<li>${r}</li>`).join("")}</ul>
        </div>
      </div>`;
  }

  return `
    <div class="page-break"></div>
    <h2 class="section-header"><span class="section-num">5</span>Regulatory Compliance Assessment</h2>
    <p class="body-text">Compliance is assessed per region for both Year 1 (including embodied emissions) and subsequent years (operational only). It is possible to be non-compliant in Year 1 but compliant in subsequent years due to one-time construction/hardware emissions.</p>
    ${content}`;
}

function buildDataQuality(input: ReportPDFInput): string {
  const { report } = input;
  const primaryRegion = Object.keys(report.totalsByRegion)[0] ?? "";
  const categories = report.categoryBreakdownByRegion?.[primaryRegion] ?? [];
  const nonZero = categories.filter(c => c.co2eKg > 0).length;
  const coverage = categories.length > 0 ? Math.round((nonZero / categories.length) * 100) : 0;
  const hotspotsWithPhase = report.hotspots.filter(h => h.phase).length;
  const phaseClass = report.hotspots.length > 0 ? Math.round((hotspotsWithPhase / report.hotspots.length) * 100) : 100;

  return `
    <div class="page-break"></div>
    <h2 class="section-header"><span class="section-num">6</span>Data Quality & Confidence</h2>
    <p class="body-text">Per GHG Protocol data quality requirements, the following metrics assess the completeness, reliability, and classification accuracy of the emissions inventory.</p>
    <table class="data-table full">
      <thead><tr><th>Metric</th><th style="text-align:right;">Score</th><th>Detail</th></tr></thead>
      <tbody>
        <tr><td>Category Coverage</td><td class="num-cell">${coverage}%</td><td>${nonZero} of ${categories.length} categories with emission data</td></tr>
        <tr><td>Phase Classification</td><td class="num-cell">${phaseClass}%</td><td>${hotspotsWithPhase} of ${report.hotspots.length} activities classified</td></tr>
        <tr><td>Regional Breadth</td><td class="num-cell">${Object.keys(report.totalsByRegion).length}</td><td>Region(s) assessed</td></tr>
      </tbody>
    </table>
    <div class="quality-bar-container">
      <div class="quality-row"><span>Category Coverage</span><div class="quality-bar"><div class="quality-fill" style="width:${coverage}%;"></div></div><span>${coverage}%</span></div>
      <div class="quality-row"><span>Phase Classification</span><div class="quality-bar"><div class="quality-fill" style="width:${phaseClass}%;"></div></div><span>${phaseClass}%</span></div>
    </div>`;
}

function buildMissingData(input: ReportPDFInput): string {
  const { report } = input;
  const primaryRegion = Object.keys(report.totalsByRegion)[0] ?? "";
  const categories = report.categoryBreakdownByRegion?.[primaryRegion] ?? [];
  const zeroCats = categories.filter(c => c.co2eKg === 0);
  const gaps: string[] = [];
  if (zeroCats.length > 0) gaps.push(`${zeroCats.length} categor${zeroCats.length === 1 ? "y has" : "ies have"} zero emissions — possible data gaps: ${zeroCats.map(c => c.category).join(", ")}`);
  if (Object.keys(report.totalsByRegion).length < 2) gaps.push("Only one region assessed — consider adding comparison regions for broader coverage.");
  if (report.hotspots.some(h => !h.phase)) gaps.push("Some hotspot activities lack phase classification (embodied vs operational).");
  if (gaps.length === 0) gaps.push("No significant evidence gaps detected in the current dataset.");

  return `
    <h2 class="section-header"><span class="section-num">7</span>Missing Data & Evidence Gaps</h2>
    <p class="body-text">Per GHG Protocol completeness requirements, the following areas may benefit from additional data collection to improve audit quality.</p>
    <ul class="gap-list">${gaps.map(g => `<li>${g}</li>`).join("")}</ul>`;
}

function buildScenarios(input: ReportPDFInput): string {
  if (input.recommendations.length === 0) {
    return `
      <div class="page-break"></div>
      <h2 class="section-header"><span class="section-num">8</span>Reduction Scenarios</h2>
      <p class="body-text">No reduction scenarios have been generated for this project.</p>`;
  }
  const rows = input.recommendations
    .map(r => `<tr><td><strong>${r.title}</strong><br><span class="small-text">${r.summary}</span></td><td class="num-cell green">-${formatTonnes(Math.abs(r.expectedDeltaKg))} t</td></tr>`)
    .join("");
  const totalReduction = input.recommendations.reduce((sum, r) => sum + Math.abs(r.expectedDeltaKg), 0);

  return `
    <div class="page-break"></div>
    <h2 class="section-header"><span class="section-num">8</span>Reduction Scenarios</h2>
    <p class="body-text">AI-generated reduction strategies aligned with GHG Protocol guidance. Total potential reduction: <strong>${formatTonnes(totalReduction)} t CO₂e</strong>.</p>
    <table class="data-table full">
      <thead><tr><th>Strategy</th><th style="text-align:right;">Expected Reduction</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function buildTraceability(input: ReportPDFInput): string {
  const { report, primaryRegion } = input;
  const categories = report.categoryBreakdownByRegion?.[primaryRegion] ?? [];
  return `
    <div class="page-break"></div>
    <h2 class="section-header"><span class="section-num">9</span>Traceability & Factor Metadata</h2>
    <table class="data-table full">
      <tbody>
        <tr><td class="label-cell">Methodology</td><td>GHG Protocol Corporate Standard, ISO 14064-1</td></tr>
        <tr><td class="label-cell">Emission Factor Sources</td><td>Climatiq API (aggregated from DEFRA, EPA, ecoinvent, ADEME, IEA)</td></tr>
        <tr><td class="label-cell">Regions Assessed</td><td>${Object.keys(report.totalsByRegion).map(regionLabel).join(", ")}</td></tr>
        <tr><td class="label-cell">Categories Mapped</td><td>${categories.length} categories across ${Object.keys(report.totalsByRegion).length} region(s)</td></tr>
        <tr><td class="label-cell">Compliance Frameworks</td><td>US EPA, EU CSRD / ESRS E1, Norway, Iceland</td></tr>
        <tr><td class="label-cell">Factor Selection</td><td>Best-match algorithm based on activity description, unit type, and region</td></tr>
      </tbody>
    </table>
    <p class="body-text small-text">All emission factors are sourced through the Climatiq API and traceable to their original databases. Factor selection follows a best-match algorithm prioritizing region-specific factors, then falling back to global averages.</p>`;
}

function buildAssumptions(): string {
  const items = [
    "Scope 1, 2, and partial Scope 3 emissions are included per GHG Protocol Corporate Standard.",
    "Embodied carbon covers hardware procurement, construction materials, and infrastructure deployment. It is incurred once in Year 1 only.",
    "Operational carbon covers energy consumption, cooling, and ongoing maintenance. It recurs every year.",
    "In subsequent years (Year 2+), only operational carbon applies.",
    "Emission factors are matched to the closest available region; global averages are used as fallback.",
    "Financial data (spend-based estimates) uses Climatiq monetary emission factors when physical quantities are unavailable.",
    "System boundary includes cradle-to-gate for embodied emissions; gate-to-grave is excluded unless explicitly modeled.",
    "Uncertainty from emission factor matching is reflected in confidence scores but not propagated as error bars.",
  ];
  return `
    <h2 class="section-header"><span class="section-num">10</span>Assumptions & System Boundaries</h2>
    <ul class="assumption-list">${items.map(a => `<li>${a}</li>`).join("")}</ul>`;
}

function buildMethodology(): string {
  return `
    <div class="page-break"></div>
    <h2 class="section-header"><span class="section-num">11</span>Methodology Statement</h2>
    <p class="body-text">This carbon audit has been prepared in accordance with the following standards and methodologies:</p>
    <table class="data-table full">
      <tbody>
        <tr><td class="label-cell">Primary Standard</td><td>GHG Protocol Corporate Accounting and Reporting Standard (Revised Edition)</td></tr>
        <tr><td class="label-cell">Supplementary Standards</td><td>ISO 14064-1:2018, 2026 SCI for AI Standard</td></tr>
        <tr><td class="label-cell">Emission Factor Database</td><td>Climatiq API — aggregating IPCC AR6, EPA eGRID, IEA, DEFRA, ecoinvent, ADEME</td></tr>
        <tr><td class="label-cell">Consolidation</td><td>Operational control approach</td></tr>
        <tr><td class="label-cell">Base Year</td><td>Calendar year of project configuration</td></tr>
        <tr><td class="label-cell">Calculation Approach</td><td>Activity data × emission factor = CO₂e (GWP100, AR6 values)</td></tr>
      </tbody>
    </table>
    <p class="body-text">Emission factors are selected using a best-match algorithm that considers activity description, unit type, geographic region, and temporal relevance. When region-specific factors are unavailable, the system falls back to continental or global averages, with reduced confidence scores.</p>`;
}

function buildFooter(input: ReportPDFInput): string {
  const dateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  return `
    <div class="report-footer">
      <div class="footer-divider"></div>
      <p>This report was generated by <strong>ImpactCheck</strong> in accordance with the GHG Protocol Corporate Standard and the 2026 SCI for AI standard.</p>
      <p>All emission factors are sourced from peer-reviewed, publicly accessible databases via the Climatiq API.</p>
      <p class="footer-brand">ImpactCheck · Carbon Accounting Platform · ${dateStr}</p>
    </div>`;
}

// ─── Styles ───────────────────────────────────────────────────────────

const PDF_STYLES = `
  @page {
    size: A4;
    margin: 24mm 20mm 28mm 20mm;
    @top-right { content: "ImpactCheck — GHG Protocol Report"; font-size: 8px; color: #9ca3af; }
    @bottom-center { content: "Page " counter(page) " of " counter(pages); font-size: 8px; color: #9ca3af; }
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Helvetica Neue', 'Arial', sans-serif; color: #1a1a1a; line-height: 1.6; font-size: 11px; }
  .page-break { page-break-before: always; }

  /* Cover Page */
  .cover-page { display: flex; flex-direction: column; justify-content: space-between; min-height: 100vh; page-break-after: always; }
  .cover-top { display: flex; gap: 8px; flex-wrap: wrap; }
  .cover-badge { display: inline-block; padding: 4px 14px; border-radius: 4px; font-size: 10px; font-weight: 600; letter-spacing: 0.5px; }
  .cover-badge:not(.secondary) { background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; }
  .cover-badge.secondary { background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; }
  .cover-center { flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; padding: 60px 0; }
  .cover-logo { font-size: 16px; font-weight: 800; color: #059669; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 8px; }
  .cover-title { font-size: 36px; font-weight: 800; color: #111827; margin-bottom: 12px; }
  .cover-divider { width: 80px; height: 3px; background: #059669; margin: 16px auto; border-radius: 2px; }
  .cover-project { font-size: 22px; font-weight: 600; color: #374151; margin-bottom: 8px; }
  .cover-meta { font-size: 13px; color: #6b7280; margin-bottom: 32px; }
  .cover-total { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 20px 40px; text-align: center; }
  .cover-total-value { font-size: 42px; font-weight: 800; color: #059669; font-family: 'Courier New', monospace; display: block; }
  .cover-total-unit { font-size: 14px; color: #6b7280; }
  .cover-bottom { border-top: 1px solid #e5e7eb; padding-top: 16px; font-size: 10px; color: #9ca3af; }
  .cover-bottom p { margin-bottom: 4px; }
  .cover-disclaimer { margin-top: 8px; font-style: italic; }

  /* TOC */
  .toc-header { margin-bottom: 24px; }
  .toc { max-width: 500px; }
  .toc-row { display: flex; align-items: baseline; margin-bottom: 6px; font-size: 12px; }
  .toc-num { width: 36px; color: #059669; font-weight: 700; font-family: 'Courier New', monospace; flex-shrink: 0; }
  .toc-label { font-weight: 500; }
  .toc-dots { flex: 1; border-bottom: 1px dotted #d1d5db; margin: 0 8px; min-width: 30px; }

  /* Section headers */
  .section-header { font-size: 18px; font-weight: 700; color: #111827; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 2px solid #059669; }
  .subsection-header { font-size: 14px; font-weight: 700; color: #374151; margin-top: 24px; margin-bottom: 12px; }
  .section-num { color: #059669; font-family: 'Courier New', monospace; margin-right: 8px; }
  .jur-header { font-size: 12px; font-weight: 600; color: #4b5563; margin: 12px 0 6px; }

  /* Body */
  .body-text { font-size: 11px; line-height: 1.7; color: #374151; margin-bottom: 12px; }
  .small-text { font-size: 10px; color: #6b7280; }

  /* Summary grid */
  .summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
  .summary-card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; }
  .summary-card.highlight { background: #f0fdf4; border-color: #a7f3d0; grid-column: span 2; }
  .summary-label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #6b7280; margin-bottom: 4px; }
  .summary-value { font-size: 22px; font-weight: 800; font-family: 'Courier New', monospace; color: #059669; }
  .summary-card:not(.highlight) .summary-value { font-size: 18px; color: #111827; }
  .summary-sub { font-size: 10px; color: #9ca3af; margin-top: 2px; }

  /* Info boxes */
  .info-box { padding: 10px 14px; border-radius: 6px; background: #f0fdf4; border: 1px solid #a7f3d0; font-size: 11px; margin-bottom: 12px; }
  .info-box.warn { background: #fffbeb; border-color: #fde68a; }

  /* Tables */
  .data-table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 16px; }
  .data-table:not(.full) { max-width: 600px; }
  .data-table th { text-align: left; padding: 8px 10px; background: #f9fafb; font-weight: 600; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #4b5563; border-bottom: 2px solid #e5e7eb; }
  .data-table td { padding: 7px 10px; border-bottom: 1px solid #f3f4f6; }
  .data-table.compact td { padding: 5px 10px; }
  .label-cell { font-weight: 600; color: #374151; width: 200px; }
  .num-cell { text-align: right; font-family: 'Courier New', monospace; }
  .num-cell.green { color: #059669; font-weight: 700; }

  /* Phase */
  .phase-cell { font-size: 10px; font-weight: 600; }
  .phase-cell.embodied { color: #d97706; }
  .phase-cell.operational { color: #0284c7; }

  /* Phase bar */
  .phase-bar-container { margin: 16px 0; }
  .phase-bar { display: flex; height: 28px; border-radius: 6px; overflow: hidden; }
  .phase-segment { display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; color: white; }
  .phase-segment.embodied { background: #d97706; }
  .phase-segment.operational { background: #0284c7; }
  .phase-legend { display: flex; gap: 20px; margin-top: 8px; font-size: 10px; color: #6b7280; }
  .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 4px; vertical-align: middle; }
  .dot.embodied { background: #d97706; }
  .dot.operational { background: #0284c7; }

  /* Compliance */
  .compliance-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .compliance-card { padding: 14px; border-radius: 8px; border: 1px solid #e5e7eb; }
  .compliance-card.green { background: #f0fdf4; border-color: #a7f3d0; }
  .compliance-card.yellow { background: #fffbeb; border-color: #fde68a; }
  .compliance-card.red { background: #fef2f2; border-color: #fecaca; }
  .compliance-card h4 { font-size: 13px; font-weight: 700; margin-bottom: 4px; }
  .compliance-status { font-size: 12px; margin-bottom: 6px; }
  .compliance-card ul { font-size: 10px; color: #4b5563; padding-left: 16px; }

  .status-pass { color: #059669; font-weight: 700; font-size: 10px; }
  .status-fail { color: #dc2626; font-weight: 700; font-size: 10px; }
  .status-missing { color: #d97706; font-weight: 700; font-size: 10px; }

  /* Quality bars */
  .quality-bar-container { margin-top: 16px; }
  .quality-row { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; font-size: 10px; }
  .quality-row > span:first-child { width: 140px; color: #6b7280; }
  .quality-row > span:last-child { width: 36px; text-align: right; font-family: 'Courier New', monospace; font-weight: 700; }
  .quality-bar { flex: 1; height: 8px; background: #f3f4f6; border-radius: 4px; overflow: hidden; }
  .quality-fill { height: 100%; background: #059669; border-radius: 4px; }

  /* Lists */
  .gap-list, .assumption-list { padding-left: 18px; font-size: 11px; color: #374151; }
  .gap-list li, .assumption-list li { margin-bottom: 6px; }

  /* Footer */
  .report-footer { margin-top: 48px; padding-top: 16px; font-size: 9px; color: #9ca3af; text-align: center; }
  .footer-divider { width: 100%; height: 1px; background: #e5e7eb; margin-bottom: 12px; }
  .footer-brand { margin-top: 8px; font-weight: 600; }
`;

// ─── Main Generator ───────────────────────────────────────────────────

export function generateReportPDF(input: ReportPDFInput): void {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>ImpactCheck Report — ${input.projectName}</title>
  <style>${PDF_STYLES}</style>
</head>
<body>
  ${buildCoverPage(input)}
  ${buildTOC(input)}
  ${buildExecutiveSummary(input)}
  ${buildBoundaries(input)}
  ${buildEmissionsQuantification(input)}
  ${buildHotspots(input)}
  ${buildCompliance(input)}
  ${buildDataQuality(input)}
  ${buildMissingData(input)}
  ${buildScenarios(input)}
  ${buildTraceability(input)}
  ${buildAssumptions()}
  ${buildMethodology()}
  ${buildFooter(input)}
</body>
</html>`;

  const printWindow = window.open("", "_blank");
  if (!printWindow) return;
  printWindow.document.write(html);
  printWindow.document.close();
  setTimeout(() => {
    printWindow.print();
  }, 600);
}
