import React, { useMemo, useState, useRef, useEffect } from "react";
import { getSPLCSupplyChainData } from "../../data/companyIntelligenceData";

export default function BloombergSPLCGraph({
  entityId = "Q312",
  onSelectEntity,
  onOpenCompany,
  selectedId,
}) {
  const containerRef = useRef(null);
  const [hoveredCardId, setHoveredCardId] = useState(null);
  const [sortBy, setSortBy] = useState("exposure"); // "exposure" | "cogs" | "risk"
  const [filterType, setFilterType] = useState("all"); // "all" | "quantified" | "flagged"

  // Fetch structured SPLC data for the active company
  const splcData = useMemo(() => {
    return getSPLCSupplyChainData(entityId);
  }, [entityId]);

  const { entity, suppliers: rawSuppliers, customers: rawCustomers, peers } = splcData;

  // Filter & Sort suppliers
  const suppliers = useMemo(() => {
    let list = [...rawSuppliers];
    if (filterType === "flagged") {
      list = list.filter((s) => s.risk === "critical" || s.risk === "elevated");
    }
    if (sortBy === "exposure") {
      list.sort((a, b) => b.rev_pct - a.rev_pct);
    } else if (sortBy === "cogs") {
      list.sort((a, b) => b.cogs_pct - a.cogs_pct);
    } else if (sortBy === "risk") {
      list.sort((a, b) => (b.risk === "critical" ? 1 : 0) - (a.risk === "critical" ? 1 : 0));
    }
    return list;
  }, [rawSuppliers, sortBy, filterType]);

  // Filter & Sort customers
  const customers = useMemo(() => {
    let list = [...rawCustomers];
    if (filterType === "flagged") {
      list = list.filter((c) => c.risk === "critical" || c.risk === "elevated");
    }
    if (sortBy === "exposure") {
      list.sort((a, b) => b.rev_pct - a.rev_pct);
    } else if (sortBy === "cogs") {
      list.sort((a, b) => b.cogs_pct - a.cogs_pct);
    }
    return list;
  }, [rawCustomers, sortBy, filterType]);

  return (
    <div className="splc-viewport" ref={containerRef}>
      {/* Bloomberg SPLC Header Function Bar */}
      <div className="splc-header-bar">
        <div className="splc-bar-top">
          <div className="splc-ticker-badge">
            <span className="ticker-label">{entity.ticker || `${entity.name} Equity`}</span>
          </div>
          <div className="splc-action-buttons">
            <button className="splc-btn red" onClick={() => onSelectEntity(entity.id)}>1) Profile</button>
            <button className="splc-btn red" onClick={() => setFilterType(filterType === "all" ? "quantified" : "all")}>2) Peers</button>
            <button className="splc-btn red" onClick={() => onOpenCompany && onOpenCompany(entity.id)}>3) Actions</button>
            <button className="splc-btn cyan">4) Feedback</button>
          </div>
          <div className="splc-title-banner">
            <span className="splc-screen-title">Supply Chain (SPLC)</span>
          </div>
        </div>

        <div className="splc-bar-sub">
          <div className="splc-sub-item">
            <span className="lbl">Viewing</span>
            <strong className="val">{entity.name}</strong>
          </div>
          <div className="splc-sub-item">
            <span className="lbl">Analyze</span>
            <select className="splc-select">
              <option>Latest Sales Surprise %</option>
              <option>Direct Value Chain COGS %</option>
              <option>Geographic Exposure (ISO2)</option>
              <option>Sanction & PEP Risk Tier</option>
            </select>
          </div>
          <div className="splc-sub-item">
            <span className="lbl">Currency</span>
            <span className="splc-tag">USD</span>
          </div>
          <div className="splc-sub-item">
            <label className="splc-check">
              <input
                type="checkbox"
                checked={filterType === "quantified"}
                onChange={(e) => setFilterType(e.target.checked ? "quantified" : "all")}
              />
              Quantified Relationships Only
            </label>
          </div>
          <div className="splc-sub-item filter-btn-wrap">
            <button
              className={`splc-filter-pill ${filterType === "flagged" ? "active" : ""}`}
              onClick={() => setFilterType(filterType === "flagged" ? "all" : "flagged")}
            >
              ⚠ High-Risk Only
            </button>
          </div>
        </div>

        <div className="splc-bar-ribbon">
          <div className="ribbon-group">
            <span className="ribbon-lbl">Show As</span>
            <button className="splc-ribbon-btn active">7) Interactive Map</button>
            <button className="splc-ribbon-btn" onClick={() => setSortBy(sortBy === "cogs" ? "exposure" : "cogs")}>8) Matrix</button>
          </div>
          <div className="ribbon-group">
            <span className="ribbon-lbl">Sort By</span>
            <button
              className={`splc-ribbon-btn ${sortBy === "exposure" ? "active" : ""}`}
              onClick={() => setSortBy("exposure")}
            >
              9) Company Exposure
            </button>
            <button
              className={`splc-ribbon-btn ${sortBy === "cogs" ? "active" : ""}`}
              onClick={() => setSortBy("cogs")}
            >
              10) Relationship COGS %
            </button>
            <button
              className={`splc-ribbon-btn ${sortBy === "risk" ? "active" : ""}`}
              onClick={() => setSortBy("risk")}
            >
              11) Risk Hierarchy
            </button>
          </div>
        </div>
      </div>

      {/* Main SPLC Tripartite Value Chain Canvas */}
      <div className="splc-canvas-grid">
        {/* Dynamic SVG Interactive Connector Layer */}
        <svg className="splc-svg-links-overlay" aria-hidden="true">
          <defs>
            <linearGradient id="supGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.4" />
            </linearGradient>
            <linearGradient id="custGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#60a5fa" stopOpacity="0.8" />
            </linearGradient>
            <filter id="splcGlow">
              <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
        </svg>

        {/* Left Column: Suppliers */}
        <div className="splc-column suppliers-col">
          <div className="splc-col-header">
            <span className="splc-col-title">▲ UPSTREAM SUPPLIERS</span>
            <span className="splc-col-count">{suppliers.length} of {entity.supplier_count} Tracked</span>
          </div>
          <div className="splc-card-list">
            {suppliers.map((sup, idx) => {
              const isSelected = selectedId === sup.id;
              const isHovered = hoveredCardId === sup.id;
              const isCritical = sup.risk === "critical";
              return (
                <div
                  key={sup.id}
                  id={`splc-sup-${idx}`}
                  className={`splc-node-card supplier ${isSelected ? "selected" : ""} ${isHovered ? "hovered" : ""} ${isCritical ? "critical" : "standard"}`}
                  onClick={() => onSelectEntity(sup.id)}
                  onDoubleClick={() => onOpenCompany && onOpenCompany(sup.id)}
                  onMouseEnter={() => setHoveredCardId(sup.id)}
                  onMouseLeave={() => setHoveredCardId(null)}
                  title="Click to view intelligence dossier · Double click to re-center"
                >
                  <div className="card-top-row">
                    <span className="card-name">{sup.name}</span>
                    <span className="card-info-icon" title="View Profile">ⓘ</span>
                  </div>
                  <div className="card-metric-row">
                    <span className="metric-tag rev">Rev: {sup.rev_pct}%</span>
                    <span className="metric-tag cogs">{sup.metric_type || "COGS"}: {sup.cogs_pct}%</span>
                    {sup.country && <span className="metric-country">{sup.country}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Center Column: Hub & Focal Entity Card */}
        <div className="splc-column focal-col">
          <div className="splc-hub-connector-left">
            <div className="hub-pulse-dot" />
            <span className="hub-label">{entity.supplier_count} Suppliers</span>
            <div className="hub-line" />
          </div>

          <div
            id="splc-focal-center"
            className={`splc-focal-card ${selectedId === entity.id ? "selected" : ""}`}
            onClick={() => onSelectEntity(entity.id)}
          >
            <div className="focal-card-badge">FOCAL CORPORATE ENTITY</div>
            <h2 className="focal-title">{entity.name}</h2>
            <div className="focal-ticker-sub">{entity.ticker} · {entity.price} ({entity.price_change})</div>

            <div className="focal-quant-matrix">
              <div className="matrix-row">
                <span className="m-lbl">Rev. Quantified</span>
                <strong className="m-val green">{entity.rev_quantified}</strong>
                <span className="m-lbl sub">Proprietary</span>
                <strong className="m-val">{entity.rev_proprietary}</strong>
              </div>
              <div className="matrix-row">
                <span className="m-lbl">COGS Quantified</span>
                <strong className="m-val blue">{entity.cogs_quantified}</strong>
                <span className="m-lbl sub">Proprietary</span>
                <strong className="m-val">{entity.cogs_proprietary}</strong>
              </div>
              <div className="matrix-row">
                <span className="m-lbl">CAPEX Quantified</span>
                <strong className="m-val">{entity.capex_quantified}</strong>
                <span className="m-lbl sub">SG&A</span>
                <strong className="m-val">{entity.sga_quantified}</strong>
              </div>
              <div className="matrix-row">
                <span className="m-lbl">R&D Quantified</span>
                <strong className="m-val">{entity.rd_quantified}</strong>
                <span className="m-lbl sub">Risk Score</span>
                <strong className={`m-val ${entity.risk_score >= 60 ? "red" : "green"}`}>
                  {entity.risk_score}/100
                </strong>
              </div>
            </div>

            <div className="focal-card-footer">
              <span className="verified-seal">✓ Verified Financial Terminal Node</span>
              <button
                className="focal-action-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectEntity(entity.id);
                }}
              >
                Inspect Dossier ➔
              </button>
            </div>
          </div>

          <div className="splc-hub-connector-right">
            <div className="hub-line" />
            <span className="hub-label">{entity.customer_count} Customers</span>
            <div className="hub-pulse-dot" />
          </div>
        </div>

        {/* Right Column: Customers */}
        <div className="splc-column customers-col">
          <div className="splc-col-header">
            <span className="splc-col-title">▼ DOWNSTREAM CUSTOMERS</span>
            <span className="splc-col-count">{customers.length} of {entity.customer_count} Tracked</span>
          </div>
          <div className="splc-card-list">
            {customers.map((cust, idx) => {
              const isSelected = selectedId === cust.id;
              const isHovered = hoveredCardId === cust.id;
              const isCritical = cust.risk === "critical";
              return (
                <div
                  key={cust.id}
                  id={`splc-cust-${idx}`}
                  className={`splc-node-card customer ${isSelected ? "selected" : ""} ${isHovered ? "hovered" : ""} ${isCritical ? "critical" : "standard"}`}
                  onClick={() => onSelectEntity(cust.id)}
                  onDoubleClick={() => onOpenCompany && onOpenCompany(cust.id)}
                  onMouseEnter={() => setHoveredCardId(cust.id)}
                  onMouseLeave={() => setHoveredCardId(null)}
                  title="Click to view intelligence dossier · Double click to re-center"
                >
                  <div className="card-top-row">
                    <span className="card-name">{cust.name}</span>
                    <span className="card-info-icon" title="View Profile">ⓘ</span>
                  </div>
                  <div className="card-metric-row">
                    <span className="metric-tag rev">Rev: {cust.rev_pct}%</span>
                    <span className="metric-tag cogs">COGS: {cust.cogs_pct}%</span>
                    {cust.country && <span className="metric-country">{cust.country}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Row: Peers & Industry Benchmark Strip */}
      <div className="splc-peers-strip">
        <div className="peers-strip-header">
          <span className="strip-tag">{peers.length} 3D PEERS / BENCHMARK INDEX</span>
          <span className="strip-hint">Click peer to view corporate correlation & risk ranking</span>
        </div>
        <div className="peers-card-row">
          {peers.map((peer) => (
            <button
              key={peer.id}
              className={`peer-badge ${peer.risk === "critical" ? "critical" : "standard"} ${selectedId === peer.id ? "active" : ""}`}
              onClick={() => onSelectEntity(peer.id)}
              onDoubleClick={() => onOpenCompany && onOpenCompany(peer.id)}
            >
              <span className="p-name">{peer.name}</span>
              <span className="p-ticker">{peer.ticker}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
