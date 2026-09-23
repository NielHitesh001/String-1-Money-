import React from "react";

export default function NetworkKpiRow({
  highRiskCount = 4,
  highRiskDelta = "↑ 1 new",
  newFlowsCount = 12,
  newFlowsDelta = "↑ 8 vs 7d avg",
  unusualPatternsCount = 2,
  unusualDelta = "↑ 1 flagged",
  verifiedPct = 78,
  verifiedDelta = "↓ 2% alerts",
  onFilterHighRisk,
  onFilterNewFlows,
  onInvestigateUnusual,
  onOpenAudit,
}) {
  return (
    <div className="network-kpi-row" role="region" aria-label="Network Intelligence KPIs">
      {/* KPI 1: High Risk Entities */}
      <div className="kpi-card high-risk-card" onClick={onFilterHighRisk}>
        <div className="kpi-card-header">
          <span className="kpi-title">HIGH-RISK ENTITIES</span>
          <span className="kpi-delta danger">{highRiskDelta}</span>
        </div>
        <div className="kpi-main-val">
          <strong>{highRiskCount}</strong>
          <small>Risk &ge; 70/100</small>
        </div>
        <div className="kpi-card-footer">
          <button type="button" className="kpi-action-link">View List →</button>
        </div>
      </div>

      {/* KPI 2: New Flows (7D) */}
      <div className="kpi-card flows-card" onClick={onFilterNewFlows}>
        <div className="kpi-card-header">
          <span className="kpi-title">NEW FLOWS (7D)</span>
          <span className="kpi-delta warning">{newFlowsDelta}</span>
        </div>
        <div className="kpi-main-val">
          <strong>{newFlowsCount}</strong>
          <small>Active Transfers</small>
        </div>
        <div className="kpi-card-footer">
          <button type="button" className="kpi-action-link">View Details →</button>
        </div>
      </div>

      {/* KPI 3: Unusual Patterns */}
      <div className="kpi-card anomaly-card" onClick={onInvestigateUnusual}>
        <div className="kpi-card-header">
          <span className="kpi-title">UNUSUAL PATTERNS</span>
          <span className="kpi-delta danger">{unusualDelta}</span>
        </div>
        <div className="kpi-main-val">
          <strong>{unusualPatternsCount}</strong>
          <small>Circular & Sanctions Proximity</small>
        </div>
        <div className="kpi-card-footer">
          <button type="button" className="kpi-action-link">Investigate →</button>
        </div>
      </div>

      {/* KPI 4: Verified Status */}
      <div className="kpi-card status-card" onClick={onOpenAudit}>
        <div className="kpi-card-header">
          <span className="kpi-title">VERIFIED DATA STATUS</span>
          <span className="kpi-delta neutral">{verifiedDelta}</span>
        </div>
        <div className="kpi-main-val">
          <strong>{verifiedPct}%</strong>
          <small>SEC / Statutory Audited</small>
        </div>
        <div className="kpi-card-footer">
          <button type="button" className="kpi-action-link">Audit Lineage →</button>
        </div>
      </div>
    </div>
  );
}
