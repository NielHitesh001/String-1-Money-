import React from "react";

export default function AlertBanner({
  criticalCount = 0,
  elevatedCount = 0,
  standardCount = 0,
  activeFilter = null,
  onFilterSelect,
  onClearFilter,
  onDismissBanner,
}) {
  const totalHighRisk = criticalCount + elevatedCount;
  if (totalHighRisk === 0 && !activeFilter) return null;

  return (
    <div className="alert-banner" role="alert" aria-live="polite">
      <div className="alert-banner-content">
        <div className="alert-banner-badge">
          <span className="alert-pulse-icon">⚠️</span>
          <strong className="alert-headline">
            {totalHighRisk} High-Risk Corridors Detected (Last 24H)
          </strong>
        </div>

        <div className="alert-severity-chips">
          <button
            type="button"
            className={`severity-chip critical ${activeFilter === "critical" ? "active" : ""}`}
            onClick={() => onFilterSelect(activeFilter === "critical" ? null : "critical")}
            title="Filter to Critical risk (>= 80)"
          >
            <span className="chip-indicator"></span>
            Critical: <b>{criticalCount}</b>
          </button>

          <button
            type="button"
            className={`severity-chip elevated ${activeFilter === "elevated" ? "active" : ""}`}
            onClick={() => onFilterSelect(activeFilter === "elevated" ? null : "elevated")}
            title="Filter to Elevated risk (55 - 79)"
          >
            <span className="chip-indicator"></span>
            Elevated: <b>{elevatedCount}</b>
          </button>

          <button
            type="button"
            className={`severity-chip standard ${activeFilter === "standard" ? "active" : ""}`}
            onClick={() => onFilterSelect(activeFilter === "standard" ? null : "standard")}
            title="Filter to Standard risk (< 55)"
          >
            <span className="chip-indicator"></span>
            Standard: <b>{standardCount}</b>
          </button>
        </div>

        {activeFilter && (
          <button
            type="button"
            className="alert-clear-btn"
            onClick={onClearFilter}
          >
            Clear Filter (Viewing: {activeFilter.toUpperCase()}) ✕
          </button>
        )}
      </div>

      <div className="alert-banner-actions">
        <span className="alert-guidance-hint">
          Auto-triaging with FATF & OFAC feeds
        </span>
        {onDismissBanner && (
          <button
            type="button"
            className="alert-dismiss-icon"
            onClick={onDismissBanner}
            title="Dismiss banner"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
