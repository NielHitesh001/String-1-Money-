import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { forceCollide } from "d3-force";
import ForceGraph2D from "react-force-graph-2d";
import EntityIntelligencePanel from "./EntityIntelligencePanel";
import NetworkKpiRow from "./NetworkKpiRow";
import TimelineSlider from "./TimelineSlider";
import BloombergSPLCGraph from "./graphs/BloombergSPLCGraph";
import BloombergMapOrbitGraph from "./graphs/BloombergMapOrbitGraph";
import ConnectionExplorerView from "./graphs/ConnectionExplorerView";
import { getCompanyIntelligence, companyIntelligenceDb, generateCompanyNetworkGraph } from "../data/companyIntelligenceData";

const API_ROOT = "/corpgraph/api";

const getRiskGlowColor = (risk) => {
  if (risk >= 80) return "rgba(226, 75, 74, 0.4)";
  if (risk >= 60) return "rgba(240, 153, 123, 0.35)";
  if (risk >= 40) return "rgba(254, 240, 138, 0.3)";
  return "rgba(110, 231, 183, 0.25)";
};

const getRiskColor = (risk) => {
  if (risk >= 80) return "#E24B4A";
  if (risk >= 60) return "#F0997B";
  if (risk >= 40) return "#FEF08A";
  return "#6ee7b7";
};

const getEdgeTypeColor = (type) => {
  if (type === "OWNS" || type === "HAS_SUBSIDIARY") return "#3b82f6"; // Blue: Equity
  if (type === "SUPPLIER_TO" || type === "TRADE") return "#10b981"; // Green: Trade
  if (type === "LOAN" || type === "DEBT") return "#f97316"; // Orange: Debt
  if (type === "SANCTIONED" || type === "SUSPICIOUS") return "#ef4444"; // Red: Flagged
  return "#8b78ff";
};

