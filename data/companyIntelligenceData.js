// Comprehensive Company Intelligence & Risk Scoring Knowledge Base

export const companyIntelligenceDb = {
  "Q312": { // Apple Inc.
    id: "Q312",
    name: "Apple Inc.",
    ticker: "AAPL",
    entity_type: "Corporation",
    jurisdiction: "United States (US)",
    country: "US",
    industry: "Consumer Electronics & Digital Platforms",
    headquarters: "Cupertino, California, USA",
    incorporation_date: "1977-01-03",
    lei: "HWUPKR0MPOU8FGXBT394",
    employee_count: 161000,
    market_cap: "$3.42T",
    risk_score: 73,
    risk_confidence: 0.94,
    risk_last_updated: "Updated 2 hours ago",
    verification: {
      status: "Verified",
      sources: ["SEC EDGAR (10-K/10-Q)", "Bloomberg Terminal", "OpenCorporates"],
      count: 3,
      confidence_pct: 98,
    },
    metrics_30d: {
      volume_change: "+34% (Spike)",
      new_connections: 3,
      regulatory_flags: 1,
      board_changes: 2,
      transaction_volume_90d: 34200000000,
      transaction_count_90d: 487,
    },
    risk_drivers: [
      { category: "Regulatory", points: 25, explanation: "US DOJ & EU DMA antitrust compliance investigation", severity: "critical", source: "SEC / DOJ" },
      { category: "Transaction", points: 20, explanation: "$2.3B capital outflow to offshore subsidiaries (Cayman/Ireland)", severity: "critical", source: "SWIFT pacs.008" },
      { category: "Counterparty", points: 15, explanation: "3 tier-2 electronic suppliers located in FATF-monitored jurisdictions", severity: "elevated", source: "Supply Chain Matrix" },
      { category: "Financial", points: -10, explanation: "Operating cash flow strong (+$110B TTM, low leverage ratio)", severity: "standard", source: "10-K Audit" },
      { category: "Reputational", points: 23, explanation: "Negative media sentiment surrounding global digital service taxation", severity: "elevated", source: "Bloomberg News Wire" },
    ],
    ownership_tree: [
      { name: "BlackRock Institutional Trust Co.", stake: 51.2, layer: 1, type: "Institutional Asset Manager" },
      { name: "The Vanguard Group, Inc.", stake: 8.4, layer: 1, type: "Mutual Fund Sponsor" },
      { name: "State Street Global Advisors", stake: 3.8, layer: 1, type: "Custody & Asset Management" },
      { name: "Berkshire Hathaway Inc.", stake: 2.9, layer: 1, type: "Conglomerate Holding" },
      { name: "Retail & Free Float Public Holders", stake: 33.7, layer: 1, type: "Public Market" },
    ],
    board_members: [
      { name: "Tim Cook", title: "Chief Executive Officer & Director", tenure_years: 13, is_new: false, previous: "Compaq, Intelligent Electronics" },
      { name: "Kevan Parekh", title: "Chief Financial Officer", tenure_years: 0.2, is_new: true, alert: "New CFO appointed Sept 2024", previous: "Thomson Reuters, GM" },
      { name: "Arthur D. Levinson", title: "Independent Chairman", tenure_years: 14, is_new: false, previous: "Genentech, Roche" },
      { name: "Al Gore", title: "Senior Director", tenure_years: 21, is_new: false, previous: "Generation Investment Management" },
      { name: "Andrea Jung", title: "Director", tenure_years: 16, is_new: false, previous: "Avon Products, Grameen America" },
    ],
    recent_signals: [
      { id: "sig-1", type: "regulatory", icon: "⚠️", title: "SEC 10-Q Quarterly Filing Submitted", detail: "Disclosed material antitrust exposure and supply corridor adaptations in EMEA.", time: "3 hours ago" },
      { id: "sig-2", type: "news", icon: "📰", title: "Regulatory Scrutiny in APAC Corridors", detail: "Antitrust inquiry launched regarding App Store digital payment fees.", time: "1 day ago" },
      { id: "sig-3", type: "transaction", icon: "💰", title: "$500M Direct Equity Transfer to Ireland Subsidiary", detail: "Settled via SWIFT pacs.008 to Apple Operations International Ltd.", time: "1 day ago" },
      { id: "sig-4", type: "personnel", icon: "👥", title: "Executive Leadership Transition (CFO)", detail: "Kevan Parekh officially succeeded Luca Maestri as Chief Financial Officer.", time: "2 days ago" },
      { id: "sig-5", type: "alert", icon: "🚨", title: "High-Risk Tier-2 Supplier Detected", detail: "Corridor check flagged new semiconductor component supplier in SEA freezone.", time: "3 days ago" },
    ],
    connections_summary: {
      suppliers: { total: 1247, flagged: 312 },
      partners: { total: 89, flagged: 2 },
      investors: { total: 12, flagged: 0 },
      regulators: { total: 8, flagged: 3 },
      competitors: { total: 23, flagged: 0 },
    },
    timeline_events: [
      { date: "2024-10-15", title: "Acquisition of Photonic AI IP", type: "acquisition", volume: "$1.2B" },
      { date: "2025-03-20", title: "EU Digital Markets Act Compliance Audit", type: "regulatory", volume: "—" },
      { date: "2025-09-12", title: "Global Supply Chain Reorganization", type: "supply", volume: "$4.5B" },
      { date: "2026-02-18", title: "Offshore Treasury Capital Repatriation", type: "transaction", volume: "$8.4B" },
      { date: "2026-08-29", title: "New European R&D Center Capital Injection", type: "equity", volume: "$500M" },
    ],
  },
  "BLACKROCK-US": {
    id: "BLACKROCK-US",
    name: "BlackRock, Inc.",
    ticker: "BLK",
    entity_type: "FinancialInstitution",
    jurisdiction: "United States (US)",
    country: "US",
    industry: "Global Investment Management & Financial Technology",
    headquarters: "New York, NY, USA",
    incorporation_date: "1988-01-01",
    lei: "549300V52G8C7G32T377",
    employee_count: 19800,
    market_cap: "$142B / $10.5T AUM",
    risk_score: 15,
    risk_confidence: 0.98,
    risk_last_updated: "Updated 1 hour ago",
    verification: {
      status: "Verified",
      sources: ["SEC Form ADV / 13F", "Federal Reserve Board", "FINRA"],
      count: 3,
      confidence_pct: 99,
    },
    metrics_30d: {
      volume_change: "+18%",
      new_connections: 5,
      regulatory_flags: 0,
      board_changes: 0,
      transaction_volume_90d: 125000000000,
      transaction_count_90d: 1420,
    },
    risk_drivers: [
      { category: "Financial", points: -20, explanation: "Institutional capital base $10.5T AUM, AAA liquidity tier", severity: "standard", source: "Federal Reserve" },
      { category: "Regulatory", points: -10, explanation: "Primary dealer clearing compliance fully verified", severity: "standard", source: "SEC / FRB" },
      { category: "Counterparty", points: 5, explanation: "APAC joint venture cross-border capital deployment (Jio-BlackRock)", severity: "standard", source: "RBI Filings" },
    ],
    ownership_tree: [
      { name: "PNC Financial Services Group", stake: 22.0, layer: 1, type: "Bank Holding Co." },
      { name: "Institutional & Index Shareholders", stake: 68.0, layer: 1, type: "Public Float" },
      { name: "Executive & Employee Trusts", stake: 10.0, layer: 1, type: "Insider Pool" },
    ],
    board_members: [
      { name: "Laurence D. Fink", title: "Chairman & CEO", tenure_years: 36, is_new: false, previous: "First Boston" },
      { name: "Robert S. Kapito", title: "President", tenure_years: 36, is_new: false, previous: "First Boston" },
      { name: "Murry S. Gerber", title: "Lead Independent Director", tenure_years: 18, is_new: false, previous: "EQT Corporation" },
    ],
    recent_signals: [
      { id: "blk-1", type: "equity", icon: "🤝", title: "$300M Jio-BlackRock JV Capital Injection Executed", detail: "Settled via SWIFT into Jio Financial Services Mumbai custody accounts.", time: "1 day ago" },
      { id: "blk-2", type: "regulatory", icon: "📋", title: "13F Institutional Holdings Filing Update", detail: "Increased strategic allocations in APAC digital infrastructure and semiconductor sectors.", time: "3 days ago" },
    ],
    connections_summary: {
      suppliers: { total: 420, flagged: 0 },
      partners: { total: 240, flagged: 1 },
      investors: { total: 85, flagged: 0 },
      regulators: { total: 14, flagged: 0 },
      competitors: { total: 18, flagged: 0 },
    },
    timeline_events: [
      { date: "2024-07-26", title: "Announcement of Jio-BlackRock Digital Lending Venture", type: "jv", volume: "$300M" },
      { date: "2025-01-14", title: "Expansion of Global Infrastructure Partners Integration", type: "acquisition", volume: "$12.5B" },
      { date: "2026-08-29", title: "Capital Injection to Indian Institutional Partner", type: "equity", volume: "$300M" },
    ],
  },
  "JIO-IN": {
    id: "JIO-IN",
    name: "Jio Financial Services Ltd. (JFS)",
    ticker: "JIOFIN.NS",
    entity_type: "FinancialInstitution",
    jurisdiction: "India (IN)",
    country: "IN",
    industry: "Digital Lending, Asset Management & Payments",
    headquarters: "Bandra Kurla Complex, Mumbai, India",
    incorporation_date: "1999-07-22",
    lei: "335800JIOFINANCIAL01",
    employee_count: 8500,
    market_cap: "$28.4B",
    risk_score: 22,
    risk_confidence: 0.96,
    risk_last_updated: "Updated 45 mins ago",
    verification: {
      status: "Verified",
      sources: ["Reserve Bank of India (RBI)", "SEBI", "BSE / NSE Filings"],
      count: 3,
      confidence_pct: 98,
    },
    metrics_30d: {
      volume_change: "+42%",
      new_connections: 4,
      regulatory_flags: 0,
      board_changes: 1,
      transaction_volume_90d: 4500000000,
      transaction_count_90d: 310,
    },
    risk_drivers: [
      { category: "Financial", points: -15, explanation: "Debt-free capital structure backed by parent conglomerate Reliance", severity: "standard", source: "SEBI Filing" },
      { category: "Regulatory", points: -8, explanation: "Core investment company (CIC) conversion approved by RBI", severity: "standard", source: "RBI Gazette" },
      { category: "Transaction", points: 5, explanation: "High volume rapid interbank clearing via UPI / NEFT settlement rails", severity: "standard", source: "NPCI Stream" },
    ],
    ownership_tree: [
      { name: "Reliance Industries Ltd. (Promoter Group)", stake: 47.1, layer: 1, type: "Conglomerate Holding" },
      { name: "Public & Institutional Shareholders", stake: 35.2, layer: 1, type: "Public Float" },
      { name: "Foreign Portfolio Investors (FPI)", stake: 17.7, layer: 1, type: "Institutional FPI" },
    ],
    board_members: [
      { name: "Hitesh Sethia", title: "Managing Director & CEO", tenure_years: 2.5, is_new: false, previous: "ICICI Bank UK" },
      { name: "KV Kamath", title: "Independent Director & Non-Executive Chairman", tenure_years: 2.8, is_new: false, previous: "ICICI Bank, NDB" },
      { name: "Isha Ambani", title: "Non-Executive Director", tenure_years: 2.5, is_new: false, previous: "Reliance Retail" },
    ],
    recent_signals: [
      { id: "jfs-1", type: "equity", icon: "💰", title: "$300M Inflow from BlackRock JV Partnership", detail: "Allocated toward SEBI asset management license capitalization.", time: "1 day ago" },
      { id: "jfs-2", type: "transaction", icon: "⚡", title: "₹4,500 Cr Treasury Deployment via RTGS", detail: "Internal treasury settlement with State Bank of India clearing desk.", time: "2 days ago" },
    ],
    connections_summary: {
      suppliers: { total: 180, flagged: 0 },
      partners: { total: 45, flagged: 0 },
      investors: { total: 32, flagged: 0 },
      regulators: { total: 4, flagged: 0 },
      competitors: { total: 12, flagged: 0 },
    },
    timeline_events: [
      { date: "2023-08-21", title: "Demerger and Public Listing on NSE/BSE", type: "ipo", volume: "$20B" },
      { date: "2024-04-15", title: "50:50 Joint Venture Formation with BlackRock", type: "jv", volume: "$300M" },
      { date: "2026-08-29", title: "Cross-Border Wealth Management Desk Launch", type: "expansion", volume: "$500M" },
    ],
  },
  "HARBOR-AE": {
    id: "HARBOR-AE",
    name: "Harbor Trading FZE",
    ticker: "PRIVATE",
    entity_type: "ShellCompany",
    jurisdiction: "United Arab Emirates (AE) - Free Zone",
    country: "AE",
    industry: "General Trading & Commodity Intermediary",
    headquarters: "Hamriyah Free Zone, Sharjah, UAE",
    incorporation_date: "2022-11-14",
    lei: "549300HARB0RTRADE99",
    employee_count: 14,
    market_cap: "Private ($1.4B Flow)",
    risk_score: 92,
    risk_confidence: 0.91,
    risk_last_updated: "Updated 10 mins ago",
    verification: {
      status: "Unverified / Flagged",
      sources: ["OpenCorporates AE", "OFAC Cross-Check"],
      count: 2,
      confidence_pct: 64,
    },
    metrics_30d: {
      volume_change: "+210% (Extreme Spike)",
      new_connections: 6,
      regulatory_flags: 4,
      board_changes: 2,
      transaction_volume_90d: 1400000000,
      transaction_count_90d: 48,
    },
    risk_drivers: [
      { category: "Sanctions Proximity", points: 35, explanation: "Direct correspondent transfer link with NordEast OÜ (designated PEP corridor)", severity: "critical", source: "OFAC SDN Radar" },
      { category: "Jurisdiction", points: 25, explanation: "Offshore freezone structure with undisclosed beneficial ownership (UBO)", severity: "critical", source: "FATF Greylist" },
      { category: "Transaction Anomaly", points: 22, explanation: "Volume velocity Z-score = 3.8 ($12.4M rapid pass-through in <4 minutes)", severity: "critical", source: "AML Engine" },
      { category: "Reputational", points: 10, explanation: "Entities sharing registered agent subject to asset freeze orders", severity: "elevated", source: "EU Sanctions Portal" },
    ],
    ownership_tree: [
      { name: "Nominee Director Services Ltd. (BVI)", stake: 100.0, layer: 1, type: "Nominee Trust" },
      { name: "Undisclosed Ultimate Beneficial Owner", stake: 100.0, layer: 2, type: "Hidden UBO" },
    ],
    board_members: [
      { name: "Dmitri V. Morozov", title: "Managing Director", tenure_years: 0.8, is_new: true, alert: "PEP association flagged", previous: "Baltic Freight Services" },
      { name: "Apex Nominee Corp", title: "Corporate Secretary", tenure_years: 2.0, is_new: false, previous: "Secrecy Jurisdiction Registry" },
    ],
    recent_signals: [
      { id: "hb-1", type: "alert", icon: "🚨", title: "Critical Sanctions Proximity Alert Triggered", detail: "Received $12.40M USD transfer from NordEast Commerce OÜ without trade invoice verification.", time: "12 mins ago" },
      { id: "hb-2", type: "regulatory", icon: "⚠️", title: "Correspondent Bank Clearing Hold Issued", detail: "JPMorgan Chase compliance desk placed temporary settlement block.", time: "25 mins ago" },
    ],
    connections_summary: {
      suppliers: { total: 14, flagged: 9 },
      partners: { total: 6, flagged: 4 },
      investors: { total: 1, flagged: 1 },
      regulators: { total: 2, flagged: 2 },
      competitors: { total: 0, flagged: 0 },
    },
    timeline_events: [
      { date: "2022-11-14", title: "Entity Incorporation in Free Zone", type: "incorporation", volume: "—" },
      { date: "2024-05-10", title: "Rapid Inflow Scaling from Baltic Corridors", type: "anomaly", volume: "$450M" },
      { date: "2026-08-29", title: "High-Risk Corridor Interception", type: "alert", volume: "$12.4M" },
    ],
  },
};

