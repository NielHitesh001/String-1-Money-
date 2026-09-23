import React, { useMemo, useState } from "react";
import RiskScorePopover from "./RiskScorePopover";

const riskLabel = (risk) => (risk >= 80 ? "Critical" : risk >= 55 ? "Elevated" : "Standard");
const riskClass = (risk) => (risk >= 80 ? "risk-tag-critical" : risk >= 55 ? "risk-tag-elevated" : "risk-tag-standard");

function formatRelativeTime(dateString) {
  if (!dateString) return "just now";
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return `${Math.max(1, Math.floor(diff))}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  } catch {
    return dateString;
  }
}

export default function BloombergBlotter({
  entities,
  transactions,
  selectedId,
  onSelect,
  onTraceOrigin,
  onAddToCase,
  onDismissAlert,
  activeCaseId,
  role,
}) {
  const [subTab, setSubTab] = useState("transactions"); // "transactions" | "entities"
  const [sortField, setSortField] = useState("risk");
  const [sortAsc, setSortAsc] = useState(false);
  const [filterText, setFilterText] = useState("");
  const [quickFilter, setQuickFilter] = useState("all"); // "all" | "high_risk" | "cross_border" | "flagged"
  const [expandedRowId, setExpandedRowId] = useState(null);
  const [activePopover, setActivePopover] = useState(null); // { transaction, sourceEntity, targetEntity, position }
  const [openMenuId, setOpenMenuId] = useState(null);

  const entityMap = useMemo(() => new Map(entities.map((e) => [e.id, e])), [entities]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const sortedTransactions = useMemo(() => {
    const list = transactions.filter((tx) => {
      // Quick filter
      if (quickFilter === "high_risk" && tx.risk < 80) return false;
      if (quickFilter === "flagged" && !tx.flag) return false;
      if (quickFilter === "cross_border" && !tx.crossBorder && !tx.flag) return false;

      if (!filterText) return true;
      const q = filterText.toLowerCase();
      const s = entityMap.get(tx.source)?.name || "";
      const t = entityMap.get(tx.target)?.name || "";
      return (
        tx.id.toLowerCase().includes(q) ||
        tx.currency.toLowerCase().includes(q) ||
        tx.rail.toLowerCase().includes(q) ||
        (tx.flag && tx.flag.toLowerCase().includes(q)) ||
        s.toLowerCase().includes(q) ||
        t.toLowerCase().includes(q)
      );
    });

    return list.sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];
      if (sortField === "source") valA = entityMap.get(a.source)?.name || a.source;
      if (sortField === "target") valB = entityMap.get(b.target)?.name || b.target;
      if (typeof valA === "string") {
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortAsc ? (valA || 0) - (valB || 0) : (valB || 0) - (valA || 0);
    });
  }, [transactions, entityMap, filterText, quickFilter, sortField, sortAsc]);

  const sortedEntities = useMemo(() => {
    const list = entities.filter((e) => {
      if (!filterText) return true;
      const q = filterText.toLowerCase();
      return (
        e.id.toLowerCase().includes(q) ||
        e.name.toLowerCase().includes(q) ||
        e.country.toLowerCase().includes(q) ||
        e.kind.toLowerCase().includes(q)
      );
    });

    return list.sort((a, b) => {
      const valA = a[sortField] ?? "";
      const valB = b[sortField] ?? "";
      if (typeof valA === "string") {
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortAsc ? (valA || 0) - (valB || 0) : (valB || 0) - (valA || 0);
    });
  }, [entities, filterText, sortField, sortAsc]);

  const toggleExpandRow = (id, e) => {
    e?.stopPropagation();
    setExpandedRowId((prev) => (prev === id ? null : id));
  };

  const handleExportSingleTx = (tx) => {
    const blob = new Blob([JSON.stringify(tx, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-record-${tx.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bloomberg-blotter-container">
      <div className="blotter-toolbar">
        <div className="blotter-tabs">
          <button
            className={`blotter-tab-btn ${subTab === "transactions" ? "active" : ""}`}
            onClick={() => {
              setSubTab("transactions");
              setSortField("risk");
              setSortAsc(false);
            }}
          >
            📋 ALL FLOWS BLOTTER ({transactions.length})
          </button>
          <button
            className={`blotter-tab-btn ${subTab === "entities" ? "active" : ""}`}
            onClick={() => {
              setSubTab("entities");
              setSortField("risk");
              setSortAsc(false);
            }}
          >
            🏛 INSTITUTION DIRECTORY ({entities.length})
          </button>
        </div>

        {subTab === "transactions" && (
          <div className="blotter-quick-filters">
            <button
              className={`filter-chip ${quickFilter === "all" ? "active" : ""}`}
              onClick={() => setQuickFilter("all")}
            >
              All
            </button>
            <button
              className={`filter-chip ${quickFilter === "high_risk" ? "active" : ""}`}
              onClick={() => setQuickFilter("high_risk")}
            >
              🔥 Critical (&ge;80)
            </button>
            <button
              className={`filter-chip ${quickFilter === "flagged" ? "active" : ""}`}
              onClick={() => setQuickFilter("flagged")}
            >
              ⚠️ Flagged
            </button>
            <button
              className={`filter-chip ${quickFilter === "cross_border" ? "active" : ""}`}
              onClick={() => setQuickFilter("cross_border")}
            >
              🌐 Cross-Border
            </button>
          </div>
        )}

        <div className="blotter-quick-search">
          <span>⌕</span>
          <input
            type="text"
            placeholder={`Filter ${subTab}...`}
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
          />
          {filterText && <button onClick={() => setFilterText("")}>×</button>}
        </div>
      </div>

      <div className="blotter-table-wrapper">
        {subTab === "transactions" ? (
          <table className="bloomberg-table">
            <thead>
              <tr>
                <th style={{ width: "30px" }}></th>
                <th onClick={() => handleSort("risk")}>
                  RISK {sortField === "risk" ? (sortAsc ? "▲" : "▼") : ""}
                </th>
                <th onClick={() => handleSort("id")}>
                  TX ID {sortField === "id" ? (sortAsc ? "▲" : "▼") : ""}
                </th>
                <th onClick={() => handleSort("amount")}>
                  AMOUNT / CCY {sortField === "amount" ? (sortAsc ? "▲" : "▼") : ""}
                </th>
                <th onClick={() => handleSort("source")}>CORRIDOR (SOURCE → DESTINATION)</th>
                <th onClick={() => handleSort("rail")}>RAIL</th>
                <th onClick={() => handleSort("date")}>
                  TIMESTAMP {sortField === "date" ? (sortAsc ? "▲" : "▼") : ""}
                </th>
                <th>ALERT REASON</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {sortedTransactions.map((tx) => {
                const isSelected = selectedId === tx.id;
                const isExpanded = expandedRowId === tx.id;
                const source = entityMap.get(tx.source);
                const target = entityMap.get(tx.target);
                const isMenuOpen = openMenuId === tx.id;

                return (
                  <React.Fragment key={tx.id}>
                    <tr
                      className={`blotter-row ${isSelected ? "selected-row" : ""} ${isExpanded ? "expanded-parent" : ""}`}
                      onClick={() => onSelect({ type: "transaction", value: tx.id })}
                    >
                      <td className="expand-cell" onClick={(e) => toggleExpandRow(tx.id, e)}>
                        <button className="row-expand-arrow" aria-label="Expand route corridor">
                          {isExpanded ? "▼" : "▶"}
                        </button>
                      </td>

                      <td
                        className="risk-cell-interactive"
                        onClick={(e) => {
                          e.stopPropagation();
                          const rect = e.currentTarget.getBoundingClientRect();
                          setActivePopover({
                            transaction: tx,
                            sourceEntity: source,
                            targetEntity: target,
                            position: { top: rect.bottom + 8, left: rect.left },
                          });
                        }}
                        title="Click to view risk scoring factor breakdown"
                      >
                        <span className={`risk-badge ${riskClass(tx.risk)}`}>
                          {tx.risk} · {riskLabel(tx.risk)}
                        </span>
                      </td>

                      <td>
                        <strong className="tx-id-cell">{tx.id}</strong>
                      </td>

                      <td className="amount-cell">
                        <strong>
                          {tx.display || `$${(tx.amount / 1e6).toFixed(2)}M`} {tx.currency}
                        </strong>
                      </td>

                      <td title={`${source?.name} → ${target?.name}`}>
                        <div className="corridor-summary-cell">
                          <span className="corridor-node">
                            <b>[{source?.country || "US"}]</b> {source?.name || tx.source}
                          </span>
                          <span className="corridor-arrow">→</span>
                          <span className="corridor-node">
                            <b>[{target?.country || "AE"}]</b> {target?.name || tx.target}
                          </span>
                        </div>
                      </td>

                      <td>
                        <span className="rail-tag">{tx.rail || "SWIFT"}</span>
                      </td>

                      <td className="timestamp-cell" title={tx.date}>
                        {formatRelativeTime(tx.date)}
                      </td>

                      <td>
                        {tx.flag ? (
                          <span className="flag-danger-badge">⚠ {tx.flag}</span>
                        ) : (
                          <span className="flag-clear-badge">Standard clearance</span>
                        )}
                      </td>

                      <td className="actions-cell" onClick={(e) => e.stopPropagation()}>
                        <div className="row-action-btn-group">
                          <button
                            className="blotter-action-btn"
                            title="Inspect in side panel"
                            onClick={() => onSelect({ type: "transaction", value: tx.id })}
                          >
                            Inspect
                          </button>

                          <div className="action-menu-anchor">
                            <button
                              className="action-menu-dots"
                              onClick={() => setOpenMenuId(isMenuOpen ? null : tx.id)}
                              title="Transaction Actions"
                            >
                              •••
                            </button>

                            {isMenuOpen && (
                              <div className="action-menu-dropdown" onMouseLeave={() => setOpenMenuId(null)}>
                                <button
                                  onClick={() => {
                                    onSelect({ type: "transaction", value: tx.id });
                                    onTraceOrigin(tx.source);
                                    setOpenMenuId(null);
                                  }}
                                >
                                  ◉ Investigate & Trace
                                </button>
                                {role !== "Analyst" && (
                                  <button
                                    onClick={() => {
                                      onAddToCase(tx.id);
                                      setOpenMenuId(null);
                                    }}
                                  >
                                    + Escalate to Case
                                  </button>
                                )}
                                <button
                                  onClick={() => {
                                    onDismissAlert?.(tx.id);
                                    setOpenMenuId(null);
                                  }}
                                >
                                  ✕ Dismiss Alert
                                </button>
                                <button
                                  onClick={() => {
                                    handleExportSingleTx(tx);
                                    setOpenMenuId(null);
                                  }}
                                >
                                  ⬇ Export Audit JSON
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>

                    {/* In-Place Expanded Route Corridor Segment */}
                    {isExpanded && (
                      <tr className="expanded-row-details">
                        <td colSpan={9}>
                          <div className="in-place-route-segment">
                            <div className="route-segment-header">
                              <strong>CORRIDOR TRACE & SETTLEMENT HOPS</strong>
                              <span>Transaction ID: {tx.id} · Settlement: {tx.rail}</span>
                            </div>

                            <div className="route-hops-flow">
                              <div className="hop-card">
                                <small>Origin Endpoint</small>
                                <strong>{source?.name || tx.source}</strong>
                                <span>Jurisdiction: {source?.country || "US"}</span>
                              </div>

                              <div className="hop-arrow-connector">
                                <div className="hop-line"></div>
                                <span className="hop-badge">{tx.rail || "SWIFT"} pacs.008</span>
                              </div>

                              <div className="hop-card">
                                <small>Correspondent Intermediary</small>
                                <strong>{tx.routing?.correspondent || "JPMorgan Chase N.A. (Direct)"}</strong>
                                <span>BIC: {source?.bic || "CHASUS33"}</span>
                              </div>

                              <div className="hop-arrow-connector">
                                <div className="hop-line"></div>
                                <span className="hop-badge">${(Number(tx.amount) / 1e6).toFixed(1)}M {tx.currency}</span>
                              </div>

                              <div className="hop-card">
                                <small>Destination Beneficiary</small>
                                <strong>{target?.name || tx.target}</strong>
                                <span>Jurisdiction: {target?.country || "AE"}</span>
                              </div>
                            </div>

                            <div className="route-segment-footer">
                              <span>Alert Flag: <b>{tx.flag || "None"}</b></span>
                              <span>Risk Score: <b className={tx.risk >= 80 ? "critical" : "standard"}>{tx.risk}/100</b></span>
                              <button
                                className="trace-pin-btn"
                                onClick={() => {
                                  onSelect({ type: "transaction", value: tx.id });
                                  onTraceOrigin(tx.source);
                                }}
                              >
                                Pin & Trace in Relationship Graph →
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        ) : (
          <table className="bloomberg-table">
            <thead>
              <tr>
                <th onClick={() => handleSort("id")}>
                  ENTITY ID {sortField === "id" ? (sortAsc ? "▲" : "▼") : ""}
                </th>
                <th onClick={() => handleSort("name")}>
                  LEGAL INSTITUTION NAME {sortField === "name" ? (sortAsc ? "▲" : "▼") : ""}
                </th>
                <th onClick={() => handleSort("kind")}>
                  KIND {sortField === "kind" ? (sortAsc ? "▲" : "▼") : ""}
                </th>
                <th onClick={() => handleSort("country")}>
                  JURISDICTION {sortField === "country" ? (sortAsc ? "▲" : "▼") : ""}
                </th>
                <th>IDENTIFIER (BIC / LEI)</th>
                <th onClick={() => handleSort("risk")}>
                  RISK SCORE {sortField === "risk" ? (sortAsc ? "▲" : "▼") : ""}
                </th>
                <th>PEP SCREENING</th>
                <th>SANCTIONS</th>
                <th>TYPOLOGIES</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {sortedEntities.map((entity) => {
                const isSelected = selectedId === entity.id;
                return (
                  <tr
                    key={entity.id}
                    className={`blotter-row ${isSelected ? "selected-row" : ""}`}
                    onClick={() => onSelect({ type: "entity", value: entity.id })}
                  >
                    <td>
                      <strong className="entity-id-cell">{entity.id}</strong>
                    </td>
                    <td>
                      <span className="entity-name-cell">{entity.name}</span>
                    </td>
                    <td>
                      <span className="kind-tag">{entity.kind}</span>
                    </td>
                    <td>
                      <span className="country-tag">🏛 {entity.country}</span>
                    </td>
                    <td className="mono-cell">
                      {entity.bic || entity.lei || entity.account || "—"}
                    </td>
                    <td>
                      <span className={`risk-badge ${riskClass(entity.risk)}`}>
                        {entity.risk} · {riskLabel(entity.risk)}
                      </span>
                    </td>
                    <td>
                      <span
                        className={
                          entity.aml?.pep !== "Clear" ? "flag-danger-badge" : "flag-clear-badge"
                        }
                      >
                        {entity.aml?.pep || "Clear"}
                      </span>
                    </td>
                    <td>
                      <span
                        className={
                          entity.aml?.sanctions !== "No match"
                            ? "flag-danger-badge"
                            : "flag-clear-badge"
                        }
                      >
                        {entity.aml?.sanctions || "No match"}
                      </span>
                    </td>
                    <td>
                      {entity.aml?.typologies?.length ? (
                        <span className="typology-pill">{entity.aml.typologies.join(", ")}</span>
                      ) : (
                        <span className="flag-clear-badge">—</span>
                      )}
                    </td>
                    <td className="actions-cell" onClick={(e) => e.stopPropagation()}>
                      <button
                        className="blotter-action-btn"
                        onClick={() => onSelect({ type: "entity", value: entity.id })}
                      >
                        Inspect →
                      </button>
                      <button
                        className="blotter-action-btn trace"
                        title={`Trace path from ${entity.id}`}
                        onClick={() => onTraceOrigin(entity.id)}
                      >
                        ◉ Trace
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="blotter-footer">
        <span>
          BLOOMBERG TERMINAL DATA GRID · DISPLAYING{" "}
          {subTab === "transactions" ? sortedTransactions.length : sortedEntities.length} RECORDS
        </span>
        <span className="status-live-mono">● LIVE INTERBANK STREAM</span>
      </div>

      {/* Popover */}
      {activePopover && (
        <RiskScorePopover
          transaction={activePopover.transaction}
          sourceEntity={activePopover.sourceEntity}
          targetEntity={activePopover.targetEntity}
          position={activePopover.position}
          onClose={() => setActivePopover(null)}
        />
      )}
    </div>
  );
}
