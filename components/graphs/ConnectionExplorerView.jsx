import React, { useMemo, useState } from "react";
import { findBidirectionalPath, findDirectedPath } from "../../lib/investigationUtils.mjs";
import { transactions as mockTransactions, entities as mockEntities } from "../../data/intelligenceMock";
import { getCompanyIntelligence } from "../../data/companyIntelligenceData";

export default function ConnectionExplorerView({
  selectedId = "BLACKROCK-US",
  onSelectEntity,
  onOpenCompany,
}) {
  const [sourceId, setSourceId] = useState(selectedId || "BLACKROCK-US");
  const [targetId, setTargetId] = useState("JIO-IN");
  const [pathMode, setPathMode] = useState("any"); // "any" | "directed"
  const [activeStep, setActiveStep] = useState(0);

  // Entities list for dropdown
  const entityList = useMemo(() => {
    const list = [
      { id: "BLACKROCK-US", name: "BlackRock, Inc.", country: "US", risk: 15 },
      { id: "JIO-IN", name: "Jio Financial Services Ltd.", country: "IN", risk: 22 },
      { id: "RELIANCE-IN", name: "Reliance Industries Ltd.", country: "IN", risk: 28 },
      { id: "Q312", name: "Apple Inc.", country: "US", risk: 73 },
      { id: "HARBOR-AE", name: "Harbor Trading FZE", country: "AE", risk: 92 },
      { id: "NORD-EE", name: "NordEast Commerce OÜ", country: "EE", risk: 88 },
      { id: "JPM-US", name: "JPMorgan Chase & Co.", country: "US", risk: 18 },
      { id: "DB-DE", name: "Deutsche Bank AG", country: "DE", risk: 42 },
      { id: "ORION-HK", name: "Orion Logistics Ltd.", country: "HK", risk: 84 },
    ];
    return list;
  }, []);

  // Compute route path
  const pathResult = useMemo(() => {
    if (!sourceId || !targetId) return { nodeIds: [], edgeIds: [] };
    if (sourceId === targetId) return { nodeIds: [sourceId], edgeIds: [] };

    return pathMode === "directed"
      ? findDirectedPath(mockTransactions, sourceId, targetId)
      : findBidirectionalPath(mockTransactions, sourceId, targetId);
  }, [sourceId, targetId, pathMode]);

  const swapEntities = () => {
    const prev = sourceId;
    setSourceId(targetId);
    setTargetId(prev);
  };

  const routeHops = useMemo(() => {
    if (!pathResult.nodeIds || pathResult.nodeIds.length === 0) return [];
    return pathResult.nodeIds.map((nodeId, idx) => {
      const intel = getCompanyIntelligence(nodeId);
      const isStart = idx === 0;
      const isEnd = idx === pathResult.nodeIds.length - 1;
      const edgeId = idx < pathResult.edgeIds.length ? pathResult.edgeIds[idx] : null;
      const tx = edgeId ? mockTransactions.find((t) => t.id === edgeId) : null;

      return {
        stepNumber: idx + 1,
        id: nodeId,
        name: intel.name,
        country: intel.country,
        risk: intel.risk_score || 25,
        type: intel.entity_type,
        role: isStart ? "Origin Entity" : isEnd ? "Destination Target" : "Intermediary Corridor Node",
        edge: tx
          ? {
              id: tx.id,
              amount: tx.display || `$${(tx.amount / 1e6).toFixed(1)}M`,
              currency: tx.currency || "USD",
              rail: tx.rail || "SWIFT pacs.008",
              date: tx.date || "2026-08-29",
              risk: tx.risk || 40,
            }
          : {
              id: `CORRIDOR-${idx}`,
              amount: idx === 0 ? "$300.0M Joint Venture" : "$4.5B Holding Stake",
              currency: "USD",
              rail: "Institutional Equity Stake",
              date: "Active 2026",
              risk: 20,
            },
      };
    });
  }, [pathResult]);

  return (
    <div className="conn-explorer-viewport">
      {/* Top Header & Selector Controls */}
      <div className="conn-explorer-header">
        <div className="conn-title-group">
          <span className="eyebrow">MULTI-HOP CORPORATE CORRIDOR DISCOVERY</span>
          <h2>Multi-Entity Connection Route Explorer</h2>
        </div>

        <div className="conn-mode-toggles">
          <button
            className={`conn-pill ${pathMode === "any" ? "active" : ""}`}
            onClick={() => setPathMode("any")}
          >
            ⇄ Any Relationship (Joint Ventures, Equity, Fills)
          </button>
          <button
            className={`conn-pill ${pathMode === "directed" ? "active" : ""}`}
            onClick={() => setPathMode("directed")}
          >
            ➔ Directed Cash Flows Only
          </button>
        </div>
      </div>

      {/* Input Selection Row */}
      <div className="conn-selection-bar">
        <div className="conn-input-field">
          <label>ORIGIN ENTITY (A)</label>
          <select value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
            {entityList.map((e) => (
              <option key={`src-${e.id}`} value={e.id}>
                [{e.country}] {e.name} (Risk: {e.risk})
              </option>
            ))}
          </select>
        </div>

        <button className="conn-swap-button" title="Swap Origin & Destination" onClick={swapEntities}>
          ⇄
        </button>

        <div className="conn-input-field">
          <label>DESTINATION TARGET (B)</label>
          <select value={targetId} onChange={(e) => setTargetId(e.target.value)}>
            {entityList.map((e) => (
              <option key={`dst-${e.id}`} value={e.id}>
                [{e.country}] {e.name} (Risk: {e.risk})
              </option>
            ))}
          </select>
        </div>

        <div className="conn-quick-presets">
          <span className="presets-lbl">Quick Corridors:</span>
          <button
            className="preset-btn"
            onClick={() => {
              setSourceId("BLACKROCK-US");
              setTargetId("JIO-IN");
            }}
          >
            BlackRock ➔ Jio (JV)
          </button>
          <button
            className="preset-btn"
            onClick={() => {
              setSourceId("BLACKROCK-US");
              setTargetId("RELIANCE-IN");
            }}
          >
            BlackRock ➔ Reliance (2 Hops)
          </button>
          <button
            className="preset-btn"
            onClick={() => {
              setSourceId("HARBOR-AE");
              setTargetId("NORD-EE");
            }}
          >
            Harbor ➔ NordEast (PEP)
          </button>
        </div>
      </div>

      {/* Route Traversal Visualizer */}
      <div className="conn-route-stage">
        {routeHops.length > 0 ? (
          <div className="conn-route-container">
            <div className="route-summary-bar">
              <span className="route-badge found">✓ Route Verified</span>
              <span className="route-meta">
                <strong>{routeHops.length} Nodes</strong> · <strong>{routeHops.length - 1} Corridors</strong>
                {" · "}Shortest institutional path evaluated
              </span>
            </div>

            <div className="route-stepper-track">
              {routeHops.map((hop, idx) => {
                const isSelected = selectedId === hop.id;
                const isCritical = hop.risk >= 60;
                return (
                  <React.Fragment key={hop.id}>
                    {/* Node Card */}
                    <div
                      className={`route-node-card ${isSelected ? "selected" : ""} ${isCritical ? "critical" : "standard"}`}
                      onClick={() => onSelectEntity(hop.id)}
                      onDoubleClick={() => onOpenCompany && onOpenCompany(hop.id)}
                    >
                      <div className="card-badge-row">
                        <span className="step-num">Step {hop.stepNumber}</span>
                        <span className={`risk-tag ${isCritical ? "red" : "green"}`}>
                          Risk {hop.risk}
                        </span>
                      </div>
                      <h4 className="node-title">{hop.name}</h4>
                      <div className="node-sub">
                        <span>{hop.type}</span>
                        <span className="country-tag">[{hop.country}]</span>
                      </div>
                      <div className="node-role">{hop.role}</div>
                      <button
                        className="inspect-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectEntity(hop.id);
                        }}
                      >
                        Inspect Dossier ➔
                      </button>
                    </div>

                    {/* Edge / Corridor Connector */}
                    {idx < routeHops.length - 1 && (
                      <div className="route-edge-connector">
                        <div className="edge-line">
                          <div className="edge-flow-particle" />
                        </div>
                        <div className="edge-payload-card">
                          <span className="edge-rail">{hop.edge.rail}</span>
                          <strong className="edge-amt">{hop.edge.amount}</strong>
                          <span className="edge-date">{hop.edge.date}</span>
                        </div>
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="conn-no-route">
            <div className="no-route-icon">∅</div>
            <h3>No Direct or Multi-Hop Corridor Discovered</h3>
            <p>
              No direct cash flows, equity ownership stakes, or board interlocks exist between {sourceId} and {targetId}.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
