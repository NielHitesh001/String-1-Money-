import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D from "react-force-graph-2d";

const riskColor = (risk) => (risk >= 80 ? "#ff5b6e" : risk >= 55 ? "#f3ae52" : "#52d6aa");

const getLinkColor = (link, isTraced, isSelected, isDimmed, activeFilter) => {
  if (isDimmed) return "rgba(35, 48, 45, 0.22)";
  if (isTraced) return "#64dcb1";
  if (isSelected) return "#38bdf8";

  // Check relationship or flow type
  if (link.risk >= 80 || link.flag) return "rgba(255, 91, 110, 0.85)";
  if (link.rail === "SWIFT" && link.amount > 20_000_000) return "rgba(245, 158, 11, 0.75)";
  if (link.display?.toLowerCase().includes("equity") || link.display?.toLowerCase().includes("jv")) {
    return "rgba(56, 189, 248, 0.8)";
  }
  return "rgba(82, 214, 170, 0.45)";
};

export default function NetworkCanvas({
  entities,
  transactions,
  selectedId,
  trace = { nodeIds: [], edgeIds: [] },
  onSelect,
  onInspect,
  actionsRef,
  focusMode = false,
  activeLayerFilter = "all", // "all" | "equity" | "transactions" | "sanctions"
}) {
  const containerRef = useRef(null);
  const fgRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [hoveredObject, setHoveredObject] = useState(null);
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });
  const lastClickRef = useRef({ time: 0, id: null });

  // Responsive container sizing
  useEffect(() => {
    if (!containerRef.current) return;
    const updateSize = () => {
      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        setDimensions({
          width: clientWidth || 800,
          height: clientHeight || 600,
        });
      }
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Compute connected nodes for single-click ghosting
  const connectedNodeIds = useMemo(() => {
    if (!selectedId) return new Set();
    const set = new Set([selectedId]);
    transactions.forEach((tx) => {
      if (tx.id === selectedId) {
        set.add(tx.source);
        set.add(tx.target);
      } else if (tx.source === selectedId) {
        set.add(tx.target);
      } else if (tx.target === selectedId) {
        set.add(tx.source);
      }
    });
    return set;
  }, [selectedId, transactions]);

  // Format data for ForceGraph2D
  const graphData = useMemo(() => {
    let filteredEntities = entities;
    let filteredTransactions = transactions;

    // Filter by layer if specified
    if (activeLayerFilter === "equity") {
      filteredTransactions = transactions.filter((t) =>
        t.display?.toLowerCase().includes("equity") || t.display?.toLowerCase().includes("jv") || t.display?.toLowerCase().includes("stake")
      );
    } else if (activeLayerFilter === "sanctions") {
      filteredTransactions = transactions.filter((t) => t.risk >= 80 || t.flag);
    }

    // Focus mode: 3-hop isolation around selected entity
    if (focusMode && selectedId) {
      const hop1 = new Set([selectedId]);
      transactions.forEach((t) => {
        if (t.source === selectedId) hop1.add(t.target);
        if (t.target === selectedId) hop1.add(t.source);
      });
      const hop2 = new Set([...hop1]);
      transactions.forEach((t) => {
        if (hop1.has(t.source)) hop2.add(t.target);
        if (hop1.has(t.target)) hop2.add(t.source);
      });

      filteredEntities = entities.filter((e) => hop2.has(e.id));
      const visibleIds = new Set(filteredEntities.map((e) => e.id));
      filteredTransactions = filteredTransactions.filter(
        (t) => visibleIds.has(t.source) && visibleIds.has(t.target)
      );
    }

    const nodes = filteredEntities.map((e) => {
      // Calculate dynamic radius based on volume
      const vol = Number(e.volume || 0);
      const baseRadius = vol > 100_000_000 ? 11 : vol > 20_000_000 ? 9 : 7;

      return {
        id: e.id,
        name: e.name,
        country: e.country,
        kind: e.kind || (e.id.includes("CORP") ? "Company" : e.id.includes("JPM") || e.id.includes("DB") || e.id.includes("SBI") ? "FinancialInstitution" : "Company"),
        risk: e.risk || 0,
        volume: vol,
        baseRadius,
        isHot: (e.risk >= 80 || vol > 50_000_000),
        fx: Number.isFinite(e.x) ? e.x * 220 : undefined,
        fy: Number.isFinite(e.y) ? e.y * 220 : undefined,
      };
    });

    const entityIds = new Set(nodes.map((n) => n.id));
    const links = filteredTransactions
      .filter((tx) => entityIds.has(tx.source) && entityIds.has(tx.target))
      .map((tx) => ({
        id: tx.id,
        source: tx.source,
        target: tx.target,
        amount: tx.amount,
        currency: tx.currency,
        display: tx.display,
        rail: tx.rail,
        risk: tx.risk,
        flag: tx.flag,
      }));

    return { nodes, links };
  }, [entities, transactions, focusMode, selectedId, activeLayerFilter]);

  // Initial fit
  useEffect(() => {
    if (fgRef.current && graphData.nodes.length > 0) {
      const timer = setTimeout(() => {
        fgRef.current?.zoomToFit(400, 60);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [graphData]);

  // Keyboard navigation listener (Arrow keys pan, +/- zoom, Escape deselect, Space fit)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if user is typing in an input
      if (["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) {
        return;
      }

      const fg = fgRef.current;
      if (!fg) return;

      if (e.key === "+" || e.key === "=") {
        fg.zoom(fg.zoom() * 1.25, 200);
      } else if (e.key === "-" || e.key === "_") {
        fg.zoom(fg.zoom() / 1.25, 200);
      } else if (e.key === "Escape") {
        onSelect({ type: "clear", value: null });
      } else if (e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        fg.zoomToFit(400, 60);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onSelect]);

  // Expose zoom controls
  useEffect(() => {
    actionsRef.current = {
      zoomIn: () => {
        const fg = fgRef.current;
        if (fg) fg.zoom(fg.zoom() * 1.3, 200);
      },
      zoomOut: () => {
        const fg = fgRef.current;
        if (fg) fg.zoom(fg.zoom() / 1.3, 200);
      },
      reset: () => {
        const fg = fgRef.current;
        if (fg) fg.zoomToFit(400, 60);
      },
      centerOn: (x, y) => {
        const fg = fgRef.current;
        if (fg) fg.centerAt(x, y, 400);
      },
    };
    return () => {
      actionsRef.current = null;
    };
  }, [actionsRef]);

  // Node Shape drawing helper
  const drawNodeShape = (ctx, kind, x, y, r) => {
    ctx.beginPath();
    if (kind === "FinancialInstitution") {
      // Square
      ctx.rect(x - r, y - r, r * 2, r * 2);
    } else if (kind === "HoldingCompany") {
      // Diamond
      ctx.moveTo(x, y - r * 1.2);
      ctx.lineTo(x + r * 1.2, y);
      ctx.lineTo(x, y + r * 1.2);
      ctx.lineTo(x - r * 1.2, y);
      ctx.closePath();
    } else if (kind === "Person") {
      // Hexagon
      const a = (2 * Math.PI) / 6;
      for (let i = 0; i < 6; i++) {
        const hx = x + r * Math.cos(a * i);
        const hy = y + r * Math.sin(a * i);
        if (i === 0) ctx.moveTo(hx, hy);
        else ctx.lineTo(hx, hy);
      }
      ctx.closePath();
    } else {
      // Default: Smooth Circle
      ctx.arc(x, y, r, 0, 2 * Math.PI, false);
    }
  };

  // Custom node canvas rendering
  const drawNode = useCallback(
    (node, ctx, globalScale) => {
      const isSelected = selectedId === node.id;
      const isTraced = trace.nodeIds.includes(node.id);
      const isConnected = !selectedId || connectedNodeIds.has(node.id);
      const isDimmed = !isConnected && !isTraced;

      const baseR = (isSelected ? 13 : isTraced ? 11 : node.baseRadius || 8) + (node.risk >= 80 ? 2 : 0);
      const color = isDimmed ? "#192523" : riskColor(node.risk);

      // Hot Node / Critical outer pulse ring
      if ((isSelected || (node.isHot && !isDimmed)) && !isDimmed) {
        ctx.beginPath();
        drawNodeShape(ctx, node.kind, node.x, node.y, baseR + 5);
        ctx.fillStyle = isSelected
          ? "rgba(100, 220, 177, 0.28)"
          : node.risk >= 80
          ? "rgba(255, 91, 110, 0.25)"
          : "rgba(56, 189, 248, 0.18)";
        ctx.fill();
      }

      // Main node shape
      ctx.beginPath();
      drawNodeShape(ctx, node.kind, node.x, node.y, baseR);
      ctx.fillStyle = color;
      ctx.globalAlpha = isDimmed ? 0.28 : 1.0;
      ctx.fill();
      ctx.globalAlpha = 1.0;

      // Border stroke
      ctx.lineWidth = isSelected ? 2.5 : 1.5;
      ctx.strokeStyle = isSelected ? "#ffffff" : isDimmed ? "#0f1615" : "#0c1211";
      ctx.stroke();

      // Label rendering
      if (globalScale > 0.55 || isSelected || isTraced || node.risk >= 80) {
        const label = node.id;
        const fontSize = Math.max(10 / globalScale, 9);
        ctx.font = `600 ${fontSize}px "DM Mono", monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";

        const textY = node.y + baseR + 4;
        ctx.fillStyle = isDimmed ? "#32433f" : isSelected ? "#64dcb1" : "#e0eae6";
        ctx.fillText(label, node.x, textY);

        // Subtitle (Name + Country)
        if (globalScale > 1.1 && !isDimmed) {
          const subFontSize = Math.max(8 / globalScale, 7.5);
          ctx.font = `400 ${subFontSize}px "DM Mono", monospace`;
          ctx.fillStyle = "#7e9790";
          const sub = `${node.name.length > 18 ? `${node.name.slice(0, 16)}...` : node.name} [${node.country}]`;
          ctx.fillText(sub, node.x, textY + fontSize + 2);
        }
      }
    },
    [selectedId, connectedNodeIds, trace]
  );

  // Click handler supporting Single-Click (highlight) and Double-Click (inspect)
  const handleNodeClick = (node, event) => {
    const now = Date.now();
    const last = lastClickRef.current;
    if (last.id === node.id && now - last.time < 320) {
      // Double click -> Deep Inspect
      onInspect?.({ type: "entity", value: node.id });
    } else {
      // Single click -> Select & Highlight
      onSelect({ type: "entity", value: node.id });
    }
    lastClickRef.current = { time: now, id: node.id };
  };

  const handleLinkClick = (link) => {
    const now = Date.now();
    const last = lastClickRef.current;
    if (last.id === link.id && now - last.time < 320) {
      onInspect?.({ type: "transaction", value: link.id });
    } else {
      onSelect({ type: "transaction", value: link.id });
    }
    lastClickRef.current = { time: now, id: link.id };
  };

  return (
    <div
      ref={containerRef}
      className="sigma-stage"
      style={{ width: "100%", height: "100%", position: "absolute", inset: 0 }}
      onMouseMove={(e) => {
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
          setHoverPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        }
      }}
    >
      <ForceGraph2D
        ref={fgRef}
        width={dimensions.width}
        height={dimensions.height}
        graphData={graphData}
        backgroundColor="transparent"
        nodeRelSize={8}
        nodeCanvasObject={drawNode}
        nodeCanvasObjectMode={() => "replace"}
        linkColor={(link) => {
          const isTraced = trace.edgeIds.includes(link.id);
          const isSelected =
            selectedId === link.id ||
            selectedId === link.source?.id ||
            selectedId === link.target?.id;
          const isConnected =
            !selectedId ||
            connectedNodeIds.has(link.source?.id || link.source) ||
            connectedNodeIds.has(link.target?.id || link.target);
          const isDimmed = !isConnected && !isTraced;

          return getLinkColor(link, isTraced, isSelected, isDimmed, activeLayerFilter);
        }}
        linkWidth={(link) => {
          const isTraced = trace.edgeIds.includes(link.id);
          const isSelected = selectedId === link.id;
          const amt = Number(link.amount || 0);
          const baseW = amt > 50_000_000 ? 3.2 : amt > 10_000_000 ? 2.2 : 1.4;
          if (isTraced) return baseW + 2.0;
          if (isSelected) return baseW + 1.5;
          return baseW;
        }}
        linkDirectionalParticles={(link) => (trace.edgeIds.includes(link.id) ? 4 : link.risk >= 80 ? 2 : 0)}
        linkDirectionalParticleSpeed={(link) => (trace.edgeIds.includes(link.id) ? 0.008 : 0.004)}
        linkDirectionalParticleWidth={(link) => (trace.edgeIds.includes(link.id) ? 3.5 : 2)}
        linkDirectionalParticleColor={(link) => (trace.edgeIds.includes(link.id) ? "#64dcb1" : "#ff5b6e")}
        cooldownTicks={120}
        d3AlphaDecay={0.06}
        d3VelocityDecay={0.65}
        onNodeDragEnd={(node) => {
          node.fx = node.x;
          node.fy = node.y;
        }}
        nodePointerAreaPaint={(node, color, ctx) => {
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(node.x, node.y, 18, 0, 2 * Math.PI);
          ctx.fill();
        }}
        onNodeHover={(node) => setHoveredObject(node ? { type: "node", data: node } : null)}
        onLinkHover={(link) => setHoveredObject(link ? { type: "link", data: link } : null)}
        onNodeClick={handleNodeClick}
        onLinkClick={handleLinkClick}
      />

      {/* Interactive Tooltip on Hover */}
      {hoveredObject && (
        <div
          className="graph-hover-tooltip"
          style={{
            left: `${Math.min(hoverPos.x + 15, dimensions.width - 240)}px`,
            top: `${Math.min(hoverPos.y + 15, dimensions.height - 120)}px`,
          }}
        >
          {hoveredObject.type === "node" ? (
            <div className="tooltip-node-content">
              <strong>{hoveredObject.data.name}</strong>
              <code>{hoveredObject.data.id} [{hoveredObject.data.country}]</code>
              <div className="tooltip-node-metrics">
                <span>Risk: <b className={hoveredObject.data.risk >= 80 ? "critical" : hoveredObject.data.risk >= 55 ? "elevated" : "standard"}>{hoveredObject.data.risk}/100</b></span>
                <span>Type: <b>{hoveredObject.data.kind}</b></span>
              </div>
              <small>Click to highlight · Double-click to inspect</small>
            </div>
          ) : (
            <div className="tooltip-link-content">
              <strong>{hoveredObject.data.id}</strong>
              <div className="tooltip-link-route">
                {hoveredObject.data.source?.id || hoveredObject.data.source} → {hoveredObject.data.target?.id || hoveredObject.data.target}
              </div>
              <div className="tooltip-link-metrics">
                <span>Volume: <b>${(Number(hoveredObject.data.amount || 0) / 1_000_000).toFixed(1)}M {hoveredObject.data.currency}</b></span>
                <span>Rail: <b>{hoveredObject.data.rail || "SWIFT"}</b></span>
              </div>
              {hoveredObject.data.display && <div className="tooltip-link-desc">{hoveredObject.data.display}</div>}
            </div>
          )}
        </div>
      )}

      {/* Interactive Graph Legend & Keyboard Shortcut Hints */}
      <div className="graph-interactive-legend">
        <div className="legend-shapes">
          <span className="legend-shape-item"><i className="shape-circle"></i> Company</span>
          <span className="legend-shape-item"><i className="shape-diamond"></i> Holding</span>
          <span className="legend-shape-item"><i className="shape-square"></i> Bank / FI</span>
        </div>
        <div className="legend-divider">|</div>
        <div className="legend-shortcuts">
          <kbd>+</kbd>/<kbd>-</kbd> Zoom <kbd>Arrows</kbd> Pan <kbd>Space</kbd> Reset <kbd>Esc</kbd> Clear
        </div>
      </div>
    </div>
  );
}
