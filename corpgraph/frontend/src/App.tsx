import { useEffect, useMemo, useRef, useState } from "react";
import cytoscape, { Core } from "cytoscape";
import "./style.css";

type Company = {
  entity_id: string;
  name: string;
  jurisdiction: string | null;
  registration_num: string | null;
  sources: string[];
  aliases: string[];
  entity_type: string | null;
  status: string | null;
  incorporation_date: string | null;
  cik: string | null;
  lei: string | null;
  website: string | null;
  industry: string | null;
  headquarters: string | null;
  employee_count: number | null;
  revenue_usd: number | null;
  description: string | null;
  deduplication_confidence: number | null;
  risk_flags: string[];
  filing_references: string[];
};

type GraphNode = {
  id: string;
  label: string;
  category: "Company" | "Subsidiary" | "HoldingCompany" | "Person";
  entity_type: string | null;
  jurisdiction: string | null;
  industry: string | null;
  title: string | null;
  board_seats: number;
  confidence: number | null;
  risk_flags: string[];
  attributes: Record<string, unknown>;
};

type GraphLink = {
  id: string;
  source: string;
  target: string;
  type: string;
  label: string;
  ownership_percentage: number | null;
  confidence: number | null;
  officer_title: string | null;
  effective_from: string | null;
  effective_to: string | null;
  is_current: boolean;
  risk_flags: string[];
  filing_reference: string | null;
  properties: Record<string, unknown>;
};

type Network = {
  center: Company;
  nodes: GraphNode[];
  links: GraphLink[];
  summary: {
    companies: number;
    people: number;
    subsidiaries: number;
    jurisdictions: number;
    flagged_nodes: number;
    interlocking_directors: number;
    average_confidence: number | null;
  };
  total_nodes: number;
  total_relationships: number;
  depth: number;
};

type Stats = { companies: number; people: number; relationships: number };

const COLORS: Record<GraphNode["category"], string> = {
  Company: "#21d4bd",
  HoldingCompany: "#3da5ff",
  Subsidiary: "#8b7dff",
  Person: "#f5b942",
};

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, { signal });
  if (!response.ok) {
    throw new Error(
      `Request failed (${response.status}). Check that the API, Neo4j, and Redis are running.`,
    );
  }
  return response.json() as Promise<T>;
}

