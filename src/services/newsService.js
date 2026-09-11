/**
 * newsService.js — Browser-safe news feed service
 * Provides static seed data for the LiveNewsFeed component.
 * Server-side ingestion logic lives in src/server/newsIngestion.mjs
 */

export const INITIAL_NEWS_ITEMS = [
  {
    id: "NWS-001",
    timestamp: "08:42",
    category: "Monetary Policy",
    headline: "Fed holds rates at 5.25%–5.50%, signals two cuts by year-end",
    summary: "FOMC minutes confirm data-dependent stance. Dot plot revised down to two 25bps cuts in 2026, contingent on PCE falling below 2.3%.",
    source: "Bloomberg",
    entities: ["Federal Reserve", "USD", "FOMC"],
    flag: null,
    urgency: "HIGH",
  },
  {
    id: "NWS-002",
    timestamp: "08:31",
    category: "AML Compliance",
    headline: "FATF grey-lists three jurisdictions in updated plenary report",
    summary: "UAE, Jordan, and Namibia face enhanced monitoring. Cross-border flows through Cayman and British Virgin Islands flagged for additional correspondent banking scrutiny.",
    source: "FATF",
    entities: ["AE", "KY", "FATF"],
    flag: "Compliance Alert",
    urgency: "CRITICAL",
  },
  {
    id: "NWS-003",
    timestamp: "08:15",
    category: "Corporate Action",
    headline: "Jio Financial Services JV with BlackRock receives SEBI approval",
    summary: "The ₹3,600 Cr joint venture asset management entity has received conditional regulatory clearance from SEBI. Operations expected to commence Q1 2027.",
    source: "Reuters",
    entities: ["JIO-IN", "BLACKROCK-US", "SEBI"],
    flag: null,
    urgency: "MEDIUM",
  },
  {
    id: "NWS-004",
    timestamp: "08:02",
    category: "Clearing Rails",
    headline: "SWIFT gpi achieves 94% same-day settlement rate across G20 corridors",
    summary: "Cross-border payment latency falls to sub-4-hour average. SEPA Instant and FedNow integration milestones accelerate adoption across AE–IN–US corridors.",
    source: "SWIFT",
    entities: ["JPM-US", "DB-DE", "SWIFT"],
    flag: null,
    urgency: "LOW",
  },
  {
    id: "NWS-005",
    timestamp: "07:55",
    category: "Monetary Policy",
    headline: "ECB unexpectedly cuts deposit rate by 25bps to 3.50%",
    summary: "Governing Council cites slowing Eurozone CPI at 2.1% and deteriorating PMI data. EUR/USD moves to 1.0812 on the news.",
    source: "ECB",
    entities: ["EUR", "ECB", "BNP-FR", "DB-DE"],
    flag: null,
    urgency: "HIGH",
  },
  {
    id: "NWS-006",
    timestamp: "07:44",
    category: "AML Compliance",
    headline: "FinCEN issues SAR guidance on digital asset bridge transactions",
    summary: "New advisory requires enhanced due diligence for transactions routing through non-custodial bridges exceeding $10,000. Institutions have 90 days to comply.",
    source: "FinCEN",
    entities: ["USD", "FinCEN", "TPAY-SG"],
    flag: "Regulatory Notice",
    urgency: "HIGH",
  },
  {
    id: "NWS-007",
    timestamp: "07:30",
    category: "Commodities",
    headline: "Gold surges 1.4% to $2,418/oz amid USD weakness and geopolitical tension",
    summary: "XAU/USD breaks above $2,400 resistance for first time in six weeks. ETF inflows of $1.2B recorded in 48 hours. Goldman Sachs raises 12-month target to $2,700.",
    source: "Bloomberg",
    entities: ["GS-US", "XAU", "USD"],
    flag: null,
    urgency: "MEDIUM",
  },
  {
    id: "NWS-008",
    timestamp: "07:12",
    category: "Corporate Action",
    headline: "Deutsche Bank acquires 15% stake in Orion Capital Fund LP via secondary market",
    summary: "The acquisition values Orion Capital at approximately $890M. DB cites diversification into alternative assets and Cayman-domiciled fund structures.",
    source: "FT",
    entities: ["DB-DE", "ORION-KY"],
    flag: "High Exposure",
    urgency: "HIGH",
  },
  {
    id: "NWS-009",
    timestamp: "06:58",
    category: "Clearing Rails",
    headline: "RBI mandates real-time SWIFT message validation for all NOSTRO accounts above ₹50Cr",
    summary: "Effective December 1, 2026. SBI and ICICI Bank given extended timeline to Q1 2027. Correspondent accounts with Cayman or BVI domicile require enhanced documentation.",
    source: "RBI",
    entities: ["SBI-IN", "ICICI-IN", "INR"],
    flag: "Regulatory Notice",
    urgency: "MEDIUM",
  },
  {
    id: "NWS-010",
    timestamp: "06:40",
    category: "Monetary Policy",
    headline: "Bank of Japan maintains YCC policy but widens 10Y JGB band to ±1.25%",
    summary: "Surprise tweak sparks ¥12T bond market repricing. USD/JPY falls 0.8% to 142.30. MUFG and Norinchukin face MTM losses on domestic fixed-income books.",
    source: "Bloomberg",
    entities: ["JPY", "MUFG-JP", "BOJ"],
    flag: null,
    urgency: "HIGH",
  },
];

/**
 * Client-safe fetch wrapper — pulls live news from the backend if available,
 * otherwise returns the static seed data above.
 */
export async function fetchLiveNews() {
  try {
    const res = await fetch("/api/v1/news");
    if (!res.ok) throw new Error("Server unavailable");
    return await res.json();
  } catch {
    return INITIAL_NEWS_ITEMS;
  }
}

/**
 * fetchMacroNews — server-side synchronous alias used by superSearchService.
 */
export function fetchMacroNews() {
  return INITIAL_NEWS_ITEMS;
}

