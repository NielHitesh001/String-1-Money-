import React, { useState } from "react";
import { getCompanyIntelligence } from "../data/companyIntelligenceData";

const getRiskClass = (score) => (score >= 80 ? "critical" : score >= 60 ? "high" : score >= 40 ? "elevated" : "low");

export default function EntityIntelligencePanel({
  entityId,
  entityName,
  entityCountry,
  entityKind,
  onOpenNetwork,
  onCompare,
  onExport,
  onAddToWatchlist,
}) {
  const [driversOpen, setDriversOpen] = useState(true);
  const [ownershipExpanded, setOwnershipExpanded] = useState(false);
  const [watchlistActive, setWatchlistActive] = useState(false);
  const [alertActive, setAlertActive] = useState(false);

  const data = getCompanyIntelligence(entityId, entityName, entityCountry, entityKind);
  const riskClass = getRiskClass(data.risk_score);

  const handleWatchlist = () => {
    setWatchlistActive((prev) => !prev);
    onAddToWatchlist?.(data.id, !watchlistActive);
  };

  const handleExport = () => {
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dossier-${data.id.toLowerCase()}-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="entity-intelligence-dossier">
      {/* 1. Header & Identity */}
      <header className="dossier-header">
        <div className="dossier-eyebrow">
          <span className="eyebrow-tag">ENTITY INTELLIGENCE</span>
          <span className="dossier-ticker">{data.ticker}</span>
          <span className="dossier-type-badge">{data.entity_type}</span>
        </div>
        <h2 className="dossier-name">{data.name}</h2>
        <div className="dossier-sub-meta">
          <span>🏛 {data.jurisdiction}</span>
          <span>·</span>
          <span>LEI: <code>{data.lei}</code></span>
        </div>
        <div className="dossier-freshness-bar">
          <span className="freshness-indicator">● {data.risk_last_updated}</span>
          <span className={`verification-badge ${data.verification.status.includes("Verified") ? "verified" : "unverified"}`}>
            {data.verification.status.includes("Verified") ? "✓" : "⚠️"} {data.verification.status} ({data.verification.confidence_pct}% Confidence)
          </span>
        </div>
      </header>

      {/* 2. Risk Profile Card (The WHY) */}
      <section className="dossier-risk-card">
        <div className="risk-card-top">
          <div className="risk-score-display">
            <span className="risk-label-small">COMPOSITE RISK SCORE</span>
            <div className="risk-value-large">
              <strong className={`score-num ${riskClass}`}>{data.risk_score}</strong>
              <small>/100 ({riskClass.toUpperCase()})</small>
            </div>
          </div>
          <div className="risk-sources-count">
            <small>Data Sources</small>
            <b>{data.verification.sources.length} Audited Feeds</b>
          </div>
        </div>

        <div className="risk-meter-track">
          <div className={`risk-meter-fill ${riskClass}`} style={{ width: `${data.risk_score}%` }}></div>
        </div>

        {/* Expandable Risk Drivers */}
        <div className="risk-drivers-accordion">
          <button
            type="button"
            className="drivers-toggle-btn"
            onClick={() => setDriversOpen((prev) => !prev)}
          >
            <span>Risk Factor Breakdown ({data.risk_drivers.length} Drivers)</span>
            <span>{driversOpen ? "▲ Collapse" : "▼ Expand WHY"}</span>
          </button>

          {driversOpen && (
            <div className="drivers-list">
              {data.risk_drivers.map((driver, idx) => (
                <div key={idx} className={`driver-row ${driver.severity || "standard"}`}>
                  <div className="driver-row-top">
                    <span className="driver-cat">{driver.category}</span>
                    <strong className={`driver-points ${driver.points > 0 ? "positive" : "negative"}`}>
                      {driver.points > 0 ? `+${driver.points}` : driver.points} pts
                    </strong>
                  </div>
                  <p className="driver-exp">{driver.explanation}</p>
                  <span className="driver-source">Source: {driver.source}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 3. Ownership Tree */}
      <section className="dossier-section">
        <div className="section-title-row">
          <h3>Ownership & Equity Control</h3>
          <button
            type="button"
            className="section-sub-action"
            onClick={() => setOwnershipExpanded((p) => !p)}
          >
            {ownershipExpanded ? "Show Top 3" : "Expand All Layers"}
          </button>
        </div>
        <div className="ownership-tree-list">
          {(ownershipExpanded ? data.ownership_tree : data.ownership_tree.slice(0, 3)).map((own, i) => (
            <div key={i} className="ownership-tree-item">
              <div className="owner-meta">
                <span className="owner-name">{own.name}</span>
                <span className="owner-type">{own.type} (Layer {own.layer})</span>
              </div>
              <div className="owner-stake-bar-container">
                <div className="owner-stake-bar" style={{ width: `${own.stake}%` }}></div>
                <span className="owner-stake-num">{own.stake}%</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 4. Board & Key Personnel */}
      <section className="dossier-section">
        <div className="section-title-row">
          <h3>Board & Executive Governance</h3>
          <span className="sub-count">{data.board_members.length} Officers</span>
        </div>
        <div className="board-members-list">
          {data.board_members.map((mbr, i) => (
            <div key={i} className="board-member-card">
              <div className="member-header">
                <strong>{mbr.name}</strong>
                {mbr.alert && <span className="member-alert-pill">⚠️ {mbr.alert}</span>}
              </div>
              <div className="member-title">{mbr.title} · Tenure: {mbr.tenure_years} yrs</div>
              <div className="member-prev">Prior: {mbr.previous}</div>
            </div>
          ))}
        </div>
      </section>

      {/* 5. Recent Signals Feed (Last 7 Days) */}
      <section className="dossier-section">
        <div className="section-title-row">
          <h3>Recent Signals & Intelligence Stream</h3>
          <span className="sub-count">Last 7 Days</span>
        </div>
        <div className="signals-stream-list">
          {data.recent_signals.map((sig) => (
            <div key={sig.id} className={`signal-stream-item ${sig.type}`}>
              <div className="signal-icon">{sig.icon}</div>
              <div className="signal-body">
                <div className="signal-headline">{sig.title}</div>
                <div className="signal-detail">{sig.detail}</div>
                <div className="signal-time">{sig.time}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 6. Network Connections Breakdown */}
      <section className="dossier-section">
        <h3>Institutional Ecosystem Breakdown</h3>
        <div className="ecosystem-stats-grid">
          <div className="eco-stat-box">
            <small>Suppliers</small>
            <b>{data.connections_summary.suppliers.total}</b>
            {data.connections_summary.suppliers.flagged > 0 && (
              <span className="eco-flagged">{data.connections_summary.suppliers.flagged} Flagged</span>
            )}
          </div>
          <div className="eco-stat-box">
            <small>Partners / JVs</small>
            <b>{data.connections_summary.partners.total}</b>
            {data.connections_summary.partners.flagged > 0 && (
              <span className="eco-flagged">{data.connections_summary.partners.flagged} High-Risk</span>
            )}
          </div>
          <div className="eco-stat-box">
            <small>Institutional Investors</small>
            <b>{data.connections_summary.investors.total}</b>
          </div>
          <div className="eco-stat-box">
            <small>Regulators</small>
            <b>{data.connections_summary.regulators.total}</b>
            {data.connections_summary.regulators.flagged > 0 && (
              <span className="eco-flagged">{data.connections_summary.regulators.flagged} Active Audits</span>
            )}
          </div>
        </div>
      </section>

      {/* 7. Transactions Summary */}
      <section className="dossier-section">
        <div className="section-title-row">
          <h3>90-Day Capital & Transfer Activity</h3>
          <span className="volume-spike-tag">{data.metrics_30d.volume_change}</span>
        </div>
        <div className="dossier-tx-summary">
          <div>
            <small>90D Aggregate Volume</small>
            <strong>${(data.metrics_30d.transaction_volume_90d / 1e9).toFixed(1)}B USD</strong>
          </div>
          <div>
            <small>Transfers Count</small>
            <strong>{data.metrics_30d.transaction_count_90d} Flows</strong>
          </div>
        </div>
      </section>

      {/* 8. Quick Actions Bar */}
      <footer className="dossier-actions-footer">
        <button
          type="button"
          className={`dossier-action-btn ${watchlistActive ? "active" : ""}`}
          onClick={handleWatchlist}
        >
          {watchlistActive ? "★ On Watchlist" : "☆ Watchlist"}
        </button>

        <button
          type="button"
          className={`dossier-action-btn ${alertActive ? "active" : ""}`}
          onClick={() => setAlertActive((p) => !p)}
        >
          {alertActive ? "🔔 Monitoring On" : "🔔 Alert on Changes"}
        </button>

        <button
          type="button"
          className="dossier-action-btn"
          onClick={() => onCompare?.(data)}
        >
          ⇄ Compare
        </button>

        <button
          type="button"
          className="dossier-action-btn"
          onClick={handleExport}
        >
          ↓ Export JSON
        </button>

        {onOpenNetwork && (
          <button
            type="button"
            className="dossier-recenter-btn"
            onClick={() => onOpenNetwork(data.id)}
          >
            Re-center Corporate Graph →
          </button>
        )}
      </footer>
    </div>
  );
}