// Fallback generator for any other node id
export function getCompanyIntelligence(entityId, name = "Target Company", country = "US", kind = "Company") {
  if (companyIntelligenceDb[entityId]) {
    return companyIntelligenceDb[entityId];
  }

  const isHighRisk = entityId.includes("HARBOR") || entityId.includes("ORION") || entityId.includes("NORD");
  const riskScore = isHighRisk ? 88 : 25;

  return {
    id: entityId,
    name: name,
    ticker: entityId.replace(/[^A-Z]/g, "").slice(0, 4) || "CO",
    entity_type: isHighRisk ? "ShellCompany" : kind === "FinancialInstitution" ? "FinancialInstitution" : "Corporation",
    jurisdiction: `${country} Jurisdiction`,
    country: country,
    industry: isHighRisk ? "Offshore Trading & Holdings" : "Commercial Industry & Enterprise",
    headquarters: `${country} Corporate Center`,
    incorporation_date: "2012-04-10",
    lei: `549300${entityId.replace(/[^A-Z0-9]/g, "").padEnd(14, "0").slice(0, 14)}`,
    employee_count: isHighRisk ? 32 : 45000,
    market_cap: isHighRisk ? "$1.2B Flows" : "$48.0B",
    risk_score: riskScore,
    risk_confidence: 0.88,
    risk_last_updated: "Updated 1 hour ago",
    verification: {
      status: isHighRisk ? "Flagged / Verification Required" : "Verified",
      sources: isHighRisk ? ["OpenCorporates Registry", "PEP Watchlist"] : ["SEC EDGAR", "Bloomberg Data", "Regulatory Registry"],
      count: isHighRisk ? 2 : 3,
      confidence_pct: isHighRisk ? 68 : 95,
    },
    metrics_30d: {
      volume_change: isHighRisk ? "+88% (Velocity Spike)" : "+12%",
      new_connections: isHighRisk ? 4 : 2,
      regulatory_flags: isHighRisk ? 3 : 0,
      board_changes: 1,
      transaction_volume_90d: isHighRisk ? 1200000000 : 18500000000,
      transaction_count_90d: isHighRisk ? 45 : 340,
    },
    risk_drivers: isHighRisk ? [
      { category: "Sanctions Proximity", points: 30, explanation: "Correspondent link with designated PEP entity corridor", severity: "critical", source: "OFAC Watchlist" },
      { category: "Jurisdiction", points: 20, explanation: `Offshore intermediary registered in high-secrecy zone (${country})`, severity: "critical", source: "FATF Report" },
      { category: "Transaction", points: 18, explanation: "Rapid multi-hop funds pass-through detected in <10m", severity: "elevated", source: "SWIFT Anomaly" },
    ] : [
      { category: "Financial", points: -10, explanation: "Solvent capital reserves and investment grade ratings", severity: "standard", source: "Credit Ratings" },
      { category: "Regulatory", points: -5, explanation: "Periodic regulatory disclosures filed on schedule", severity: "standard", source: "Statutory Registry" },
    ],
    ownership_tree: [
      { name: `${name} Principal Holdings`, stake: 60.0, layer: 1, type: "Parent Holding" },
      { name: "Public & Institutional Shareholders", stake: 40.0, layer: 1, type: "Public Market" },
    ],
    board_members: [
      { name: "Managing Executive", title: "Chief Executive Officer", tenure_years: 4.5, is_new: false, previous: "International Conglomerate" },
      { name: "Chief Financial Officer", title: "Head of Treasury", tenure_years: 1.2, is_new: false, previous: "Tier 1 Banking Group" },
    ],
    recent_signals: [
      { id: `${entityId}-sig-1`, type: isHighRisk ? "alert" : "filing", icon: isHighRisk ? "🚨" : "📄", title: isHighRisk ? "High-Risk Correspondent Route Detected" : "Regulatory Filing Confirmed", detail: `Monitored active transfer volumes across ${country} corridor.`, time: "2 hours ago" },
      { id: `${entityId}-sig-2`, type: "transaction", icon: "💰", title: "Commercial Settlement Cleared", detail: "Transaction stream processed via standard payment rail.", time: "1 day ago" },
    ],
    connections_summary: {
      suppliers: { total: isHighRisk ? 12 : 380, flagged: isHighRisk ? 5 : 4 },
      partners: { total: isHighRisk ? 8 : 45, flagged: isHighRisk ? 3 : 0 },
      investors: { total: isHighRisk ? 2 : 18, flagged: 0 },
      regulators: { total: isHighRisk ? 2 : 5, flagged: isHighRisk ? 2 : 0 },
      competitors: { total: 10, flagged: 0 },
    },
    timeline_events: [
      { date: "2024-01-10", title: "Corporate Registration", type: "incorporation", volume: "—" },
      { date: "2025-06-15", title: "Capital Facility Expansion", type: "equity", volume: "$250M" },
      { date: "2026-08-29", title: "Live Network Monitoring Node Active", type: "monitoring", volume: "—" },
    ],
  };
}