function compactMoney(value: number | null): string {
  if (value === null) return "Not disclosed";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function humanize(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function App() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Company[]>([]);
  const [center, setCenter] = useState("");
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [selectedLink, setSelectedLink] = useState<GraphLink | null>(null);
  const [network, setNetwork] = useState<Network | null>(null);
  const [depth, setDepth] = useState(2);
  const [relationship, setRelationship] = useState("");
  const [riskOnly, setRiskOnly] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const host = useRef<HTMLDivElement>(null);
  const graph = useRef<Core | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    get<Stats>("/api/stats", controller.signal)
      .then(setStats)
      .catch((cause: Error) => {
        if (cause.name !== "AbortError") setError(cause.message);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setResults([]);
    if (query.trim().length < 2) {
      setSearching(false);
      return () => controller.abort();
    }
    setSearching(true);
    const timer = window.setTimeout(() => {
      get<Company[]>(
        `/api/search?q=${encodeURIComponent(query.trim())}&limit=12`,
        controller.signal,
      )
        .then(setResults)
        .catch((cause: Error) => {
          if (cause.name !== "AbortError") setError(cause.message);
        })
        .finally(() => {
          if (!controller.signal.aborted) setSearching(false);
        });
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  useEffect(() => {
    if (!center) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setSelectedLink(null);
    get<Network>(
      `/api/company/${encodeURIComponent(center)}/relationships?depth=${depth}&limit=150${relationship ? `&relationship_type=${encodeURIComponent(relationship)}` : ""}`,
      controller.signal,
    )
      .then((value) => {
        setNetwork(value);
        setSelected(
          value.nodes.find((node) => node.id === value.center.entity_id) ??
            value.nodes[0],
        );
      })
      .catch((cause: Error) => {
        if (cause.name !== "AbortError") setError(cause.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [center, depth, relationship]);

  const visibleGraph = useMemo(() => {
    if (!network || !riskOnly) return network;
    const retained = new Set(
      network.nodes
        .filter(
          (node) =>
            node.id === network.center.entity_id || node.risk_flags.length > 0,
        )
        .map((node) => node.id),
    );
    network.links.forEach((link) => {
      if (retained.has(link.source) || retained.has(link.target)) {
        retained.add(link.source);
        retained.add(link.target);
      }
    });
    return {
      ...network,
      nodes: network.nodes.filter((node) => retained.has(node.id)),
      links: network.links.filter(
        (link) => retained.has(link.source) && retained.has(link.target),
      ),
    };
  }, [network, riskOnly]);

  useEffect(() => {
    if (!host.current) return;
    graph.current?.destroy();
    if (!visibleGraph) {
      graph.current = null;
      return;
    }
    const nodes = visibleGraph.nodes.map((node) => ({
      data: {
        id: node.id,
        label: node.label,
        category: node.category,
        flagged: node.risk_flags.length > 0,
        root: node.id === visibleGraph.center.entity_id,
      },
    }));
    const edges = visibleGraph.links.map((link) => ({
      data: {
        id: `edge:${link.id}`,
        source: link.source,
        target: link.target,
        label:
          link.ownership_percentage === null
            ? link.label
            : `${link.ownership_percentage}%`,
        type: link.type,
      },
    }));
    const instance = cytoscape({
      container: host.current,
      elements: [...nodes, ...edges],
      layout: {
        name: "cose",
        animate: false,
        fit: true,
        padding: 56,
        nodeRepulsion: () => 6200,
        idealEdgeLength: () => 105,
      },
      minZoom: 0.15,
      maxZoom: 2.5,
      wheelSensitivity: 0.22,
      style: [
        {
          selector: "node",
          style: {
            "background-color": (element) =>
              COLORS[element.data("category") as GraphNode["category"]],
            label: "data(label)",
            color: "#c7d6e3",
            "font-size": 9,
            "font-weight": 500,
            "text-valign": "bottom",
            "text-margin-y": 8,
            "text-wrap": "ellipsis",
            "text-max-width": "90px",
            width: 22,
            height: 22,
            "border-width": 2,
            "border-color": "#071019",
          },
        },
        {
          selector: 'node[category = "Person"]',
          style: { shape: "diamond", width: 18, height: 18 },
        },
        {
          selector: 'node[category = "HoldingCompany"]',
          style: { shape: "round-rectangle", width: 28, height: 28 },
        },
        {
          selector: "node[?root]",
          style: {
            width: 44,
            height: 44,
            "border-width": 4,
            "border-color": "#dffcf7",
            "font-size": 12,
            "font-weight": 700,
          },
        },
        {
          selector: "node[?flagged]",
          style: {
            "overlay-color": "#ff5d73",
            "overlay-opacity": 0.08,
            "overlay-padding": 7,
          },
        },
        {
          selector: "edge",
          style: {
            width: 1.3,
            "line-color": "#2d5363",
            "target-arrow-color": "#2d5363",
            "target-arrow-shape": "triangle",
            "arrow-scale": 0.7,
            "curve-style": "bezier",
            label: "data(label)",
            color: "#6f8797",
            "font-size": 7,
            "text-rotation": "autorotate",
            "text-background-color": "#08131c",
            "text-background-opacity": 0.8,
            "text-background-padding": "2px",
          },
        },
        {
          selector: 'edge[type = "DIRECTOR_OF"]',
          style: {
            "line-style": "dashed",
            "line-color": "#b98a35",
            "target-arrow-color": "#b98a35",
          },
        },
        {
          selector: 'edge[type = "SUPPLIER_TO"]',
          style: { "line-color": "#ef6c93", "target-arrow-color": "#ef6c93" },
        },
        {
          selector: ":selected",
          style: {
            "border-color": "#ffffff",
            "border-width": 4,
            "line-color": "#ffffff",
            "target-arrow-color": "#ffffff",
          },
        },
      ],
    });
    const nodeMap = new Map(visibleGraph.nodes.map((node) => [node.id, node]));
    const linkMap = new Map(
      visibleGraph.links.map((link) => [`edge:${link.id}`, link]),
    );
    instance.on("tap", "node", (event) => {
      setSelected(nodeMap.get(event.target.id()) ?? null);
      setSelectedLink(null);
    });
    instance.on("tap", "edge", (event) => {
      setSelectedLink(linkMap.get(event.target.id()) ?? null);
    });
    graph.current = instance;
    const observer = new ResizeObserver(() => {
      instance.resize();
      instance.fit(undefined, 48);
    });
    observer.observe(host.current);
    return () => {
      observer.disconnect();
      instance.destroy();
      graph.current = null;
    };
  }, [visibleGraph]);

  function download(format: "json" | "png"): void {
    if (!network) return;
    const link = document.createElement("a");
    const url =
      format === "json"
        ? URL.createObjectURL(
            new Blob([JSON.stringify(network, null, 2)], {
              type: "application/json",
            }),
          )
        : graph.current?.png({ bg: "#08131c", full: true, scale: 2 });
    if (!url) return;
    link.href = url;
    link.download = `corpgraph-${network.center.entity_id}.${format}`;
    link.click();
    if (format === "json") URL.revokeObjectURL(url);
  }

  const selectedAttributes = selected?.attributes ?? {};
  return (
    <main>
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">CG</span>
          <div>
            <span className="eyebrow">CORPORATE INTELLIGENCE</span>
            <h1>
              CorpGraph <span>/ Investigation Console</span>
            </h1>
          </div>
        </div>
        <div className="system-status">
          <span className="live-dot" />
          GRAPH ONLINE
          <span>
            {stats
              ? `${(stats.companies + stats.people).toLocaleString()} entities · ${stats.relationships.toLocaleString()} links`
              : "Connecting…"}
          </span>
        </div>
      </header>
      <nav className="nav-strip" aria-label="Workspace sections">
        <strong>NETWORK EXPLORER</strong>
        <span>ENTITY RESOLUTION</span>
        <span>RISK SIGNALS</span>
        <span>FILINGS</span>
        <span>CASE NOTES</span>
      </nav>
      <div className="notice">
        <strong>PUBLIC + DEMO INTELLIGENCE</strong>
        <span>
          Wikidata records are public CC0 data requiring primary-source
          verification; Atlas Meridian records are fictional.
        </span>
        <button onClick={() => setCenter("demo_atlas_meridian_root")}>
          Load Atlas Meridian case →
        </button>
      </div>
      {error && (
        <div role="alert" className="error">
          {error}
        </div>
      )}

      <section className="workspace">
        <aside className="search panel">
          <div className="section-kicker">DISCOVERY</div>
          <h2>Entity search</h2>
          <label htmlFor="search">Company, registration or alias</label>
          <div className="search-box">
            <span>⌕</span>
            <input
              id="search"
              placeholder="Try Atlas Meridian"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <p className="muted">
            {searching
              ? "Searching graph…"
              : query.trim().length < 2
                ? "Enter at least two characters."
                : `${results.length} entities matched`}
          </p>
          <div className="results">
            {results.map((company) => (
              <button
                key={company.entity_id}
                onClick={() => setCenter(company.entity_id)}
              >
                <strong>{company.name}</strong>
                <small>
                  {company.entity_type ?? "Company"} ·{" "}
                  {company.jurisdiction ?? "Unknown jurisdiction"}
                </small>
                {company.risk_flags.length > 0 && (
                  <span className="mini-flag">
                    {company.risk_flags.length} flags
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="saved-case">
            <span className="section-kicker">FEATURED CASE</span>
            <strong>Atlas Meridian Group</strong>
            <small>Cross-border ownership · 8 interlocks</small>
            <button
              className="demo"
              onClick={() => setCenter("demo_atlas_meridian_root")}
            >
              Open investigation
            </button>
          </div>
          <div className="legend">
            <span className="section-kicker">NODE LEGEND</span>
            {Object.entries(COLORS).map(([category, color]) => (
              <div key={category}>
                <i style={{ background: color }} />
                {humanize(category)}
              </div>
            ))}
          </div>
        </aside>

        <section className="canvas panel">
          <div className="metrics" aria-label="Network summary">
            <Metric
              label="VISIBLE ENTITIES"
              value={network?.total_nodes ?? 0}
              accent
            />
            <Metric
              label="RELATIONSHIPS"
              value={network?.total_relationships ?? 0}
            />
            <Metric
              label="JURISDICTIONS"
              value={network?.summary.jurisdictions ?? 0}
            />
            <Metric
              label="BOARD INTERLOCKS"
              value={network?.summary.interlocking_directors ?? 0}
              warning
            />
            <Metric
              label="FLAGGED NODES"
              value={network?.summary.flagged_nodes ?? 0}
              danger
            />
            <Metric
              label="AVG CONFIDENCE"
              value={
                network?.summary.average_confidence == null
                  ? "—"
                  : `${(network.summary.average_confidence * 100).toFixed(1)}%`
              }
            />
          </div>
          <div className="toolbar">
            <div>
              <span className="section-kicker">RELATIONSHIP MAP</span>
              <strong>
                {network?.center.name ?? "Select an entity to begin"}
              </strong>
            </div>
            <label>
              Depth
              <select
                value={depth}
                onChange={(event) => setDepth(Number(event.target.value))}
              >
                {[1, 2, 3, 4].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            <label>
              Relationship
              <select
                value={relationship}
                onChange={(event) => setRelationship(event.target.value)}
              >
                <option value="">All relationships</option>
                {[
                  "OWNS",
                  "HAS_SUBSIDIARY",
                  "OFFICER_AT",
                  "DIRECTOR_OF",
                  "SUPPLIER_TO",
                  "CO_PATENT_HOLDER",
                ].map((type) => (
                  <option key={type} value={type}>
                    {humanize(type)}
                  </option>
                ))}
              </select>
            </label>
            <button
              className={riskOnly ? "active" : ""}
              onClick={() => setRiskOnly((current) => !current)}
            >
              ⚑ Risk only
            </button>
            <button
              disabled={!network}
              onClick={() => graph.current?.fit(undefined, 48)}
            >
              Fit view
            </button>
          </div>
          <div
            className="graph"
            ref={host}
            aria-label="Corporate relationship graph"
          />
          {(!network || loading) && (
            <div className="empty">
              <span className="radar" />
              {loading
                ? "Resolving corporate network…"
                : "Search for a company or open the featured case."}
            </div>
          )}
          <footer>
            <span>
              {network
                ? `${visibleGraph?.nodes.length ?? 0} rendered nodes · ${visibleGraph?.links.length ?? 0} directed links · depth ${network.depth}`
                : "No network selected"}
            </span>
            <span>
              Drag nodes · Scroll to zoom · Click an entity or relationship to
              inspect
            </span>
          </footer>
        </section>

        <aside className="details panel">
          <div className="section-kicker">INTELLIGENCE PROFILE</div>
          {selectedLink ? (
            <RelationshipDetails link={selectedLink} />
          ) : selected ? (
            <>
              <div className={`entity-icon ${selected.category.toLowerCase()}`}>
                {selected.category === "Person" ? "P" : "C"}
              </div>
              <span className="entity-type">{humanize(selected.category)}</span>
              <h2 className="entity-name">{selected.label}</h2>
              {selected.risk_flags.length > 0 && (
                <div className="risk-box">
                  <strong>
                    ⚑ {selected.risk_flags.length} RISK SIGNAL
                    {selected.risk_flags.length === 1 ? "" : "S"}
                  </strong>
                  {selected.risk_flags.map((flag) => (
                    <span key={flag}>{humanize(flag)}</span>
                  ))}
                </div>
              )}
              <dl>
                <dt>Entity identifier</dt>
                <dd>{selected.id}</dd>
                <dt>
                  {selected.category === "Person"
                    ? "Current title"
                    : "Entity type"}
                </dt>
                <dd>
                  {selected.title ?? selected.entity_type ?? "Not disclosed"}
                </dd>
                {selected.category === "Person" ? (
                  <>
                    <dt>Board seats</dt>
                    <dd>{selected.board_seats}</dd>
                  </>
                ) : (
                  <>
                    <dt>Jurisdiction</dt>
                    <dd>{selected.jurisdiction ?? "Not disclosed"}</dd>
                    <dt>Industry</dt>
                    <dd>{selected.industry ?? "Not disclosed"}</dd>
                    <dt>Registration</dt>
                    <dd>
                      {String(
                        selectedAttributes.registration_number ??
                          "Not disclosed",
                      )}
                    </dd>
                    <dt>Revenue</dt>
                    <dd>
                      {compactMoney(
                        typeof selectedAttributes.revenue_usd === "number"
                          ? selectedAttributes.revenue_usd
                          : null,
                      )}
                    </dd>
                  </>
                )}
                <dt>Resolution confidence</dt>
                <dd>
                  {selected.confidence == null
                    ? "Not scored"
                    : `${(selected.confidence * 100).toFixed(1)}%`}
                </dd>
                <dt>Source coverage</dt>
                <dd>
                  {Array.isArray(selectedAttributes.sources)
                    ? selectedAttributes.sources.join(", ")
                    : "Not recorded"}
                </dd>
              </dl>
              {selected.category !== "Person" && (
                <button
                  className="primary"
                  onClick={() => setCenter(selected.id)}
                >
                  Re-center investigation
                </button>
              )}
            </>
          ) : (
            <p className="muted details-empty">
              Select a graph node to inspect its profile, filings, confidence
              and risks.
            </p>
          )}
          <div className="exports">
            <button disabled={!network} onClick={() => download("json")}>
              ↓ Export JSON
            </button>
            <button disabled={!network} onClick={() => download("png")}>
              ↓ Export PNG
            </button>
          </div>
        </aside>
      </section>
    </main>
  );
}

function Metric({
  label,
  value,
  accent,
  warning,
  danger,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
  warning?: boolean;
  danger?: boolean;
}) {
  return (
    <div
      className={`metric ${accent ? "accent" : ""} ${warning ? "warning" : ""} ${danger ? "danger" : ""}`}
    >
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function RelationshipDetails({ link }: { link: GraphLink }) {
  return (
    <div className="relationship-detail">
      <span className="entity-type">RELATIONSHIP</span>
      <h2 className="entity-name">{link.label}</h2>
      <div className="direction">
        <code>{link.source}</code>
        <span>→</span>
        <code>{link.target}</code>
      </div>
      <dl>
        <dt>Ownership</dt>
        <dd>
          {link.ownership_percentage == null
            ? "Not applicable"
            : `${link.ownership_percentage}%`}
        </dd>
        <dt>Officer title</dt>
        <dd>{link.officer_title ?? "Not applicable"}</dd>
        <dt>Effective from</dt>
        <dd>{link.effective_from ?? "Not disclosed"}</dd>
        <dt>Confidence</dt>
        <dd>
          {link.confidence == null
            ? "Not scored"
            : `${(link.confidence * 100).toFixed(1)}%`}
        </dd>
        <dt>Filing reference</dt>
        <dd>{link.filing_reference ?? "Not recorded"}</dd>
      </dl>
    </div>
  );
}
