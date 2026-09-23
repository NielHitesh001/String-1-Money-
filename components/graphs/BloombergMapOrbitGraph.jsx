import React, { useMemo, useState } from "react";
import { getBloombergMapData } from "../../data/companyIntelligenceData";

export default function BloombergMapOrbitGraph({
  entityId = "Q312",
  onSelectEntity,
  onOpenCompany,
  selectedId,
}) {
  const [activeCluster, setActiveCluster] = useState(null);

  // Fetch structured MAP/N219 data
  const mapData = useMemo(() => {
    return getBloombergMapData(entityId);
  }, [entityId]);

  const {
    center,
    indices,
    peers,
    holders,
    analysts,
    board,
    executives,
    news,
    events,
    exchanges,
    cds_curve,
    balance_sheet,
  } = mapData;

  return (
    <div className="n219-viewport">
      {/* Bloomberg N219 Header Bar */}
      <div className="n219-header-bar">
        <div className="n219-help-tag">
          <span className="terminal-green">&lt;HELP&gt;</span> for explanation.
          <span className="n219-code">N219</span>
        </div>
        <div className="n219-nav-row">
          <div className="n219-ticker-block">
            <span className="amber-pill">{center.ticker}</span>
            <span className="ticker-sub-name">{center.name}</span>
          </div>
          <div className="n219-btn-group">
            <button className="n219-btn red" onClick={() => onSelectEntity(center.id)}>11) Refresh</button>
            <button className="n219-btn cyan">98) Feedback</button>
          </div>
          <div className="n219-title-banner">
            <span>Relationship Map</span>
          </div>
        </div>
      </div>

      {/* Star Cluster Constellation Grid Layout */}
      <div className="n219-orbit-grid">
        {/* Left Side: News & Events Feeds */}
        <div className="n219-left-col">
          {/* News Feed Cluster */}
          <div className="n219-feed-panel news-feed">
            <div className="feed-header">
              <span className="feed-title">News ({news.length}/40)</span>
            </div>
            <div className="feed-items">
              {news.map((item, idx) => (
                <div key={`news-${idx}`} className="n219-news-item">
                  <span className="news-bullet">▪</span>
                  <p className="news-text">{item.title}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Events Feed Cluster */}
          <div className="n219-feed-panel events-feed">
            <div className="feed-header">
              <span className="feed-title">Events ({events.length}/6)</span>
            </div>
            <div className="feed-items">
              {events.map((ev, idx) => (
                <div key={`ev-${idx}`} className="n219-event-item">
                  <span className="ev-date">{ev.date}</span>
                  <span className="ev-title">{ev.title}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Center Constellation Area */}
        <div className="n219-constellation-stage">
          {/* Top Orbital Ring: Indices, Peers, Holders, Analysts */}
          <div className="orbit-top-row">
            {/* 1. Indices Cluster */}
            <div className="cluster-satellite indices-cluster">
              <div className="cluster-hub-badge">
                <span className="cluster-name">Indices (9/50)</span>
                <span className="hub-dot green" />
              </div>
              <div className="cluster-node-cloud">
                {indices.map((idx, i) => (
                  <div key={`idx-${i}`} className={`orbit-chip ${idx.status}`}>
                    {idx.code}
                  </div>
                ))}
                <div className="orbit-chip gray">More...</div>
              </div>
            </div>

            {/* 2. Peers Cluster */}
            <div className="cluster-satellite peers-cluster">
              <div className="cluster-hub-badge">
                <span className="cluster-name">Peers (11/20)</span>
                <span className="hub-dot cyan" />
              </div>
              <div className="cluster-node-cloud">
                {peers.map((peer, i) => (
                  <div
                    key={`peer-${i}`}
                    className={`orbit-chip ${peer.status}`}
                    onClick={() => onSelectEntity(peer.name)}
                    title={peer.name}
                  >
                    {peer.code}
                  </div>
                ))}
                <div className="orbit-chip gray">More...</div>
              </div>
            </div>

            {/* 3. Holders Cluster */}
            <div className="cluster-satellite holders-cluster">
              <div className="cluster-hub-badge">
                <span className="cluster-name">Holders (16/80)</span>
                <span className="hub-dot green" />
              </div>
              <div className="cluster-node-cloud">
                {holders.map((holder, i) => (
                  <div
                    key={`holder-${i}`}
                    className={`orbit-chip ${holder.status}`}
                    onClick={() => onSelectEntity(holder.name)}
                    title={`${holder.name}: ${holder.stake}`}
                  >
                    {holder.code}
                  </div>
                ))}
                <div className="orbit-chip gray">More...</div>
              </div>
            </div>

            {/* 4. Analysts Cluster */}
            <div className="cluster-satellite analysts-cluster">
              <div className="cluster-hub-badge">
                <span className="cluster-name">Analysts (11/37)</span>
                <span className="hub-dot blue" />
              </div>
              <div className="cluster-node-cloud">
                {analysts.map((a, i) => (
                  <div key={`an-${i}`} className={`orbit-chip ${a.status}`} title={`${a.firm} - ${a.rating} (${a.target})`}>
                    {a.firm.slice(0, 9)}
                  </div>
                ))}
                <div className="orbit-chip gray">More...</div>
              </div>
            </div>
          </div>

          {/* Central Anchor Node */}
          <div className="n219-center-anchor-wrap">
            <div
              className={`n219-center-core ${selectedId === center.id ? "selected" : ""}`}
              onClick={() => onSelectEntity(center.id)}
            >
              <div className="core-header">
                <span className="core-ticker">{center.ticker}</span>
                <span className="core-sparkline-wrap">
                  <svg width="60" height="18" className="mini-spark">
                    <polyline
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="2"
                      points="0,14 10,12 20,15 30,8 40,11 50,4 60,2"
                    />
                  </svg>
                </span>
              </div>
              <h3 className="core-name">{center.name}</h3>
              <div className="core-telemetry">
                <span>Price: {center.price}</span>
                <span className="telemetry-chg green">Px Chg: {center.price_chg}</span>
              </div>
            </div>
          </div>

          {/* Right Orbital Side: Board & Executives */}
          <div className="orbit-right-column">
            {/* Board of Directors Cluster */}
            <div className="cluster-satellite board-cluster">
              <div className="cluster-hub-badge">
                <span className="cluster-name">Board (12/12)</span>
                <span className="hub-dot amber" />
              </div>
              <div className="cluster-node-cloud fan-out">
                {board.map((b, i) => (
                  <div key={`brd-${i}`} className="orbit-chip amber-director" title={`${b.name} - ${b.title}`}>
                    {b.name.split(" ")[0]}...
                  </div>
                ))}
              </div>
            </div>

            {/* Executive Leadership Cluster */}
            <div className="cluster-satellite exec-cluster">
              <div className="cluster-hub-badge">
                <span className="cluster-name">Executives (12/12)</span>
                <span className="hub-dot orange" />
              </div>
              <div className="cluster-node-cloud fan-out">
                {executives.map((ex, i) => (
                  <div key={`ex-${i}`} className="orbit-chip orange-officer" title={`${ex.name} - ${ex.title}`}>
                    {ex.name.split(" ")[0]}...
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom Orbital Row: Financial Topology (Options, Exchanges, CDS, Balance Sheet) */}
          <div className="orbit-bottom-row">
            {/* Options Quadrant */}
            <div className="cluster-satellite widget-box options-widget">
              <div className="widget-title">Options</div>
              <div className="quadrant-display">
                <div className="q-cell q1">C</div>
                <div className="q-cell q2">P</div>
                <div className="q-cell q3">ATM</div>
                <div className="q-cell q4">OTM</div>
              </div>
            </div>

            {/* Exchanges Satellite Cluster */}
            <div className="cluster-satellite exchanges-cluster">
              <div className="cluster-hub-badge">
                <span className="cluster-name">Exchanges (12/48)</span>
                <span className="hub-dot green" />
              </div>
              <div className="cluster-node-cloud compact">
                {exchanges.map((ex, i) => (
                  <div key={`ex-${i}`} className="orbit-chip gold-chip" title={`${ex.exch} (${ex.currency})`}>
                    {ex.code}
                  </div>
                ))}
              </div>
            </div>

            {/* CDS Spread Curve Chart */}
            <div className="cluster-satellite widget-box cds-widget">
              <div className="widget-title">CDS Spread Curve</div>
              <div className="cds-chart-container">
                <svg width="110" height="50" className="cds-svg">
                  <polyline
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="2"
                    points="5,42 25,36 50,28 75,18 100,8"
                  />
                  <circle cx="5" cy="42" r="3" fill="#3b82f6" />
                  <circle cx="25" cy="36" r="3" fill="#3b82f6" />
                  <circle cx="50" cy="28" r="3" fill="#3b82f6" />
                  <circle cx="75" cy="18" r="3" fill="#3b82f6" />
                  <circle cx="100" cy="8" r="3" fill="#3b82f6" />
                </svg>
                <div className="cds-meta">5Y: 41.5 bps</div>
              </div>
            </div>

            {/* Balance Sheet Stacked Decomposition */}
            <div className="cluster-satellite widget-box bs-widget">
              <div className="widget-title">Balance Sheet</div>
              <div className="bs-bars-container">
                <div className="bs-bar-segment green" style={{ height: "45%" }} title="Cash & Short Term Inv: $63.7B" />
                <div className="bs-bar-segment blue" style={{ height: "30%" }} title="Receivables & Operations: $22.1B" />
                <div className="bs-bar-segment orange" style={{ height: "25%" }} title="Non-Current Assets: $180.4B" />
              </div>
              <div className="bs-meta">Assets / Debt / Equity</div>
            </div>
          </div>
        </div>
      </div>

      {/* Bloomberg Footer Ticker Banner */}
      <div className="n219-footer-ribbon">
        <div className="footer-left">
          <span>Australia 61 2 9777 8600</span>
          <span>Brazil 5511 3048 4500</span>
          <span>Europe 44 20 7330 7500</span>
          <span>Germany 49 69 9204 1210</span>
          <span>Hong Kong 852 2977 6000</span>
          <span>Japan 81 3 3201 8900</span>
          <span>Singapore 65 6212 1000</span>
          <span>U.S. 1 212 318 2000</span>
        </div>
        <div className="footer-right">
          <span>Copyright 2026 Bloomberg Finance L.P.</span>
          <span className="terminal-time">GMT+1:00 H437-2625-0 23-Sep-2026</span>
        </div>
      </div>
    </div>
  );
}