// Generate complete, high-fidelity corporate graph payload for any entity
export function generateCompanyNetworkGraph(entityId) {
  const normId = entityId.replace(/^wikidata_/, "");
  const intel = getCompanyIntelligence(normId in companyIntelligenceDb ? normId : entityId);
  const actualId = intel.id || entityId;

  const centerNode = {
    id: actualId,
    name: intel.name,
    label: intel.name,
    jurisdiction: intel.country || "US",
    category: intel.entity_type || "Corporation",
    risk_score: intel.risk_score || 25,
    intel: intel,
    baseRadius: 15,
  };

  const nodes = [centerNode];
  const relationships = [];
  const seenNodeIds = new Set([actualId]);

  // 1. Add Ownership Tree Nodes & Edges
  if (Array.isArray(intel.ownership_tree)) {
    intel.ownership_tree.forEach((owner, idx) => {
      const ownerId = `owner-${actualId}-${idx}`;
      if (!seenNodeIds.has(ownerId)) {
        seenNodeIds.add(ownerId);
        nodes.push({
          id: ownerId,
          name: owner.name,
          label: owner.name,
          category: owner.type || "Institution",
          jurisdiction: intel.country || "US",
          risk_score: Math.max(10, (intel.risk_score || 25) - 10),
          intel: getCompanyIntelligence(ownerId, owner.name, intel.country, owner.type),
          baseRadius: owner.stake > 30 ? 12 : 9,
        });
      }
      relationships.push({
        id: `rel-own-${actualId}-${idx}`,
        source: ownerId,
        target: actualId,
        type: "OWNS",
        label: "Owns",
        ownership_percentage: owner.stake,
        amount_total: (owner.stake / 100) * (intel.metrics_30d?.transaction_volume_90d || 1e9),
        confidence: 0.95,
        is_current: true,
        last_transaction: "2026-08-29",
      });
    });
  }

  // 2. Add Board Member / Officer Nodes & Edges
  if (Array.isArray(intel.board_members)) {
    intel.board_members.forEach((officer, idx) => {
      const officerId = `officer-${actualId}-${idx}`;
      if (!seenNodeIds.has(officerId)) {
        seenNodeIds.add(officerId);
        nodes.push({
          id: officerId,
          name: officer.name,
          label: officer.name,
          category: "Person",
          jurisdiction: intel.country || "US",
          risk_score: officer.is_new ? 45 : 15,
          intel: getCompanyIntelligence(officerId, officer.name, intel.country, "Executive"),
          baseRadius: 7,
        });
      }
      relationships.push({
        id: `rel-off-${actualId}-${idx}`,
        source: officerId,
        target: actualId,
        type: "OFFICER_AT",
        label: "Officer At",
        officer_title: officer.title,
        confidence: 0.98,
        is_current: true,
        last_transaction: "2026-08-29",
      });
    });
  }

  // 3. Add Strategic Partner / Interbank Corridors (Special case integrations)
  if (actualId === "BLK-US" || normId === "BLK-US") {
    const partnerId = "JIO-IN";
    if (!seenNodeIds.has(partnerId)) {
      seenNodeIds.add(partnerId);
      const jioIntel = getCompanyIntelligence("JIO-IN");
      nodes.push({
        id: partnerId,
        name: jioIntel.name,
        label: jioIntel.name,
        category: jioIntel.entity_type,
        jurisdiction: jioIntel.country,
        risk_score: jioIntel.risk_score,
        intel: jioIntel,
        baseRadius: 13,
      });
    }
    relationships.push({
      id: `rel-jv-${actualId}-jio`,
      source: actualId,
      target: partnerId,
      type: "OWNS",
      label: "Joint Venture Partner (50:50)",
      amount_total: 300000000,
      confidence: 0.99,
      is_current: true,
      last_transaction: "2026-08-29",
    });
  } else if (actualId === "JIO-IN" || normId === "JIO-IN") {
    const parentId = "RELIANCE-IN";
    if (!seenNodeIds.has(parentId)) {
      seenNodeIds.add(parentId);
      const relIntel = getCompanyIntelligence("RELIANCE-IN");
      nodes.push({
        id: parentId,
        name: relIntel.name,
        label: relIntel.name,
        category: relIntel.entity_type,
        jurisdiction: relIntel.country,
        risk_score: relIntel.risk_score,
        intel: relIntel,
        baseRadius: 14,
      });
    }
    relationships.push({
      id: `rel-promoter-${actualId}-reliance`,
      source: parentId,
      target: actualId,
      type: "OWNS",
      label: "Promoter Group (47.1%)",
      amount_total: 12500000000,
      confidence: 0.99,
      is_current: true,
      last_transaction: "2026-08-29",
    });
  }

  return {
    center: {
      entity_id: actualId,
      name: intel.name,
      category: intel.entity_type,
      jurisdiction: intel.country,
      risk_score: intel.risk_score,
    },
    nodes: nodes,
    relationships: relationships,
    summary: {
      total_nodes: nodes.length,
      total_relationships: relationships.length,
      companies: nodes.filter((n) => n.category !== "Person").length,
      people: nodes.filter((n) => n.category === "Person").length,
      subsidiaries: relationships.filter((r) => r.type === "HAS_SUBSIDIARY").length,
      jurisdictions: new Set(nodes.map((n) => n.jurisdiction)).size,
      flagged_nodes: nodes.filter((n) => (n.risk_score || 0) >= 60).length,
    },
    depth: 1,
  };
}

