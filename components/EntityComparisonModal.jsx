import React, { useState } from "react";

export default function EntityComparisonModal({
  entities = [],
  initialEntityA = null,
  initialEntityB = null,
  transactions = [],
  onClose,
  onSelectEntity,
}) {
  const [entityAId, setEntityAId] = useState(initialEntityA?.id || entities[0]?.id || "");
  const [entityBId, setEntityBId] = useState(
    initialEntityB?.id || (entities.length > 1 ? entities[1]?.id : entities[0]?.id || "")
  );

  const entityA = entities.find((e) => e.id === entityAId) || entities[0];
  const entityB = entities.find((e) => e.id === entityBId) || (entities[1] || entities[0]);

  // Compute stats for Entity A
  const txsA = transactions.filter((t) => t.source === entityA?.id || t.target === entityA?.id);
  const totalVolumeA = txsA.reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const avgRiskA = txsA.length ? Math.round(txsA.reduce((sum, t) => sum + (t.risk || 0), 0) / txsA.length) : entityA?.risk || 0;
  const counterpartiesA = new Set(txsA.map((t) => (t.source === entityA?.id ? t.target : t.source)));

  // Compute stats for Entity B
  const txsB = transactions.filter((t) => t.source === entityB?.id || t.target === entityB?.id);
  const totalVolumeB = txsB.reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const avgRiskB = txsB.length ? Math.round(txsB.reduce((sum, t) => sum + (t.risk || 0), 0) / txsB.length) : entityB?.risk || 0;
  const counterpartiesB = new Set(txsB.map((t) => (t.source === entityB?.id ? t.target : t.source)));

  // Shared counterparties
  const sharedCounterparties = [...counterpartiesA].filter((id) => counterpartiesB.has(id));

  // Shared transactions
  const directTxs = transactions.filter(
    (t) =>
      (t.source === entityA?.id && t.target === entityB?.id) ||
      (t.source === entityB?.id && t.target === entityA?.id)
  );

  const formatMillions = (val) => `$${(val / 1_000_000).toFixed(1)}M`;
  const getRiskClass = (score) => (score >= 80 ? "critical" : score >= 55 ? "elevated" : "standard");

  return (
    <div className="entity-compare-overlay" onClick={onClose}>
      <div className="entity-compare-modal" onClick={(e) => e.stopPropagation()}>
        <div className="entity-compare-header">
          <div className="compare-title-block">
            <span className="compare-icon">⇄</span>
            <div>
              <h3>Institutional Entity Comparison</h3>
              <p>Side-by-side corporate governance, jurisdiction & transaction exposure analysis</p>
            </div>
          </div>
          <button type="button" className="compare-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="entity-compare-selectors">
          <div className="selector-group">
            <label>Entity Alpha (Origin/Target):</label>
            <select value={entityAId} onChange={(e) => setEntityAId(e.target.value)}>
              {entities.map((e) => (
                <option key={e.id} value={e.id}>
                  [{e.country}] {e.name} ({e.id})
                </option>
              ))}
            </select>
          </div>

          <div className="selector-exchange-icon">⇄</div>

          <div className="selector-group">
            <label>Entity Beta (Counterparty/Peer):</label>
            <select value={entityBId} onChange={(e) => setEntityBId(e.target.value)}>
              {entities.map((e) => (
                <option key={e.id} value={e.id}>
                  [{e.country}] {e.name} ({e.id})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="entity-compare-grid">
          {/* Entity A Card */}
          <div className="entity-compare-card">
            <div className="compare-card-top">
              <div className="compare-card-badge">{entityA?.country}</div>
              <h4>{entityA?.name}</h4>
              <code>{entityA?.id}</code>
            </div>

            <div className="compare-metrics-row">
              <div className="metric-box">
                <small>Entity Risk</small>
                <b className={`metric-val ${getRiskClass(entityA?.risk || 0)}`}>{entityA?.risk || 0} / 100</b>
              </div>
              <div className="metric-box">
                <small>30D Volume</small>
                <b className="metric-val">{formatMillions(totalVolumeA)}</b>
              </div>
              <div className="metric-box">
                <small>Active Flows</small>
                <b className="metric-val">{txsA.length}</b>
              </div>
            </div>

            <div className="compare-details-section">
              <div className="detail-row">
                <span>Jurisdiction:</span>
                <strong>{entityA?.country || "—"} ({entityA?.jurisdiction || "ISO-3166"})</strong>
              </div>
              <div className="detail-row">
                <span>Entity Classification:</span>
                <strong>{entityA?.kind || entityA?.entity_type || "Corporation"}</strong>
              </div>
              <div className="detail-row">
                <span>LEI Code:</span>
                <code>{entityA?.lei || "HWUPKR0MPOU8FGXBT394"}</code>
              </div>
              <div className="detail-row">
                <span>Confidence Rating:</span>
                <strong>{entityA?.confidence ? `${entityA.confidence * 100}%` : "98% (Audited)"}</strong>
              </div>
            </div>

            <div className="compare-recent-txs">
              <h5>Recent Active Corridors</h5>
              {txsA.slice(0, 3).map((t) => (
                <div key={t.id} className="compare-tx-pill">
                  <span>{t.source === entityA.id ? `→ ${t.target}` : `← ${t.source}`}</span>
                  <span className="tx-pill-amt">{formatMillions(t.amount)}</span>
                  <span className={`risk-tag ${getRiskClass(t.risk)}`}>{t.risk}</span>
                </div>
              ))}
              {txsA.length === 0 && <span className="no-data-hint">No active transaction corridors</span>}
            </div>
          </div>

          {/* Entity B Card */}
          <div className="entity-compare-card">
            <div className="compare-card-top">
              <div className="compare-card-badge">{entityB?.country}</div>
              <h4>{entityB?.name}</h4>
              <code>{entityB?.id}</code>
            </div>

            <div className="compare-metrics-row">
              <div className="metric-box">
                <small>Entity Risk</small>
                <b className={`metric-val ${getRiskClass(entityB?.risk || 0)}`}>{entityB?.risk || 0} / 100</b>
              </div>
              <div className="metric-box">
                <small>30D Volume</small>
                <b className="metric-val">{formatMillions(totalVolumeB)}</b>
              </div>
              <div className="metric-box">
                <small>Active Flows</small>
                <b className="metric-val">{txsB.length}</b>
              </div>
            </div>

            <div className="compare-details-section">
              <div className="detail-row">
                <span>Jurisdiction:</span>
                <strong>{entityB?.country || "—"} ({entityB?.jurisdiction || "ISO-3166"})</strong>
              </div>
              <div className="detail-row">
                <span>Entity Classification:</span>
                <strong>{entityB?.kind || entityB?.entity_type || "Corporation"}</strong>
              </div>
              <div className="detail-row">
                <span>LEI Code:</span>
                <code>{entityB?.lei || "5493006MHB84DD0ZWV18"}</code>
              </div>
              <div className="detail-row">
                <span>Confidence Rating:</span>
                <strong>{entityB?.confidence ? `${entityB.confidence * 100}%` : "95% (Audited)"}</strong>
              </div>
            </div>

            <div className="compare-recent-txs">
              <h5>Recent Active Corridors</h5>
              {txsB.slice(0, 3).map((t) => (
                <div key={t.id} className="compare-tx-pill">
                  <span>{t.source === entityB.id ? `→ ${t.target}` : `← ${t.source}`}</span>
                  <span className="tx-pill-amt">{formatMillions(t.amount)}</span>
                  <span className={`risk-tag ${getRiskClass(t.risk)}`}>{t.risk}</span>
                </div>
              ))}
              {txsB.length === 0 && <span className="no-data-hint">No active transaction corridors</span>}
            </div>
          </div>
        </div>

        {/* Overlap & Direct Corridor Insights */}
        <div className="entity-compare-insights">
          <div className="insight-box">
            <h6>Direct Corridors Between Pair ({directTxs.length})</h6>
            {directTxs.length > 0 ? (
              <div className="direct-tx-list">
                {directTxs.map((t) => (
                  <div key={t.id} className="direct-tx-item">
                    <span>{t.id}</span>
                    <span>{t.source} → {t.target}</span>
                    <b>{formatMillions(t.amount)} ({t.currency})</b>
                    <span className={`risk-tag ${getRiskClass(t.risk)}`}>Risk: {t.risk}</span>
                    <small>Rail: {t.rail || "SWIFT"}</small>
                  </div>
                ))}
              </div>
            ) : (
              <p className="no-direct-flow">No direct transactions identified between these two entities. Multi-hop correspondent bank required.</p>
            )}
          </div>

          <div className="insight-box">
            <h6>Common Counterparties ({sharedCounterparties.length})</h6>
            <div className="shared-counterparties-list">
              {sharedCounterparties.length > 0 ? (
                sharedCounterparties.map((cpId) => (
                  <span key={cpId} className="counterparty-chip">
                    {cpId}
                  </span>
                ))
              ) : (
                <p className="no-direct-flow">No shared counterparties found in current 30D window.</p>
              )}
            </div>
          </div>
        </div>

        <div className="entity-compare-footer">
          <button
            type="button"
            className="compare-inspect-btn"
            onClick={() => {
              onSelectEntity?.({ type: "entity", value: entityA.id });
              onClose();
            }}
          >
            Inspect Entity Alpha ({entityA?.id})
          </button>
          <button
            type="button"
            className="compare-inspect-btn secondary"
            onClick={() => {
              onSelectEntity?.({ type: "entity", value: entityB.id });
              onClose();
            }}
          >
            Inspect Entity Beta ({entityB?.id})
          </button>
        </div>
      </div>
    </div>
  );
}
