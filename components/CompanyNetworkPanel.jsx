import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { forceCollide } from "d3-force";
import ForceGraph2D from "react-force-graph-2d";

const API_ROOT = "/corpgraph/api";
const nodeColors = {
  Company: "#43d7ad",
  HoldingCompany: "#39bdf8",
  Subsidiary: "#8b78ff",
  Person: "#f4b34c",
};
const linkColors = {
  HAS_SUBSIDIARY: "#7166d9",
  OFFICER_AT: "#d99c3f",
  OWNS: "#43d7ad",
  DIRECTOR_OF: "#e06d8b",
  SUPPLIER_TO: "#39bdf8",
  CO_PATENT_HOLDER: "#b58cff",
};

const readable = (value) => String(value || "—").replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function CompanyNetworkPanel({ onAudit }) {
  const stageRef = useRef(null);
  const graphRef = useRef(null);
  const onAuditRef = useRef(onAudit);
  const centerIdRef = useRef(null);
  const hasAutoOpenedRef = useRef(false);
  const [dimensions, setDimensions] = useState({ width: 1000, height: 650 });
  const [query, setQuery] = useState("Apple");
  const [results, setResults] = useState([]);
  const [network, setNetwork] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedLink, setSelectedLink] = useState(null);
  const [depth, setDepth] = useState(1);
  const [relationship, setRelationship] = useState("");
  const [riskOnly, setRiskOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [masterOpen, setMasterOpen] = useState(false);
  const [masterLoading, setMasterLoading] = useState(false);
  const [masterCompanies, setMasterCompanies] = useState([]);
  const [masterFilter, setMasterFilter] = useState("");
  const [hoveredId, setHoveredId] = useState(null);

  useEffect(() => {
    onAuditRef.current = onAudit;
  }, [onAudit]);

  useEffect(() => {
    if (!stageRef.current) return undefined;
    const resize = () => {
      const rect = stageRef.current?.getBoundingClientRect();
      if (rect) setDimensions({ width: Math.max(rect.width, 480), height: Math.max(rect.height, 420) });
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(stageRef.current);
    return () => observer.disconnect();
  }, []);

  const openCompany = useCallback(async (entityId) => {
    setLoading(true);
    setError("");
    try {
      const suffix = relationship ? `&relationship_type=${encodeURIComponent(relationship)}` : "";
      const response = await fetch(`${API_ROOT}/company/${encodeURIComponent(entityId)}/relationships?depth=${depth}&limit=150${suffix}`);
      if (!response.ok) throw new Error(`Company graph unavailable (${response.status})`);
      const payload = await response.json();
      setNetwork(payload);
      centerIdRef.current = payload.center?.entity_id || entityId;
      setSelectedId(entityId);
      setSelectedLink(null);
      onAuditRef.current?.(`opened corporate network ${entityId}`);
      setTimeout(() => graphRef.current?.zoomToFit(500, 70), 120);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Company graph unavailable");
    } finally {
      setLoading(false);
    }
  }, [depth, relationship]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      if (query.trim().length < 2) return setResults([]);
      try {
        const response = await fetch(`${API_ROOT}/search?q=${encodeURIComponent(query.trim())}&limit=8`, { signal: controller.signal });
        if (!response.ok) throw new Error(`Search unavailable (${response.status})`);
        const payload = await response.json();
        setResults(payload);
        if (!hasAutoOpenedRef.current && payload[0]) {
          hasAutoOpenedRef.current = true;
          openCompany(payload[0].entity_id);
        }
      } catch (reason) {
        if (reason?.name !== "AbortError") setError(reason instanceof Error ? reason.message : "Search unavailable");
      }
    }, 220);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, openCompany]);

  useEffect(() => {
    if (centerIdRef.current) openCompany(centerIdRef.current);
  }, [depth, relationship]);

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

  const graphData = useMemo(() => {
    if (!network) return { nodes: [], links: [] };
    const visibleNodes = riskOnly ? network.nodes.filter((node) => node.risk_flags?.length || node.id === network.center.entity_id) : network.nodes;
    const visibleIds = new Set(visibleNodes.map((node) => node.id));
    const centerId = network.center.entity_id;
    const adjacency = new Map(visibleNodes.map((node) => [node.id, []]));
    network.links.forEach((link) => {
      if (adjacency.has(link.source) && adjacency.has(link.target)) {
        adjacency.get(link.source).push(link.target);
        adjacency.get(link.target).push(link.source);
      }
    });
    const levels = new Map([[centerId, 0]]);
    const queue = [centerId];
    while (queue.length) {
      const current = queue.shift();
      (adjacency.get(current) || []).forEach((next) => {
        if (!levels.has(next)) { levels.set(next, levels.get(current) + 1); queue.push(next); }
      });
    }
    const rings = new Map();
    visibleNodes.forEach((node) => {
      const level = levels.get(node.id) || 1;
      if (!rings.has(level)) rings.set(level, []);
      rings.get(level).push(node);
    });
    const positioned = [];
    [...rings.entries()].sort(([a], [b]) => a - b).forEach(([level, nodes]) => {
      nodes.sort((a, b) => `${a.category}:${a.label}`.localeCompare(`${b.category}:${b.label}`));
      nodes.forEach((node, index) => {
        if (level === 0) positioned.push({ ...node, fx: 0, fy: 0 });
        else {
          const radius = 185 + (level - 1) * 155 + Math.max(0, nodes.length - 18) * 3;
          const angle = (Math.PI * 2 * index) / nodes.length - Math.PI / 2;
          positioned.push({ ...node, fx: Math.cos(angle) * radius, fy: Math.sin(angle) * radius });
        }
      });
    });
    return {
      nodes: positioned,
      links: network.links.filter((link) => visibleIds.has(link.source) && visibleIds.has(link.target)).map((link) => ({ ...link })),
    };
  }, [network, riskOnly]);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) return;
    graph.d3Force("charge")?.strength(-30);
    graph.d3Force("link")?.distance(120);
    graph.d3Force("collision", forceCollide(22));
    graph.d3ReheatSimulation();
  }, [graphData]);

  const selectedNode = graphData.nodes.find((node) => node.id === selectedId) || graphData.nodes[0];
  const summary = network?.summary;
  const filteredMaster = useMemo(() => {
    const needle = masterFilter.trim().toLowerCase();
    if (!needle) return masterCompanies;
    return masterCompanies.filter((company) => [company.name, company.entity_id, company.jurisdiction, company.entity_type, ...(company.aliases || [])].some((value) => String(value || "").toLowerCase().includes(needle)));
  }, [masterCompanies, masterFilter]);

  const selectCompany = (company) => {
    setQuery(company.name);
    setResults([]);
    setMasterOpen(false);
    openCompany(company.entity_id);
  };

  return (
    <section className="company-network-workspace">
      <header className="company-network-toolbar">
        <div className="company-search-block">
          <span className="eyebrow">PUBLIC CORPORATE GRAPH</span>
          <div className="company-search-row"><label><span>⌕</span><input aria-label="Search public companies" value={query} onFocus={() => setSearchFocused(true)} onBlur={() => setSearchFocused(false)} onChange={(event) => setQuery(event.target.value)} placeholder="Company, alias, LEI" /></label><button onClick={openMaster}>MASTER ▾</button></div>
          {results.length > 0 && searchFocused && (
            <div className="company-search-results">
              {results.map((company) => <button key={company.entity_id} onMouseDown={(event) => event.preventDefault()} onClick={() => selectCompany(company)}><strong>{company.name}</strong><span>{company.jurisdiction || "Undisclosed"} · {company.entity_type || "Company"}</span></button>)}
            </div>
          )}
        </div>
        <div className="company-network-kpis">
          <span><small>VISIBLE</small><b>{graphData.nodes.length}</b></span>
          <span><small>RELATIONS</small><b>{graphData.links.length}</b></span>
          <span><small>JURISDICTIONS</small><b>{summary?.jurisdictions ?? 0}</b></span>
          <span className={summary?.flagged_nodes ? "warn" : ""}><small>FLAGS</small><b>{summary?.flagged_nodes ?? 0}</b></span>
        </div>
        <div className="company-network-controls">
          <label>DEPTH<select value={depth} onChange={(event) => setDepth(Number(event.target.value))}><option>1</option><option>2</option><option>3</option></select></label>
          <label>RELATION<select value={relationship} onChange={(event) => setRelationship(event.target.value)}><option value="">All</option><option value="HAS_SUBSIDIARY">Subsidiaries</option><option value="OFFICER_AT">Officers</option><option value="OWNS">Ownership</option><option value="DIRECTOR_OF">Directors</option></select></label>
          <button className={riskOnly ? "active" : ""} onClick={() => setRiskOnly((value) => !value)}>⚑ Risk</button>
          <button onClick={() => graphRef.current?.zoomToFit(500, 70)}>Fit</button>
        </div>
      </header>

      <div className="company-network-body">
        <div ref={stageRef} className="company-network-stage">
          {loading && <div className="company-network-loading">QUERYING CORPORATE GRAPH…</div>}
          {error && <div className="company-network-error">{error}</div>}
          <ForceGraph2D
            ref={graphRef}
            width={dimensions.width}
            height={dimensions.height}
            graphData={graphData}
            backgroundColor="#000000"
            cooldownTicks={100}
            d3AlphaDecay={0.055}
            d3VelocityDecay={0.55}
            linkColor={(link) => selectedLink?.id === link.id ? "#ffffff" : linkColors[link.type] || "rgba(90,130,120,.55)"}
            linkWidth={(link) => selectedLink?.id === link.id ? 3 : 1.25}
            linkDirectionalArrowLength={4}
            linkDirectionalArrowRelPos={0.88}
            onNodeClick={(node) => { setSelectedId(node.id); setSelectedLink(null); }}
            onNodeHover={(node) => setHoveredId(node?.id || null)}
            onLinkClick={(link) => { setSelectedLink(link); setSelectedId(null); }}
            nodePointerAreaPaint={(node, color, context) => { context.fillStyle = color; context.beginPath(); context.arc(node.x, node.y, 18, 0, Math.PI * 2); context.fill(); }}
            nodeCanvasObject={(node, context, scale) => {
              const selected = node.id === selectedId;
              const center = node.id === network?.center?.entity_id;
              const radius = center ? 10 : node.category === "Person" ? 6 : 7;
              if (selected || center) { context.beginPath(); context.arc(node.x, node.y, radius + 5, 0, Math.PI * 2); context.fillStyle = "rgba(67,215,173,.18)"; context.fill(); }
              context.beginPath(); context.arc(node.x, node.y, radius, 0, Math.PI * 2); context.fillStyle = nodeColors[node.category] || "#43d7ad"; context.fill(); context.lineWidth = selected ? 2.5 : 1; context.strokeStyle = selected ? "#fff" : "#08110e"; context.stroke();
              if (scale > 2.2 || selected || center || node.id === hoveredId) { const label = node.label.length > 24 ? `${node.label.slice(0, 22)}…` : node.label; context.font = `${selected || center ? 600 : 500} ${Math.max(9 / scale, 7)}px "DM Mono"`; context.textAlign = "center"; context.fillStyle = selected || center ? "#f3fbf8" : "#8da39b"; context.fillText(label, node.x, node.y + radius + 11 / scale); }
            }}
          />
          {hoveredId && <div className="company-hover-readout">{graphData.nodes.find((node) => node.id === hoveredId)?.label}</div>}
          <div className="company-network-legend">{Object.entries(nodeColors).map(([type, color]) => <span key={type}><i style={{ background: color }} />{readable(type)}</span>)}<em>Click nodes and links to inspect</em></div>
        </div>

        <aside className="company-network-inspector">
          {selectedLink ? <LinkInspector link={selectedLink} /> : selectedNode ? <NodeInspector node={selectedNode} network={network} onOpen={openCompany} /> : <p>Select a company or relationship.</p>}
        </aside>
      </div>
      {masterOpen && <div className="company-master-backdrop" onMouseDown={() => setMasterOpen(false)}><section className="company-master" onMouseDown={(event) => event.stopPropagation()}><header><div><span className="eyebrow">WM &lt;EQUITY&gt; SECURITY MASTER</span><h2>Global Company Directory</h2></div><b>{masterLoading ? "LOADING" : `${filteredMaster.length} / ${masterCompanies.length}`}</b><button aria-label="Close company master" onClick={() => setMasterOpen(false)}>×</button></header><div className="company-master-filter"><span>⌕</span><input autoFocus value={masterFilter} onChange={(event) => setMasterFilter(event.target.value)} placeholder="FILTER BY COMPANY, IDENTIFIER, JURISDICTION OR TYPE" /></div><div className="company-master-table"><div className="company-master-row company-master-head"><span>NAME</span><span>IDENTIFIER</span><span>JURISDICTION</span><span>TYPE</span><span>SOURCE</span></div>{filteredMaster.map((company) => <button className="company-master-row" key={company.entity_id} onClick={() => selectCompany(company)}><strong>{company.name}</strong><code>{company.entity_id}</code><span>{company.jurisdiction || "—"}</span><span>{company.entity_type || "Company"}</span><span>{company.sources?.join(", ") || "—"}</span></button>)}</div></section></div>}
    </section>
  );
}