// -------------------------------------------------------------------------
// Bloomberg SPLC (Supply Chain & Value Flow) Data Generator
// -------------------------------------------------------------------------
export function getSPLCSupplyChainData(entityId) {
  const intel = getCompanyIntelligence(entityId);
  const actualId = intel.id;

  if (actualId === "Q312" || actualId === "AAPL" || actualId.startsWith("wikidata_Q312")) {
    return {
      entity: {
        id: "Q312",
        name: "APPLE INC",
        ticker: "AAPL US",
        price: "$232.40",
        price_change: "+0.84%",
        cogs_quantified: "94.52%",
        cogs_proprietary: "94.52%",
        rev_quantified: "42.20%",
        rev_proprietary: "42.20%",
        capex_quantified: "6.78%",
        sga_quantified: "3.64%",
        rd_quantified: "0.00%",
        supplier_count: 247,
        customer_count: 141,
        peer_count: 15,
        risk_score: 73,
      },
      suppliers: [
        { id: "HONHAI-TW", name: "HON HAI PRECISIO", ticker: "2317 TT", rev_pct: 47.77, cogs_pct: 55.73, metric_type: "COGS", risk: "standard", country: "TW", category: "Assembly & Manufacturing" },
        { id: "PEGATRON-TW", name: "PEGATRON CORP", ticker: "4938 TT", rev_pct: 35.19, cogs_pct: 18.42, metric_type: "COGS", risk: "standard", country: "TW", category: "Contract Assembly" },
        { id: "TSMC-TW", name: "TAIWAN SEMICON", ticker: "2330 TT", rev_pct: 25.40, cogs_pct: 8.90, metric_type: "COGS", risk: "standard", country: "TW", category: "Leading-Edge Silicon Foundry" },
        { id: "SAMSUNG-KR", name: "SAMSUNG ELECTRON", ticker: "005930 KS", rev_pct: 1.87, cogs_pct: 2.88, metric_type: "COGS", risk: "standard", country: "KR", category: "OLED & DRAM" },
        { id: "JABIL-US", name: "JABIL CIRCUIT", ticker: "JBL US", rev_pct: 13.00, cogs_pct: 2.61, metric_type: "COGS", risk: "standard", country: "US", category: "Enclosures & Casings" },
        { id: "FLEX-SG", name: "FLEXTRONICS INTL", ticker: "FLEX US", rev_pct: 8.18, cogs_pct: 2.45, metric_type: "COGS", risk: "standard", country: "SG", category: "Component SMT" },
        { id: "DAIKIN-JP", name: "DAIKIN INDS", ticker: "6367 JP", rev_pct: 1.39, cogs_pct: 2.11, metric_type: "CAPEX", risk: "standard", country: "JP", category: "Cleanroom & Thermal" },
        { id: "TERADYNE-US", name: "TERADYNE INC", ticker: "TER US", rev_pct: 10.00, cogs_pct: 1.78, metric_type: "CAPEX", risk: "standard", country: "US", category: "Automated Testing" },
        { id: "ELECTRO-US", name: "ELECTRO SCI INDS", ticker: "ESIO US", rev_pct: 29.00, cogs_pct: 1.42, metric_type: "CAPEX", risk: "critical", country: "US", category: "Laser Micromachining" },
        { id: "HITACHI-JP", name: "HITACHI LTD", ticker: "6501 JP", rev_pct: 1.59, cogs_pct: 1.24, metric_type: "COGS", risk: "standard", country: "JP", category: "High-Purity Chemicals" },
        { id: "BROADCOM-US", name: "BROADCOM CORP-A", ticker: "AVGO US", rev_pct: 58.60, cogs_pct: 1.22, metric_type: "COGS", risk: "standard", country: "US", category: "RF & Wireless Front-End" },
        { id: "GOOGL-US", name: "GOOGLE INC-CL A", ticker: "GOOGL US", rev_pct: 0.30, cogs_pct: 1.13, metric_type: "SG&A", risk: "critical", country: "US", category: "Cloud & Search Routing" },
        { id: "SHARP-JP", name: "SHARP CORP", ticker: "6753 JP", rev_pct: 5.36, cogs_pct: 1.05, metric_type: "COGS", risk: "standard", country: "JP", category: "Camera Sensor Modules" },
        { id: "SKHYNIX-KR", name: "SK HYNIX INC", ticker: "000660 KS", rev_pct: 9.28, cogs_pct: 0.92, metric_type: "COGS", risk: "standard", country: "KR", category: "High-Bandwidth Memory" },
        { id: "PANASONIC-JP", name: "PANASONIC CORP", ticker: "6752 JP", rev_pct: 1.33, cogs_pct: 0.88, metric_type: "COGS", risk: "critical", country: "JP", category: "Battery Cells & Optics" },
      ],
      customers: [
        { id: "VERIZON-US", name: "VERIZON COMMUNIC", ticker: "VZ US", rev_pct: 8.61, cogs_pct: 35.92, risk: "standard", country: "US", channel: "Tier-1 Telco Carrier" },
        { id: "ATT-US", name: "AT&T INC", ticker: "T US", rev_pct: 8.21, cogs_pct: 32.43, risk: "critical", country: "US", channel: "Tier-1 Telco Carrier" },
        { id: "SPRINT-US", name: "SPRINT NEXTEL CO", ticker: "TMUS US", rev_pct: 2.58, cogs_pct: 24.84, risk: "critical", country: "US", channel: "Wireless Network" },
        { id: "VODAFONE-GB", name: "VODAFONE GROUP", ticker: "VOD LN", rev_pct: 2.40, cogs_pct: 8.90, risk: "standard", country: "GB", channel: "Pan-European Telecom" },
        { id: "CHINATEL-HK", name: "CHINA TELECOM-H", ticker: "728 HK", rev_pct: 1.83, cogs_pct: 7.78, risk: "standard", country: "HK", channel: "State Telecom Provider" },
        { id: "TELEFONICA-ES", name: "TELEFONICA", ticker: "TEF SM", rev_pct: 1.81, cogs_pct: 5.80, risk: "standard", country: "ES", channel: "Iberian / LatAm Telco" },
        { id: "CHINAUNICOM-HK", name: "CHINA UNICOM HON", ticker: "762 HK", rev_pct: 1.71, cogs_pct: 8.29, risk: "critical", country: "HK", channel: "Mobile Carrier" },
        { id: "DTE-DE", name: "DEUTSCHE TELEKOM", ticker: "DTE GY", rev_pct: 1.58, cogs_pct: 7.85, risk: "standard", country: "DE", channel: "German / US T-Mobile" },
        { id: "ORANGE-FR", name: "FRANCE TELECOM", ticker: "ORA FP", rev_pct: 1.24, cogs_pct: 5.52, risk: "critical", country: "FR", channel: "EMEA Carrier" },
        { id: "KDDI-JP", name: "KDDI CORP", ticker: "9433 JP", rev_pct: 1.20, cogs_pct: 4.75, risk: "standard", country: "JP", channel: "Japanese Cellular" },
        { id: "METRO-DE", name: "METRO AG", ticker: "B4B GY", rev_pct: 0.99, cogs_pct: 2.74, risk: "standard", country: "DE", channel: "European Wholesale" },
        { id: "TIT-IT", name: "TELECOM ITALIA S", ticker: "TIT IM", rev_pct: 0.77, cogs_pct: 5.23, risk: "critical", country: "IT", channel: "National Telecom" },
        { id: "TECHDATA-US", name: "TECH DATA CORP", ticker: "SNX US", rev_pct: 0.71, cogs_pct: 4.41, risk: "standard", country: "US", channel: "IT Enterprise Distributor" },
        { id: "SOFTBANK-JP", name: "SOFTBANK CORP", ticker: "9434 JP", rev_pct: 0.68, cogs_pct: 5.10, risk: "standard", country: "JP", channel: "Telecom & Tech Conglomerate" },
      ],
      peers: [
        { id: "GOOG-PEER", name: "GOOGLE INC-CL A", ticker: "GOOGL US", risk: "critical" },
        { id: "HTC-PEER", name: "HTC CORP", ticker: "2498 TT", risk: "critical" },
        { id: "HUAWEI-PEER", name: "HUAWEI TECHNOLOG", ticker: "PRIVATE", risk: "standard" },
        { id: "LG-PEER", name: "LG ELECTRONICS", ticker: "066570 KS", risk: "standard" },
        { id: "NOKIA-PEER", name: "NOKIA OYJ", ticker: "NOKIA FH", risk: "critical" },
        { id: "PALM-PEER", name: "PALM INC", ticker: "HPQ US", risk: "standard" },
        { id: "PANTECH-PEER", name: "PANTECH CO LTD", ticker: "PRIVATE", risk: "standard" },
        { id: "RIM-PEER", name: "RESEARCH IN MOTI", ticker: "BB CN", risk: "critical" },
        { id: "SAMSUNG-PEER", name: "SAMSUNG ELECTRON", ticker: "005930 KS", risk: "standard" },
        { id: "SONY-PEER", name: "SONY GROUP CORP", ticker: "6758 JP", risk: "standard" },
      ],
    };
  }

  // Generic procedural SPLC generator for other companies (BlackRock, Jio, Reliance, Harbor, etc.)
  const isHighRisk = (intel.risk_score || 0) >= 60;
  return {
    entity: {
      id: actualId,
      name: intel.name.toUpperCase(),
      ticker: intel.ticker ? `${intel.ticker} ${intel.country}` : `${actualId} CORP`,
      price: intel.market_cap || "$120.00",
      price_change: isHighRisk ? "-3.42%" : "+1.15%",
      cogs_quantified: isHighRisk ? "82.10%" : "91.40%",
      cogs_proprietary: isHighRisk ? "82.10%" : "91.40%",
      rev_quantified: isHighRisk ? "31.20%" : "48.50%",
      rev_proprietary: isHighRisk ? "31.20%" : "48.50%",
      capex_quantified: "5.40%",
      sga_quantified: "4.10%",
      rd_quantified: "2.50%",
      supplier_count: intel.connections_summary?.suppliers?.total || 140,
      customer_count: intel.connections_summary?.partners?.total || 85,
      peer_count: intel.connections_summary?.competitors?.total || 12,
      risk_score: intel.risk_score || 25,
    },
    suppliers: (intel.ownership_tree || []).concat([
      { name: "Primary Clearing Depot", stake: 24.5, type: "Custody Rail" },
      { name: "Regional Liquidity Provider", stake: 18.2, type: "Interbank Settlement" },
      { name: "Enterprise Infrastructure Host", stake: 12.0, type: "Cloud & Compute" },
      { name: "Regulatory Compliance Custodian", stake: 8.4, type: "Fiduciary Trustee" },
    ]).slice(0, 10).map((s, idx) => ({
      id: `splc-sup-${actualId}-${idx}`,
      name: s.name.toUpperCase().slice(0, 16),
      ticker: `${actualId.slice(0, 3)}-SUP${idx + 1}`,
      rev_pct: Number((s.stake || (15 - idx * 1.2)).toFixed(2)),
      cogs_pct: Number(((s.stake || 12) * 1.4).toFixed(2)),
      metric_type: idx % 3 === 0 ? "CAPEX" : "COGS",
      risk: (idx % 4 === 0 || isHighRisk) ? "critical" : "standard",
      country: intel.country || "US",
      category: s.type || "Core Supplier",
    })),
    customers: [
      { id: `splc-cust-1`, name: "GLOBAL ASSET PARTNERS", ticker: "GAP-US", rev_pct: 12.4, cogs_pct: 28.5, risk: "standard", country: "US", channel: "Institutional Client" },
      { id: `splc-cust-2`, name: "PACIFIC SOVEREIGN DESK", ticker: "PSD-SG", rev_pct: 9.8, cogs_pct: 21.2, risk: "standard", country: "SG", channel: "Sovereign Wealth Rail" },
      { id: `splc-cust-3`, name: "EUROPEAN PENSION TR", ticker: "EPT-UK", rev_pct: 7.2, cogs_pct: 18.0, risk: "critical", country: "GB", channel: "Pension Fund Pool" },
      { id: `splc-cust-4`, name: "NORDIC COMMERCIAL BK", ticker: "NCB-EE", rev_pct: 5.5, cogs_pct: 14.1, risk: isHighRisk ? "critical" : "standard", country: "EE", channel: "Correspondent Bank" },
      { id: `splc-cust-5`, name: "MIDDLE EAST TRADING CO", ticker: "MET-AE", rev_pct: 4.8, cogs_pct: 11.2, risk: isHighRisk ? "critical" : "standard", country: "AE", channel: "Free Zone Intermediary" },
      { id: `splc-cust-6`, name: "APAC RETAIL ALLIANCE", ticker: "ARA-IN", rev_pct: 3.9, cogs_pct: 9.4, risk: "standard", country: "IN", channel: "Digital Banking Distribution" },
    ],
    peers: [
      { id: "peer-1", name: "JPMORGAN CHASE", ticker: "JPM US", risk: "standard" },
      { id: "peer-2", name: "GOLDMAN SACHS", ticker: "GS US", risk: "standard" },
      { id: "peer-3", name: "MORGAN STANLEY", ticker: "MS US", risk: "standard" },
      { id: "peer-4", name: "VANGUARD GROUP", ticker: "VANG US", risk: "standard" },
      { id: "peer-5", name: "STATE STREET", ticker: "STT US", risk: "standard" },
      { id: "peer-6", name: "HSBC HOLDINGS", ticker: "HSBA LN", risk: "critical" },
      { id: "peer-7", name: "BNP PARIBAS", ticker: "BNP FP", risk: "standard" },
      { id: "peer-8", name: "DEUTSCHE BANK", ticker: "DBK GY", risk: "critical" },
    ],
  };
}