const readable = (value) =>
  String(value || "—")
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function CompanyNetworkPanel({ onAudit, onCompareWithEntity }) {
  const stageRef = useRef(null);
  const graphRef = useRef(null);
  const onAuditRef = useRef(onAudit);
  const centerIdRef = useRef(null);
  const hasAutoOpenedRef = useRef(false);
  const lastClickRef = useRef({ time: 0, id: null });
  const searchBlockRef = useRef(null);

  const [dimensions, setDimensions] = useState({ width: 1000, height: 600 });
  const [query, setQuery] = useState("Apple");
  const [results, setResults] = useState([]);
  const [network, setNetwork] = useState(null);
  const [selectedId, setSelectedId] = useState("Q312");
  const [graphViewMode, setGraphViewMode] = useState("topology"); // "topology" | "splc" | "map" | "explorer"
  const [selectedLink, setSelectedLink] = useState(null);
  const [depth, setDepth] = useState(1);
  const [relationship, setRelationship] = useState("");
  const [riskOnly, setRiskOnly] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [progressiveDisclosure, setProgressiveDisclosure] = useState(true);
  const [breadcrumbs, setBreadcrumbs] = useState([]);
  const [activeTimelineDate, setActiveTimelineDate] = useState("2026-08-29");
  const [timelineVisible, setTimelineVisible] = useState(true);

  const [hoveredNode, setHoveredNode] = useState(null);
  const [hoveredLink, setHoveredLink] = useState(null);
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [masterOpen, setMasterOpen] = useState(false);
  const [masterLoading, setMasterLoading] = useState(false);
  const [masterCompanies, setMasterCompanies] = useState([]);
  const [masterFilter, setMasterFilter] = useState("");

  useEffect(() => {
    onAuditRef.current = onAudit;
  }, [onAudit]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchBlockRef.current && !searchBlockRef.current.contains(e.target)) {
        setSearchFocused(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!stageRef.current) return undefined;
    const resize = () => {
      const rect = stageRef.current?.getBoundingClientRect();
      if (rect)
        setDimensions({
          width: Math.max(rect.width, 480),
          height: Math.max(rect.height, 400),
        });
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(stageRef.current);
    return () => observer.disconnect();
  }, []);

  const openCompany = useCallback(
    async (entityId, appendBreadcrumb = true) => {
      setLoading(true);
      setError("");
      try {
        const suffix = relationship ? `&relationship_type=${encodeURIComponent(relationship)}` : "";
        let payload = null;

        // Try candidate IDs (direct ID and wikidata_ prefix if applicable)
        const candidates = [entityId];
        if (!entityId.startsWith("wikidata_") && entityId.startsWith("Q")) {
          candidates.unshift(`wikidata_${entityId}`);
        }

        for (const candidate of candidates) {
          try {
            const response = await fetch(
              `${API_ROOT}/company/${encodeURIComponent(candidate)}/relationships?depth=${depth}&limit=150${suffix}`
            );
            if (response.ok) {
              const data = await response.json();
              if (data && (data.nodes?.length > 0 || data.center)) {
                payload = data;
                break;
              }
            }
          } catch {
            // continue
          }
        }

        // If backend does not have graph or failed, fallback to high-fidelity knowledge graph generator
        if (!payload || !payload.nodes || payload.nodes.length === 0) {
          payload = generateCompanyNetworkGraph(entityId);
        }

        // Normalize links and relationships
        if (!payload.links && payload.relationships) {
          payload.links = payload.relationships;
        }

        setNetwork(payload);
        centerIdRef.current = payload.center?.entity_id || payload.center?.id || entityId;
        setSelectedId(entityId);
        setSelectedLink(null);

        if (appendBreadcrumb) {
          setBreadcrumbs((prev) => {
            const normEntityId = entityId.replace(/^wikidata_/, "");
            const existsIndex = prev.findIndex((b) => b.id.replace(/^wikidata_/, "") === normEntityId);
            if (existsIndex >= 0) return prev.slice(0, existsIndex + 1);
            return [...prev, { id: entityId, name: payload.center?.name || entityId }].slice(-5);
          });
        }

        onAuditRef.current?.(`opened corporate intelligence graph: ${entityId}`);
        setTimeout(() => graphRef.current?.zoomToFit(500, 70), 120);
      } catch (reason) {
        const fallbackPayload = generateCompanyNetworkGraph(entityId);
        if (!fallbackPayload.links && fallbackPayload.relationships) {
          fallbackPayload.links = fallbackPayload.relationships;
        }
        setNetwork(fallbackPayload);
        centerIdRef.current = entityId;
        setSelectedId(entityId);
      } finally {
        setLoading(false);
      }
    },
    [depth, relationship]
  );

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      if (query.trim().length < 2) return setResults([]);
      try {
        const response = await fetch(
          `${API_ROOT}/search?q=${encodeURIComponent(query.trim())}&limit=8`,
          { signal: controller.signal }
        );
        if (!response.ok) throw new Error(`Search unavailable (${response.status})`);
        const payload = await response.json();
        setResults(payload);
        if (!hasAutoOpenedRef.current && payload[0]) {
          hasAutoOpenedRef.current = true;
          openCompany(payload[0].entity_id);
        }
      } catch (reason) {
        if (reason?.name !== "AbortError")
          setError(reason instanceof Error ? reason.message : "Search unavailable");
      }
    }, 220);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, openCompany]);

  // Compute real-time predictive company recommendations as user types
  const predictiveRecommendations = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const dbEntries = Object.values(companyIntelligenceDb || {});
    const matchedFromDb = dbEntries.filter((item) => {
      const nameMatch = item.name?.toLowerCase().includes(q);
      const tickerMatch = item.ticker?.toLowerCase().includes(q);
      const idMatch = item.id?.toLowerCase().includes(q);
      const leiMatch = item.lei?.toLowerCase().includes(q);
      const indMatch = item.industry?.toLowerCase().includes(q);
      return nameMatch || tickerMatch || idMatch || leiMatch || indMatch;
    });

    const list = [];
    const seen = new Set();

    matchedFromDb.forEach((item) => {
      seen.add(item.id);
      list.push({
        id: item.id,
        name: item.name,
        ticker: item.ticker || "",
        jurisdiction: item.country || item.jurisdiction || "US",
        risk: item.risk_score || 25,
        type: item.entity_type || "Company",
        prediction: `${item.industry || "Enterprise"} · ${item.ownership_tree?.length || 4} Equity Stakes · ${item.recent_signals?.length || 3} Live Signals`,
        isVerified: item.verification?.status === "Verified",
      });
    });

    results.forEach((r) => {
      if (!seen.has(r.entity_id)) {
        seen.add(r.entity_id);
        list.push({
          id: r.entity_id,
          name: r.name,
          ticker: r.ticker || "",
          jurisdiction: r.jurisdiction || "US",
          risk: r.risk_score || 35,
          type: r.category || "Company",
          prediction: `Security Master Entity · ${r.category || "Institution"}`,
          isVerified: true,
        });
      }
    });

    return list.slice(0, 6);
  }, [query, results]);

  // Predictive Intent queries based on user typing
  const predictiveIntents = useMemo(() => {
    const q = query.trim();
    if (!q || q.length < 2) return [];
    return [
      {
        id: "intent-subs",
        icon: "🏢",
        label: `Trace corporate hierarchy & subsidiaries of "${q}"`,
        action: () => {
          setRelationship("HAS_SUBSIDIARY");
          setDepth(2);
          if (predictiveRecommendations[0]) openCompany(predictiveRecommendations[0].id);
          setSearchFocused(false);
        },
      },
      {
        id: "intent-circular",
        icon: "🔄",
        label: `Scan circular payment flows involving "${q}"`,
        action: () => {
          setFocusMode(true);
          setRiskOnly(true);
          if (predictiveRecommendations[0]) openCompany(predictiveRecommendations[0].id);
          setSearchFocused(false);
        },
      },
      {
        id: "intent-sanctions",
        icon: "⚠️",
        label: `Predict 3-hop AML & sanctions proximity for "${q}"`,
        action: () => {
          setRiskOnly(true);
          setDepth(3);
          if (predictiveRecommendations[0]) openCompany(predictiveRecommendations[0].id);
          setSearchFocused(false);
        },
      },
    ];
  }, [query, predictiveRecommendations, openCompany]);

  useEffect(() => {
    if (centerIdRef.current) openCompany(centerIdRef.current, false);
  }, [depth, relationship]);

  // Keyboard navigation shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) return;
      const fg = graphRef.current;
      if (!fg) return;

      if (e.key === "f" || e.key === "F") {
        setFocusMode((prev) => !prev);
      } else if (e.key === "t" || e.key === "T") {
        setTimelineVisible((prev) => !prev);
      } else if (e.key === "+" || e.key === "=") {
        fg.zoom(fg.zoom() * 1.25, 200);
      } else if (e.key === "-" || e.key === "_") {
        fg.zoom(fg.zoom() / 1.25, 200);
      } else if (e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        fg.zoomToFit(400, 60);
      } else if (e.key === "Escape") {
        setSelectedLink(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const openMaster = useCallback(async () => {
    setMasterOpen(true);
    if (masterCompanies.length) return;
    setMasterLoading(true);
    try {
      const response = await fetch(`${API_ROOT}/companies?limit=1000`);
      if (!response.ok) throw new Error(`Security master unavailable (${response.status})`);
      setMasterCompanies(await response.json());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Security master unavailable");
    } finally {
      setMasterLoading(false);
    }
  }, [masterCompanies.length]);

  const applyNlpTemplate = (templateQuery) => {
    if (templateQuery.includes("Apple")) {
      setQuery("Apple");
      openCompany("Q312");
    } else if (templateQuery.includes("circular") || templateQuery.includes("high-risk")) {
      setRiskOnly(true);
      setQuery("Harbor");
      openCompany("HARBOR-AE");
    } else if (templateQuery.includes("tech")) {
      setQuery("Apple");
      setRiskOnly(false);
      openCompany("Q312");
    }
    onAuditRef.current?.(`executed template search: ${templateQuery}`);
  };

  // Connected nodes for focus mode & single-click ghosting
  const connectedNodeIds = useMemo(() => {
    if (!network || !selectedId) return new Set();
    const set = new Set([selectedId]);
    const links = network.links || network.relationships || [];
    links.forEach((l) => {
      const src = l.source?.id || l.source;
      const tgt = l.target?.id || l.target;
      if (src === selectedId) set.add(tgt);
      if (tgt === selectedId) set.add(src);
    });
    return set;
  }, [network, selectedId]);

  // Graph Data with Intelligence Encoding
  const graphData = useMemo(() => {
    if (!network) return { nodes: [], links: [] };

    const nodesList = network.nodes || [];
    const linksList = network.links || network.relationships || [];
    const centerId = network.center?.entity_id || network.center?.id || selectedId;

    let visibleNodes = riskOnly
      ? nodesList.filter(
          (node) => node.risk_flags?.length || node.id === centerId
        )
      : nodesList;

    if (progressiveDisclosure && visibleNodes.length > 9) {
      const sortedCandidates = visibleNodes
        .filter((n) => n.id !== centerId)
        .sort((a, b) => (b.risk_flags?.length || 0) - (a.risk_flags?.length || 0));

      const topCandidates = new Set([centerId, ...sortedCandidates.slice(0, 8).map((n) => n.id)]);
      visibleNodes = visibleNodes.filter((n) => topCandidates.has(n.id));
    }

    if (focusMode && selectedId) {
      visibleNodes = visibleNodes.filter((n) => connectedNodeIds.has(n.id));
    }

    const visibleIds = new Set(visibleNodes.map((node) => node.id));
    const adjacency = new Map(visibleNodes.map((node) => [node.id, []]));

    linksList.forEach((link) => {
      const src = link.source?.id || link.source;
      const tgt = link.target?.id || link.target;
      if (adjacency.has(src) && adjacency.has(tgt)) {
        adjacency.get(src).push(tgt);
        adjacency.get(tgt).push(src);
      }
    });

    const levels = new Map([[centerId, 0]]);
    const queue = [centerId];
    while (queue.length) {
      const current = queue.shift();
      (adjacency.get(current) || []).forEach((next) => {
        if (!levels.has(next)) {
          levels.set(next, levels.get(current) + 1);
          queue.push(next);
        }
      });
    }

    const rings = new Map();
    visibleNodes.forEach((node) => {
      const level = levels.get(node.id) || 1;
      if (!rings.has(level)) rings.set(level, []);
      rings.get(level).push(node);
    });

    const positioned = [];
    [...rings.entries()]
      .sort(([a], [b]) => a - b)
      .forEach(([level, nodes]) => {
        nodes.sort((a, b) => `${a.category || "Company"}:${a.label || a.name}`.localeCompare(`${b.category || "Company"}:${b.label || b.name}`));
        nodes.forEach((node, index) => {
          const intel = node.intel || getCompanyIntelligence(node.id, node.label || node.name, node.jurisdiction, node.category);
          const baseVolume = intel.metrics_30d?.transaction_volume_90d || 100000000;
          const radius = level === 0 ? 13 : Math.max(6, Math.min(14, Math.sqrt(baseVolume / 300000000)));

          if (level === 0) {
            positioned.push({ ...node, intel, baseRadius: radius, fx: 0, fy: 0 });
          } else {
            const ringRadius = 185 + (level - 1) * 155 + Math.max(0, nodes.length - 18) * 3;
            const angle = (Math.PI * 2 * index) / (nodes.length || 1) - Math.PI / 2;
            positioned.push({
              ...node,
              intel,
              baseRadius: radius,
              fx: Math.cos(angle) * ringRadius,
              fy: Math.sin(angle) * ringRadius,
            });
          }
        });
      });

    // Encode link thickness & anomalies
    const enhancedLinks = linksList
      .filter((link) => {
        const src = link.source?.id || link.source;
        const tgt = link.target?.id || link.target;
        return visibleIds.has(src) && visibleIds.has(tgt);
      })
      .map((link) => {
        const src = link.source?.id || link.source;
        const tgt = link.target?.id || link.target;
        const isAnomalous = link.type === "SANCTIONED" || src === "NORD-EE" || tgt === "HARBOR-AE";
        return {
          ...link,
          source: src,
          target: tgt,
          amount_total: link.amount_total || (link.ownership_percentage ? link.ownership_percentage * 50000000 : 300000000),
          is_anomalous: isAnomalous,
          anomaly_message: isAnomalous ? "↑ 156% volume spike vs 6-month average" : null,
          last_transaction: link.last_transaction || "2026-08-29 09:28 UTC",
        };
      });

    return {
      nodes: positioned,
      links: enhancedLinks,
    };
  }, [network, riskOnly, progressiveDisclosure, focusMode, selectedId, connectedNodeIds]);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) return;
    graph.d3Force("charge")?.strength(-30);
    graph.d3Force("link")?.distance(120);
    graph.d3Force("collision", forceCollide(22));
    graph.d3ReheatSimulation();
  }, [graphData]);

  const selectedNode =
    graphData.nodes.find((node) => node.id === selectedId) || graphData.nodes[0];

  const handleNodeClick = (node) => {
    const now = Date.now();
    const last = lastClickRef.current;
    if (last.id === node.id && now - last.time < 320 && node.category !== "Person") {
      openCompany(node.id);
    } else {
      setSelectedId(node.id);
      setSelectedLink(null);
    }
    lastClickRef.current = { time: now, id: node.id };
  };

  // Node Shape drawing with visual encoding
  const drawNodeShape = (ctx, kind, x, y, r) => {
    ctx.beginPath();
    if (kind === "FinancialInstitution" || kind === "Bank") {
      // Hexagon for Bank/FI
      const a = (2 * Math.PI) / 6;
      for (let i = 0; i < 6; i++) {
        const hx = x + r * Math.cos(a * i);
        const hy = y + r * Math.sin(a * i);
        if (i === 0) ctx.moveTo(hx, hy);
        else ctx.lineTo(hx, hy);
      }
      ctx.closePath();
    } else if (kind === "ShellCompany" || kind === "HoldingCompany") {
      // Square for Shell / Holding
      ctx.rect(x - r, y - r, r * 2, r * 2);
    } else if (kind === "RegulatoryBody") {
      // Diamond for Regulator
      ctx.moveTo(x, y - r * 1.2);
      ctx.lineTo(x + r * 1.2, y);
      ctx.lineTo(x, y + r * 1.2);
      ctx.lineTo(x - r * 1.2, y);
      ctx.closePath();
    } else {
      // Default Circle for Corporation
      ctx.arc(x, y, r, 0, Math.PI * 2, false);
    }
  };

  return (
    <section className="company-network-workspace">
      {/* 1. Network Intelligence KPI Row */}
      <NetworkKpiRow
        highRiskCount={4}
        highRiskDelta="↑ 1 new"
        newFlowsCount={12}
        newFlowsDelta="↑ 8 vs 7d avg"
        unusualPatternsCount={2}
        unusualDelta="↑ 1 flagged"
        verifiedPct={78}
        verifiedDelta="↓ 2% alerts"
        onFilterHighRisk={() => setRiskOnly((p) => !p)}
        onFilterNewFlows={() => {}}
        onInvestigateUnusual={() => openCompany("HARBOR-AE")}
        onOpenAudit={() => {}}
      />

      {/* 2. Fixed Stationary Corporate Graph Toolbar & Search */}
      <header className="company-network-toolbar">
        <div className="company-search-block" ref={searchBlockRef}>
          <div className="company-search-row">
            <label>
              <span>⌕</span>
              <input
                aria-label="Search public corporate network with natural language"
                value={query}
                onFocus={() => setSearchFocused(true)}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setSearchFocused(true);
                  setActiveSuggestionIndex(-1);
                }}
                onKeyDown={(e) => {
                  const total = predictiveRecommendations.length + predictiveIntents.length;
                  if (!total) return;
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setActiveSuggestionIndex((p) => (p + 1) % total);
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setActiveSuggestionIndex((p) => (p <= 0 ? total - 1 : p - 1));
                  } else if (e.key === "Enter") {
                    e.preventDefault();
                    if (activeSuggestionIndex >= 0 && activeSuggestionIndex < predictiveRecommendations.length) {
                      const item = predictiveRecommendations[activeSuggestionIndex];
                      setQuery(item.name);
                      openCompany(item.id);
                      setSearchFocused(false);
                    } else if (activeSuggestionIndex >= predictiveRecommendations.length) {
                      const intentIdx = activeSuggestionIndex - predictiveRecommendations.length;
                      predictiveIntents[intentIdx]?.action();
                    } else if (predictiveRecommendations[0]) {
                      const item = predictiveRecommendations[0];
                      setQuery(item.name);
                      openCompany(item.id);
                      setSearchFocused(false);
                    }
                  } else if (e.key === "Escape") {
                    setSearchFocused(false);
                  }
                }}
                placeholder="Search entity, LEI, or ask: 'Show Apple subsidiaries'..."
              />
            </label>
            <button type="button" onClick={openMaster}>SECURITY MASTER ▾</button>
          </div>

          {/* Real-time Predictive Company Recommendations & Action Intents */}
          {searchFocused && (predictiveRecommendations.length > 0 || predictiveIntents.length > 0) && (
            <div className="company-search-results" role="listbox" aria-label="Company recommendations and predictions">
              {predictiveRecommendations.length > 0 && (
                <>
                  <div className="search-results-section-label">RECOMMENDED COMPANIES & INSTITUTIONS</div>
                  {predictiveRecommendations.map((item, idx) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`search-recommendation-item ${activeSuggestionIndex === idx ? "active" : ""}`}
                      onClick={() => {
                        setQuery(item.name);
                        openCompany(item.id);
                        setSearchFocused(false);
                        onAuditRef.current?.(`selected recommended company: ${item.name} (${item.id})`);
                      }}
                    >
                      <div className="rec-left">
                        <div className="rec-name-row">
                          <strong>{item.name}</strong>
                          {item.ticker && <span className="rec-ticker">{item.ticker}</span>}
                          <span className="rec-jurisdiction">{item.jurisdiction}</span>
                        </div>
                        <div className="rec-prediction">✦ {item.prediction}</div>
                      </div>
                      <div className="rec-right">
                        <span className={`rec-risk-badge ${item.risk >= 70 ? "critical" : item.risk >= 40 ? "elevated" : "standard"}`}>
                          Risk: {item.risk}/100
                        </span>
                        {item.isVerified && <small style={{ color: "#eab308", fontSize: "8.5px" }}>✓ Verified</small>}
                      </div>
                    </button>
                  ))}
                </>
              )}

              {predictiveIntents.length > 0 && (
                <>
                  <div className="search-results-section-label">PREDICTIVE INVESTIGATION ACTIONS</div>
                  {predictiveIntents.map((intent, idx) => {
                    const isSelected = activeSuggestionIndex === predictiveRecommendations.length + idx;
                    return (
                      <button
                        key={intent.id}
                        type="button"
                        className={`rec-intent-item ${isSelected ? "active" : ""}`}
                        onClick={intent.action}
                      >
                        <span className="rec-intent-icon">{intent.icon}</span>
                        <span>{intent.label}</span>
                      </button>
                    );
                  })}
                </>
              )}
            </div>
          )}

          {/* NLP Query Suggestion Chips */}
          <div className="nlp-quick-chips">
            <button type="button" onClick={() => applyNlpTemplate("Show subsidiaries of Apple")}>
              Apple Subs
            </button>
            <button type="button" onClick={() => applyNlpTemplate("Find circular transactions in last 30 days")}>
              Circular Flows
            </button>
            <button type="button" onClick={() => applyNlpTemplate("High-risk suppliers to tech companies")}>
              High-Risk Suppliers
            </button>
          </div>
        </div>

        {/* Global Toolbar Action */}
        <div className="company-network-actions-global">
          <button
            type="button"
            className="recenter-graph-btn"
            onClick={() => {
              if (centerIdRef.current) openCompany(centerIdRef.current, false);
              graphRef.current?.zoomToFit(500, 70);
            }}
            title="Reset view and recenter focal node"
          >
            ⊙ Recenter
          </button>
        </div>
      </header>

      {/* 3. Stationary Fixed Sub-Ribbon for Graph Paradigms & Contextual Controls */}
      <div className="company-network-subribbon">
        {/* Left Side: Permanently Anchored Paradigm Selector Buttons */}
        <div className="graph-paradigm-selector">
          <button
            type="button"
            className={`paradigm-btn ${graphViewMode === "topology" ? "active" : ""}`}
            onClick={() => {
              setGraphViewMode("topology");
              onAuditRef.current?.("switched visualizer to Force Topology");
            }}
            title="Interactive D3 Force-Directed Physics Graph"
          >
            ◉ Force Topology
          </button>
          <button
            type="button"
            className={`paradigm-btn ${graphViewMode === "splc" ? "active" : ""}`}
            onClick={() => {
              setGraphViewMode("splc");
              onAuditRef.current?.("switched visualizer to Bloomberg SPLC Supply Chain Flow");
            }}
            title="Bloomberg SPLC Value & Supply Chain Flow (Suppliers ➔ Core ➔ Customers)"
          >
            🔀 SPLC Supply Chain
          </button>
          <button
            type="button"
            className={`paradigm-btn ${graphViewMode === "map" ? "active" : ""}`}
            onClick={() => {
              setGraphViewMode("map");
              onAuditRef.current?.("switched visualizer to Bloomberg MAP / N219 Star Cluster");
            }}
            title="Bloomberg MAP / N219 Star Cluster Constellation (Holders, Board, Execs, CDS)"
          >
            ⚛ MAP / N219 Star Cluster
          </button>
          <button
            type="button"
            className={`paradigm-btn ${graphViewMode === "explorer" ? "active" : ""}`}
            onClick={() => {
              setGraphViewMode("explorer");
              onAuditRef.current?.("switched visualizer to Connection Route Explorer");
            }}
            title="Multi-Entity Connection Corridor & Path Discovery"
          >
            🧭 Connection Route Explorer
          </button>
        </div>

        {/* Right Side: Contextual Filter Controls */}
        <div className="company-graph-subcontrols">
          {graphViewMode === "topology" && (
            <>
              <label>
                DEPTH
                <select
                  value={depth}
                  onChange={(event) => setDepth(Number(event.target.value))}
                >
                  <option>1</option>
                  <option>2</option>
                  <option>3</option>
                </select>
              </label>
              <label>
                RELATION
                <select
                  value={relationship}
                  onChange={(event) => setRelationship(event.target.value)}
                >
                  <option value="">All Layers</option>
                  <option value="HAS_SUBSIDIARY">Subsidiaries</option>
                  <option value="OFFICER_AT">Officers</option>
                  <option value="OWNS">Ownership</option>
                </select>
              </label>

              <button
                type="button"
                className={focusMode ? "active-filter-pill" : ""}
                onClick={() => setFocusMode((p) => !p)}
                title="Focus Mode (F) - Isolates 1-hop neighborhood"
              >
                ✦ Focus Mode
              </button>

              <button
                type="button"
                className={progressiveDisclosure ? "active-filter-pill" : ""}
                onClick={() => setProgressiveDisclosure((v) => !v)}
                title="Toggle progressive disclosure (top 8 core vs all)"
              >
                {progressiveDisclosure ? "✦ Core Nodes" : "Expand All"}
              </button>

              <button
                type="button"
                className={riskOnly ? "active" : ""}
                onClick={() => setRiskOnly((value) => !value)}
              >
                ⚑ Risk Only
              </button>
            </>
          )}

          {graphViewMode === "splc" && (
            <span className="mode-status-tag">Bloomberg SPLC Value Chain Active</span>
          )}

          {graphViewMode === "map" && (
            <span className="mode-status-tag">Bloomberg N219 Star Orbit Active</span>
          )}

          {graphViewMode === "explorer" && (
            <span className="mode-status-tag">Corporate Corridor Discovery Active</span>
          )}
        </div>
      </div>


      {/* Breadcrumb Trail */}
      {breadcrumbs.length > 0 && (
        <div className="company-breadcrumb-bar">
          <span className="breadcrumb-label">CORRIDOR PATH:</span>
          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={crumb.id}>
              {idx > 0 && <span className="breadcrumb-sep">›</span>}
              <button
                type="button"
                className={`breadcrumb-item ${crumb.id === selectedId ? "active" : ""}`}
                onClick={() => openCompany(crumb.id, false)}
              >
                {crumb.name}
              </button>
            </React.Fragment>
          ))}
          {breadcrumbs.length > 1 && (
            <button
              type="button"
              className="breadcrumb-reset-btn"
              onClick={() => {
                const root = breadcrumbs[0];
                setBreadcrumbs([root]);
                openCompany(root.id, false);
              }}
            >
              Reset Path
            </button>
          )}
        </div>
      )}

      {/* Main Body: Graph Stage + Redesigned Entity Intelligence Panel */}
      <div className="company-network-body">
        <div
          ref={stageRef}
          className={`company-network-stage view-mode-${graphViewMode}`}
          onMouseMove={(e) => {
            const rect = stageRef.current?.getBoundingClientRect();
            if (rect) setHoverPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
          }}
        >
          {loading && <div className="company-network-loading">QUERYING PROPERTY GRAPH & AML ENGINE…</div>}
          {error && <div className="company-network-error">{error}</div>}

          {graphViewMode === "topology" ? (
            <>
              <ForceGraph2D
                ref={graphRef}
                width={dimensions.width}
                height={dimensions.height}
                graphData={graphData}
                backgroundColor="#000000"
                cooldownTicks={100}
                d3AlphaDecay={0.055}
                d3VelocityDecay={0.55}
                linkColor={(link) => {
                  const isSelected = selectedLink?.id === link.id;
                  if (isSelected) return "#ffffff";
                  if (link.is_anomalous) return "#ef4444";
                  return getEdgeTypeColor(link.type);
                }}
                linkWidth={(link) => {
                  if (selectedLink?.id === link.id) return 3.5;
                  if (link.amount_total > 1000000000) return 4.5;
                  if (link.amount_total > 100000000) return 2.8;
                  return 1.4;
                }}
                linkDirectionalArrowLength={4}
                linkDirectionalArrowRelPos={0.88}
                linkDirectionalParticles={(link) => (link.is_anomalous ? 3 : 1)}
                linkDirectionalParticleSpeed={(link) => (link.is_anomalous ? 0.009 : 0.004)}
                linkDirectionalParticleWidth={(link) => (link.is_anomalous ? 3 : 2)}
                linkDirectionalParticleColor={(link) => (link.is_anomalous ? "#ef4444" : "#64dcb1")}
                onNodeClick={handleNodeClick}
                onNodeHover={(node) => setHoveredNode(node || null)}
                onLinkClick={(link) => {
                  setSelectedLink(link);
                  setSelectedId(null);
                }}
                onLinkHover={(link) => setHoveredLink(link || null)}
                nodePointerAreaPaint={(node, color, context) => {
                  context.fillStyle = color;
                  context.beginPath();
                  context.arc(node.x, node.y, 20, 0, Math.PI * 2);
                  context.fill();
                }}
                nodeCanvasObject={(node, context, scale) => {
                  const isSelected = node.id === selectedId;
                  const isCenter = node.id === network?.center?.entity_id;
                  const isConnected = !selectedId || connectedNodeIds.has(node.id);
                  const isDimmed = !isConnected && !isSelected;

                  const intel = node.intel || getCompanyIntelligence(node.id, node.label, node.jurisdiction, node.category);
                  const risk = intel.risk_score || 20;
                  const radius = node.baseRadius || (isCenter ? 12 : 8);

                  // 1. Risk Level Outer Glow
                  if (isSelected || (risk >= 60 && !isDimmed)) {
                    context.beginPath();
                    drawNodeShape(context, intel.entity_type, node.x, node.y, radius + 6);
                    context.fillStyle = isSelected ? "rgba(100, 220, 177, 0.3)" : getRiskGlowColor(risk);
                    context.fill();
                  }

                  // 2. Main Node Shape & Color
                  context.beginPath();
                  drawNodeShape(context, intel.entity_type, node.x, node.y, radius);
                  context.fillStyle = isDimmed ? "#162521" : getRiskColor(risk);
                  context.globalAlpha = isDimmed ? 0.3 : 1.0;
                  context.fill();
                  context.globalAlpha = 1.0;

                  // 3. Border Stroke (Gold for Verified, Red X for Sanctioned)
                  context.lineWidth = isSelected ? 2.5 : 1.2;
                  context.strokeStyle = isSelected ? "#ffffff" : intel.verification.status.includes("Verified") ? "#eab308" : "#203a32";
                  context.stroke();

                  // 4. Label Rendering
                  if (scale > 1.8 || isSelected || isCenter || risk >= 80) {
                    const label = node.label.length > 20 ? `${node.label.slice(0, 18)}…` : node.label;
                    context.font = `${isSelected || isCenter ? 600 : 500} ${Math.max(9 / scale, 7.5)}px "DM Mono"`;
                    context.textAlign = "center";
                    context.fillStyle = isDimmed ? "#3a4e48" : isSelected || isCenter ? "#ffffff" : "#cde0d9";
                    context.fillText(label, node.x, node.y + radius + 11 / scale);
                  }
                }}
              />

              {/* Rich Hover Tooltip for Node */}
              {hoveredNode && (
                <div
                  className="graph-hover-tooltip"
                  style={{
                    left: `${Math.min(hoverPos.x + 15, dimensions.width - 290)}px`,
                    top: `${Math.min(hoverPos.y + 15, dimensions.height - 180)}px`,
                  }}
                >
                  <div className="tooltip-node-content">
                    <strong>{hoveredNode.label}</strong>
                    <code>{hoveredNode.id} · {hoveredNode.jurisdiction || "US"}</code>
                    <div className="tooltip-node-metrics">
                      <span>
                        Risk: <b style={{ color: getRiskColor(hoveredNode.intel?.risk_score || 25) }}>
                          {hoveredNode.intel?.risk_score || 25}/100
                        </b>
                      </span>
                      <span>90D Vol: <b>${((hoveredNode.intel?.metrics_30d?.transaction_volume_90d || 1e8) / 1e9).toFixed(1)}B</b></span>
                    </div>
                    <div className="tooltip-freshness-row">
                      <small>● {hoveredNode.intel?.risk_last_updated || "Updated 2h ago"}</small>
                      <small>{hoveredNode.intel?.verification?.status || "✓ Verified"}</small>
                    </div>
                    <div className="tooltip-quick-actions">
                      <button type="button" onClick={() => setSelectedId(hoveredNode.id)}>Inspect</button>
                      <button type="button" onClick={() => onCompareWithEntity?.(hoveredNode.intel)}>Compare</button>
                    </div>
                  </div>
                </div>
              )}

              {/* Rich Hover Tooltip for Edge */}
              {hoveredLink && (
                <div
                  className="graph-hover-tooltip"
                  style={{
                    left: `${Math.min(hoverPos.x + 15, dimensions.width - 290)}px`,
                    top: `${Math.min(hoverPos.y + 15, dimensions.height - 150)}px`,
                  }}
                >
                  <div className="tooltip-link-content">
                    <strong>{readable(hoveredLink.type)}</strong>
                    <div className="tooltip-link-route">
                      {hoveredLink.source?.id || hoveredLink.source} → {hoveredLink.target?.id || hoveredLink.target}
                    </div>
                    <div className="tooltip-link-metrics">
                      <span>Volume: <b>${(hoveredLink.amount_total / 1e6).toFixed(1)}M</b></span>
                      <span>Transfers: <b>47 Flows</b></span>
                    </div>
                    {hoveredLink.anomaly_message && (
                      <div className="tooltip-anomaly-warn">⚠️ {hoveredLink.anomaly_message}</div>
                    )}
                    <small>Last Transaction: {hoveredLink.last_transaction}</small>
                  </div>
                </div>
              )}

              {/* Interactive Visual Encoding Legend */}
              <div className="company-network-legend">
                <span className="legend-item"><i style={{ background: "#3b82f6" }} /> Equity/Ownership</span>
                <span className="legend-item"><i style={{ background: "#10b981" }} /> Commercial Trade</span>
                <span className="legend-item"><i style={{ background: "#ef4444" }} /> Suspicious/Sanctions</span>
                <span className="legend-item"><i style={{ borderColor: "#eab308", borderStyle: "solid" }} /> Verified SEC</span>
                <em>Hover for intelligence · Double-click to re-center</em>
              </div>
            </>
          ) : graphViewMode === "splc" ? (
            <BloombergSPLCGraph
              entityId={selectedId || centerIdRef.current || "Q312"}
              onSelectEntity={(id) => {
                setSelectedId(id);
                onAuditRef.current?.(`selected SPLC node: ${id}`);
              }}
              onOpenCompany={openCompany}
              selectedId={selectedId}
            />
          ) : graphViewMode === "map" ? (
            <BloombergMapOrbitGraph
              entityId={selectedId || centerIdRef.current || "Q312"}
              onSelectEntity={(id) => {
                setSelectedId(id);
                onAuditRef.current?.(`selected MAP node: ${id}`);
              }}
              onOpenCompany={openCompany}
              selectedId={selectedId}
            />
          ) : (
            <ConnectionExplorerView
              selectedId={selectedId}
              onSelectEntity={(id) => {
                setSelectedId(id);
                onAuditRef.current?.(`selected route node: ${id}`);
              }}
              onOpenCompany={openCompany}
            />
          )}
        </div>


        {/* 3. Redesigned Right Intelligence Panel */}
        <aside className="company-network-inspector">
          <EntityIntelligencePanel
            entityId={selectedNode?.id || "Q312"}
            entityName={selectedNode?.label || "Apple Inc."}
            entityCountry={selectedNode?.jurisdiction || "US"}
            entityKind={selectedNode?.category || "Company"}
            onOpenNetwork={(id) => openCompany(id)}
            onCompare={(dossier) => onCompareWithEntity?.(dossier)}
            onExport={() => {}}
            onAddToWatchlist={(id, status) => {
              onAuditRef.current?.(`${id} watchlist status: ${status ? "added" : "removed"}`);
            }}
          />
        </aside>
      </div>

      {/* 4. Timeline Slider & 24-Month Replay */}
      {timelineVisible && (
        <TimelineSlider
          startDate="2024-09-01"
          endDate="2026-08-29"
          currentDate={activeTimelineDate}
          onDateChange={(newDate) => {
            setActiveTimelineDate(newDate);
            onAuditRef.current?.(`timeline scrubber set to ${newDate}`);
          }}
        />
      )}
    </section>
  );
}