function NodeInspector({ node, network, onOpen }) {
  const attributes = node.attributes || {};
  const connections = network?.links.filter((link) => link.source === node.id || link.target === node.id).length || 0;
  return <><div className="company-inspector-heading"><span className="eyebrow">ENTITY INTELLIGENCE</span><i style={{ background: nodeColors[node.category] }} /> <small>{readable(node.category)}</small><h2>{node.label}</h2><p>{attributes.description || "Public corporate record"}</p></div>{node.risk_flags?.length > 0 && <div className="company-risk-flags">{node.risk_flags.map((flag) => <span key={flag}>⚑ {readable(flag)}</span>)}</div>}<dl className="company-facts"><Fact label="Connections" value={connections} /><Fact label="Entity type" value={node.entity_type} /><Fact label="Jurisdiction" value={node.jurisdiction} /><Fact label="Industry" value={node.industry} /><Fact label="Headquarters" value={attributes.headquarters} /><Fact label="Incorporated" value={attributes.incorporation_date} /><Fact label="LEI" value={attributes.lei} /><Fact label="Employees" value={attributes.employee_count?.toLocaleString()} /><Fact label="Confidence" value={node.confidence ? `${(node.confidence * 100).toFixed(0)}%` : null} /><Fact label="Source" value={attributes.source} /></dl>{node.category !== "Person" && <button className="company-open-network" onClick={() => onOpen(node.id)}>Re-center company network →</button>}{attributes.source_url && <a className="company-source-link" href={attributes.source_url} target="_blank" rel="noreferrer">Open source record ↗</a>}</>;
}

function LinkInspector({ link }) {
  return <><div className="company-inspector-heading"><span className="eyebrow">RELATIONSHIP INTELLIGENCE</span><h2>{readable(link.type)}</h2><p>{link.source} → {link.target}</p></div><dl className="company-facts"><Fact label="Officer title" value={link.officer_title} /><Fact label="Ownership" value={link.ownership_percentage ? `${link.ownership_percentage}%` : null} /><Fact label="Confidence" value={link.confidence ? `${(link.confidence * 100).toFixed(0)}%` : null} /><Fact label="Current" value={link.is_current ? "Yes" : "No"} /><Fact label="Filing" value={link.filing_reference} /><Fact label="Source" value={link.properties?.source} /></dl></>;
}

function Fact({ label, value }) {
  return value !== null && value !== undefined && value !== "" ? <div><dt>{label}</dt><dd>{String(value)}</dd></div> : null;
}