// -------------------------------------------------------------------------
// Bloomberg MAP / N219 (Multi-Dimensional Star Cluster) Data Generator
// -------------------------------------------------------------------------
export function getBloombergMapData(entityId) {
  const intel = getCompanyIntelligence(entityId);
  const actualId = intel.id;

  return {
    center: {
      id: actualId,
      name: intel.name,
      ticker: intel.ticker ? `${intel.ticker} Equity` : `${actualId} Equity`,
      price: intel.market_cap || "$232.40",
      price_chg: (intel.risk_score || 0) >= 60 ? "-1.85%" : "+0.47%",
      country: intel.country || "US",
      jurisdiction: intel.jurisdiction,
      industry: intel.industry,
      lei: intel.lei,
      risk_score: intel.risk_score || 25,
      sparkline_points: [20, 24, 22, 28, 26, 32, 30, 38, 35, 42, 40, 48, 46, 52],
    },
    indices: [
      { code: "SX5P", name: "Euro Stoxx 50", weight: "4.2%", status: "red" },
      { code: "NMX", name: "FTSE TechMark", weight: "6.8%", status: "red" },
      { code: "MSPE", name: "MSCI Pan-Euro", weight: "3.1%", status: "red" },
      { code: "BWORLD", name: "Bloomberg World", weight: "1.4%", status: "gray" },
      { code: "SXDP", name: "Stoxx Div Points", weight: "2.9%", status: "green" },
      { code: "BE500", name: "Bloomberg Euro 500", weight: "5.1%", status: "red" },
      { code: "ASX", name: "All Ordinaries", weight: "0.8%", status: "red" },
      { code: "SXXP", name: "Stoxx 600", weight: "8.4%", status: "red" },
      { code: "UKX", name: "FTSE 100", weight: "7.2%", status: "red" },
    ],
    peers: (intel.ownership_tree || []).slice(0, 7).map((p, i) => ({
      code: p.name.toUpperCase().slice(0, 8),
      name: p.name,
      status: i % 2 === 0 ? "green" : "red",
      corr: "+0.84",
    })).concat([
      { code: "MERCK & CO", name: "Merck & Co.", status: "green", corr: "+0.78" },
      { code: "PFIZER INC", name: "Pfizer Inc.", status: "green", corr: "+0.69" },
      { code: "SANOFI", name: "Sanofi SA", status: "green", corr: "+0.82" },
      { code: "GILEAD SCI", name: "Gilead Sciences", status: "green", corr: "+0.55" },
      { code: "AMGEN INC", name: "Amgen Inc.", status: "red", corr: "+0.61" },
      { code: "ROCHE HLDG", name: "Roche Holding AG", status: "green", corr: "+0.74" },
    ]),
    holders: (intel.ownership_tree || []).map((h, i) => ({
      code: h.name.toUpperCase().slice(0, 10),
      name: h.name,
      stake: `${h.stake}%`,
      status: i % 3 === 0 ? "red" : "green",
    })).concat([
      { code: "BLACKROCK", name: "BlackRock Fund Advisors", stake: "8.4%", status: "green" },
      { code: "VANGUARD", name: "Vanguard Group Inc.", stake: "7.2%", status: "green" },
      { code: "STATE ST", name: "State Street Global Advisors", stake: "4.1%", status: "green" },
      { code: "INVESCO", name: "Invesco Perpetual", stake: "2.8%", status: "red" },
      { code: "NORDEA", name: "Nordea Asset Management", stake: "1.9%", status: "green" },
    ]),
    analysts: [
      { firm: "Bryan Garnier", rating: "BUY", target: "$260.00", status: "green" },
      { firm: "Helvea", rating: "HOLD", target: "$235.00", status: "blue" },
      { firm: "Barclays", rating: "OVERWEIGHT", target: "$255.00", status: "blue" },
      { firm: "Exane BNP", rating: "NEUTRAL", target: "$225.00", status: "blue" },
      { firm: "SocGen", rating: "BUY", target: "$270.00", status: "red" },
      { firm: "Credit Suisse", rating: "UNDERPERFORM", target: "$210.00", status: "red" },
      { firm: "Jefferies", rating: "BUY", target: "$265.00", status: "blue" },
      { firm: "Sanford Bernstein", rating: "MARKET PERFORM", target: "$230.00", status: "blue" },
    ],
    board: (intel.board_members || []).map((b, i) => ({
      name: b.name,
      title: b.title,
      status: b.is_new ? "amber" : "amber",
    })).concat([
      { name: "Arthur D. Levinson", title: "Chairman", status: "amber" },
      { name: "Al Gore", title: "Senior Director", status: "amber" },
      { name: "Andrea Jung", title: "Director", status: "amber" },
      { name: "James Bell", title: "Audit Committee Chair", status: "amber" },
      { name: "Alex Gorsky", title: "Governance Chair", status: "amber" },
      { name: "Wanda Austin", title: "Independent Director", status: "amber" },
    ]),
    executives: (intel.board_members || []).filter(b => b.title.includes("Officer") || b.title.includes("President") || b.title.includes("Managing")).concat([
      { name: "Tim Cook", title: "Chief Executive Officer", status: "orange" },
      { name: "Kevan Parekh", title: "Chief Financial Officer", status: "orange" },
      { name: "Jeff Williams", title: "Chief Operating Officer", status: "orange" },
      { name: "Craig Federighi", title: "SVP Software Engineering", status: "orange" },
      { name: "Deirdre O'Brien", title: "SVP Retail & People", status: "orange" },
      { name: "Johny Srouji", title: "SVP Hardware Technologies", status: "orange" },
    ]),
    news: (intel.recent_signals || []).map(s => ({
      title: s.title,
      time: s.time,
      type: s.type,
    })).concat([
      { title: "Antitrust inquiry launched regarding App Store fees in EU", time: "1 day ago", type: "regulatory" },
      { title: "Direct equity transfer to Ireland Subsidiary executed", time: "1 day ago", type: "transaction" },
      { title: "Executive Leadership Transition (CFO succession)", time: "2 days ago", type: "personnel" },
      { title: "Q3 Earnings Release Discloses High Gross Margins", time: "3 days ago", type: "earnings" },
    ]),
    events: [
      { title: "Q3 2026 Earnings Release", date: "Oct 28" },
      { title: "International Cash and Treasury Summit", date: "Nov 12" },
      { title: "US Court of Appeals Antitrust Hearing", date: "Dec 04" },
      { title: "S1 2027 Strategic Roadmap Call", date: "Jan 18" },
    ],
    exchanges: [
      { code: "AZN LN", exch: "London Stock Exchange", currency: "GBP" },
      { code: "AZN SS", exch: "Nasdaq Stockholm", currency: "SEK" },
      { code: "AZN US", exch: "Nasdaq Global Select", currency: "USD" },
      { code: "AZN IX", exch: "Irish Stock Exchange", currency: "EUR" },
      { code: "AZNSEK EU", exch: "CBOE Europe", currency: "EUR" },
      { code: "AZN TQ", exch: "Turquoise MTF", currency: "GBP" },
    ],
    cds_curve: [
      { tenor: "1Y", spread: 18.2 },
      { tenor: "2Y", spread: 22.4 },
      { tenor: "3Y", spread: 29.1 },
      { tenor: "5Y", spread: 41.5 },
      { tenor: "7Y", spread: 54.0 },
      { tenor: "10Y", spread: 68.3 },
    ],
    balance_sheet: {
      cash: 28.5,
      short_term_inv: 35.2,
      receivables: 22.1,
      inventory: 6.8,
      non_current_assets: 180.4,
      short_term_debt: 14.5,
      long_term_debt: 98.2,
      other_liabilities: 45.1,
      total_equity: 115.2,
    },
  };
}

