import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import * as d3 from 'd3';
import { 
  buildCausalDAG, 
  DAGNode, 
  DAGEdge, 
  GraphOrientation, 
  getCausalTrace 
} from '../utils/causalGraph';
import { ChatMessage, AGENT_CONFIGS, getAgentConfig } from './chatTypes';
import { 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  Compass, 
  Layers, 
  CornerDownRight, 
  Sparkles, 
  Info, 
  Search, 
  X,
  Clock,
  Key
} from 'lucide-react';

interface CausalGraphViewProps {
  messages: ChatMessage[];
  selectedLocator: string | null;
  onSelectLocator: (locator: string) => void;
  className?: string;
}

export const CausalGraphView: React.FC<CausalGraphViewProps> = ({
  messages,
  selectedLocator,
  onSelectLocator,
  className = ''
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [orientation, setOrientation] = useState<GraphOrientation>('horizontal');
  const [hoveredLocator, setHoveredLocator] = useState<string | null>(null);
  const [filterAgent, setFilterAgent] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [inspectNode, setInspectNode] = useState<DAGNode | null>(null);

  // 1. Build DAG topological model
  const graphData = useMemo(() => {
    return buildCausalDAG(messages, orientation);
  }, [messages, orientation]);

  // 2. Active Causal Trace for hover or selection
  const activeTrace = useMemo(() => {
    const target = hoveredLocator || selectedLocator;
    if (!target || !graphData.nodeMap.has(target)) return null;
    return getCausalTrace(target, graphData.nodeMap);
  }, [hoveredLocator, selectedLocator, graphData.nodeMap]);

  // 3. Zoom behavior setup with D3
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const svg = d3.select(svgRef.current);
    const g = svg.select<SVGGElement>('#dag-viewport');

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.15, 2.5])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    zoomBehaviorRef.current = zoom;
    svg.call(zoom);

    // Initial fit to content
    const container = containerRef.current;
    const { width: cWidth, height: cHeight } = container.getBoundingClientRect();
    const { bounds } = graphData;

    if (bounds.width > 0 && bounds.height > 0 && cWidth > 0 && cHeight > 0) {
      const scaleX = (cWidth - 80) / bounds.width;
      const scaleY = (cHeight - 80) / bounds.height;
      const initialScale = Math.min(1.0, Math.max(0.3, Math.min(scaleX, scaleY)));
      const initialTx = Math.max(40, (cWidth - bounds.width * initialScale) / 2);
      const initialTy = Math.max(40, (cHeight - bounds.height * initialScale) / 2);

      svg.call(
        zoom.transform,
        d3.zoomIdentity.translate(initialTx, initialTy).scale(initialScale)
      );
    }

    return () => {
      svg.on('.zoom', null);
    };
  }, [graphData]);

  // Zoom control handlers
  const handleZoomIn = useCallback(() => {
    if (svgRef.current && zoomBehaviorRef.current) {
      d3.select(svgRef.current).transition().duration(250).call(zoomBehaviorRef.current.scaleBy, 1.3);
    }
  }, []);

  const handleZoomOut = useCallback(() => {
    if (svgRef.current && zoomBehaviorRef.current) {
      d3.select(svgRef.current).transition().duration(250).call(zoomBehaviorRef.current.scaleBy, 0.77);
    }
  }, []);

  const handleFitView = useCallback(() => {
    if (!svgRef.current || !containerRef.current || !zoomBehaviorRef.current) return;
    const container = containerRef.current;
    const { width: cWidth, height: cHeight } = container.getBoundingClientRect();
    const { bounds } = graphData;

    if (bounds.width > 0 && bounds.height > 0 && cWidth > 0 && cHeight > 0) {
      const scaleX = (cWidth - 60) / bounds.width;
      const scaleY = (cHeight - 60) / bounds.height;
      const targetScale = Math.min(1.1, Math.max(0.25, Math.min(scaleX, scaleY)));
      const targetTx = (cWidth - bounds.width * targetScale) / 2;
      const targetTy = (cHeight - bounds.height * targetScale) / 2;

      d3.select(svgRef.current)
        .transition()
        .duration(400)
        .call(
          zoomBehaviorRef.current.transform,
          d3.zoomIdentity.translate(targetTx, targetTy).scale(targetScale)
        );
    }
  }, [graphData]);

  // Center on a specific node locator
  const centerOnNode = useCallback((node: DAGNode) => {
    if (!svgRef.current || !containerRef.current || !zoomBehaviorRef.current) return;
    const container = containerRef.current;
    const { width: cWidth, height: cHeight } = container.getBoundingClientRect();
    const targetScale = 1.0;
    const targetTx = cWidth / 2 - (node.x + node.width / 2) * targetScale;
    const targetTy = cHeight / 2 - (node.y + node.height / 2) * targetScale;

    d3.select(svgRef.current)
      .transition()
      .duration(450)
      .call(
        zoomBehaviorRef.current.transform,
        d3.zoomIdentity.translate(targetTx, targetTy).scale(targetScale)
      );
  }, []);

  // Filtered nodes logic
  const isNodeVisible = useCallback((node: DAGNode) => {
    if (filterAgent !== 'all') {
      const senderKey = node.msg.sender.toLowerCase().replace(/^(agent:|bee\.)/, '');
      if (!senderKey.includes(filterAgent)) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const textMatch = node.msg.text.toLowerCase().includes(q);
      const titleMatch = (node.msg.title || '').toLowerCase().includes(q);
      const locMatch = node.id.toLowerCase().includes(q);
      if (!textMatch && !titleMatch && !locMatch) return false;
    }
    return true;
  }, [filterAgent, searchQuery]);

  // Collect distinct agents in this graph for dynamic filter buttons
  const distinctAgents = useMemo(() => {
    const agents = new Set<string>();
    messages.forEach((m) => {
      const norm = m.sender.toLowerCase().replace(/^(agent:|bee\.)/, '');
      agents.add(norm);
    });
    return Array.from(agents);
  }, [messages]);

  return (
    <div ref={containerRef} className={`relative w-full h-full bg-slate-950 overflow-hidden select-none flex flex-col ${className}`}>
      {/* Top Floating Control Bar */}
      <div className="absolute top-3 left-3 right-3 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {/* Left: Search & Filter */}
        <div className="flex items-center space-x-2 pointer-events-auto bg-slate-900/90 backdrop-blur border border-slate-800 rounded-xl p-1.5 shadow-xl">
          <div className="flex items-center bg-slate-950/80 border border-slate-700/60 rounded-lg px-2 py-1 text-slate-300 text-xs">
            <Search className="w-3.5 h-3.5 text-slate-400 mr-1.5 shrink-0" />
            <input
              type="text"
              placeholder="Поиск по актам / тексту..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none w-28 sm:w-44"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="text-slate-400 hover:text-slate-200 ml-1"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <select
            value={filterAgent}
            onChange={(e) => setFilterAgent(e.target.value)}
            className="bg-slate-950/90 text-slate-200 border border-slate-700/60 rounded-lg px-2 py-1 text-xs font-semibold focus:outline-none cursor-pointer"
            style={{ colorScheme: 'dark' }}
          >
            <option value="all">Все агенты ({messages.length})</option>
            {distinctAgents.map((ag) => {
              const cfg = getAgentConfig(ag);
              return (
                <option key={ag} value={ag}>
                  {cfg.shortName}
                </option>
              );
            })}
          </select>
        </div>

        {/* Right: Camera & Layout toggles */}
        <div className="flex items-center space-x-1.5 pointer-events-auto bg-slate-900/90 backdrop-blur border border-slate-800 rounded-xl p-1.5 shadow-xl">
          {/* Orientation switch */}
          <button
            onClick={() => setOrientation(o => o === 'horizontal' ? 'vertical' : 'horizontal')}
            className="flex items-center space-x-1.5 px-2 py-1 rounded-lg text-xs font-medium text-slate-200 hover:bg-slate-800 transition border border-slate-700/50"
            title="Переключить направление графа (горизонтальное / вертикальное)"
          >
            <Compass className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden sm:inline">
              {orientation === 'horizontal' ? 'Лента HLC' : 'Иерархия спора'}
            </span>
          </button>

          <div className="h-4 w-px bg-slate-700 mx-0.5" />

          {/* Zoom In */}
          <button
            onClick={handleZoomIn}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition"
            title="Приблизить (+)"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          {/* Zoom Out */}
          <button
            onClick={handleZoomOut}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition"
            title="Отдалить (-)"
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          {/* Fit to view */}
          <button
            onClick={handleFitView}
            className="p-1.5 rounded-lg text-indigo-300 hover:text-white hover:bg-indigo-950/80 transition"
            title="Показать весь граф целиком"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main SVG Stage */}
      <svg
        ref={svgRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
      >
        <defs>
          {/* Arrow markers for edges */}
          <marker
            id="arrow-default"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 9 5 L 0 9 z" fill="#6366f1" />
          </marker>
          <marker
            id="arrow-challenge"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 9 5 L 0 9 z" fill="#f43f5e" />
          </marker>
          <marker
            id="arrow-ruling"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 9 5 L 0 9 z" fill="#c084fc" />
          </marker>
          <marker
            id="arrow-finding"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 9 5 L 0 9 z" fill="#2dd4bf" />
          </marker>
          <marker
            id="arrow-reply"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 9 5 L 0 9 z" fill="#38bdf8" />
          </marker>

          {/* Background Grid Pattern */}
          <pattern id="dag-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e293b" strokeWidth="0.5" strokeOpacity="0.4" />
            <circle cx="0" cy="0" r="1" fill="#334155" fillOpacity="0.6" />
          </pattern>
        </defs>

        {/* Infinite Grid Canvas Background */}
        <rect width="100%" height="100%" fill="url(#dag-grid)" />

        {/* Viewport Transform Group for D3 Pan/Zoom */}
        <g id="dag-viewport">
          {/* Render Causal Edges */}
          <g className="dag-edges">
            {graphData.edges.map((edge) => {
              const isHighlighted = activeTrace 
                ? (activeTrace.lineage.has(edge.source) && activeTrace.lineage.has(edge.target))
                : false;
              const isDimmed = activeTrace ? !isHighlighted : false;

              let strokeColor = '#475569';
              let markerId = 'arrow-default';

              if (edge.type === 'challenge') {
                strokeColor = '#f43f5e';
                markerId = 'arrow-challenge';
              } else if (edge.type === 'ruling') {
                strokeColor = '#a855f7';
                markerId = 'arrow-ruling';
              } else if (edge.type === 'finding') {
                strokeColor = '#14b8a6';
                markerId = 'arrow-finding';
              } else if (edge.type === 'reply') {
                strokeColor = '#38bdf8';
                markerId = 'arrow-reply';
              }

              if (isHighlighted) {
                strokeColor = '#38bdf8';
              }

              return (
                <g key={edge.id} className="transition-opacity duration-200">
                  {/* Glow underlay when highlighted */}
                  {isHighlighted && (
                    <path
                      d={edge.path}
                      fill="none"
                      stroke="#38bdf8"
                      strokeWidth="5"
                      strokeOpacity="0.35"
                      strokeLinecap="round"
                    />
                  )}
                  <path
                    d={edge.path}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={isHighlighted ? 2.5 : 1.5}
                    strokeOpacity={isDimmed ? 0.15 : isHighlighted ? 1 : 0.65}
                    strokeDasharray={edge.type === 'challenge' ? '4 3' : undefined}
                    markerEnd={`url(#${markerId})`}
                    className="transition-all duration-150"
                  />
                </g>
              );
            })}
          </g>

          {/* Render Causal Nodes */}
          <g className="dag-nodes">
            {graphData.nodes.map((node) => {
              const visible = isNodeVisible(node);
              const isSelected = selectedLocator === node.id;
              const isHovered = hoveredLocator === node.id;
              const isInTrace = activeTrace ? activeTrace.lineage.has(node.id) : false;
              const isDimmed = activeTrace ? !isInTrace : (!visible);

              const AgentIcon = node.agentConfig.icon;

              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x}, ${node.y})`}
                  className={`cursor-pointer transition-opacity duration-200 ${isDimmed ? 'opacity-20' : 'opacity-100'}`}
                  onMouseEnter={() => setHoveredLocator(node.id)}
                  onMouseLeave={() => setHoveredLocator(null)}
                  onClick={(e) => {
                    e.stopPropagation();
                    setInspectNode(node);
                    onSelectLocator(node.id);
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    centerOnNode(node);
                  }}
                >
                  {/* Node ForeignObject Container */}
                  <foreignObject
                    width={node.width}
                    height={node.height}
                    className="overflow-visible"
                  >
                    <div
                      style={{
                        backgroundColor: '#090d16',
                        borderColor: isSelected 
                          ? '#38bdf8' 
                          : isHovered 
                          ? node.agentConfig.nodeBorder 
                          : '#1e293b'
                      }}
                      className={`w-full h-full rounded-xl border p-2.5 flex flex-col justify-between shadow-lg transition-all duration-150 relative ${
                        isSelected 
                          ? 'ring-2 ring-sky-400 shadow-sky-500/20 shadow-xl' 
                          : isHovered 
                          ? 'shadow-indigo-500/10 shadow-lg scale-[1.02]' 
                          : 'hover:border-slate-700'
                      }`}
                    >
                      {/* Top Row: Locator pill, Agent avatar, Message Type */}
                      <div className="flex items-center justify-between space-x-1.5">
                        <div className="flex items-center space-x-1.5 min-w-0">
                          {/* Agent Avatar Icon */}
                          <div 
                            style={{ backgroundColor: node.agentConfig.nodeBg, borderColor: node.agentConfig.nodeBorder }}
                            className="w-5 h-5 rounded-md border flex items-center justify-center shrink-0"
                          >
                            <AgentIcon className="w-3 h-3 text-white" />
                          </div>

                          {/* Locator & Agent Name */}
                          <div className="truncate flex items-center space-x-1">
                            <span className="font-mono text-[10px] font-bold text-slate-300">
                              {node.id}
                            </span>
                            <span 
                              style={{ color: node.agentConfig.nodeAccent }}
                              className="text-[10px] font-semibold truncate hidden sm:inline"
                            >
                              {node.agentConfig.shortName}
                            </span>
                          </div>
                        </div>

                        {/* Type Badge */}
                        <span className={`text-[9px] font-mono uppercase px-1.5 py-0.2 rounded border font-semibold shrink-0 ${
                          node.msg.type === 'challenge' 
                            ? 'bg-rose-950/80 text-rose-300 border-rose-800/80' 
                            : node.msg.type === 'ruling'
                            ? 'bg-purple-950/80 text-purple-300 border-purple-800/80'
                            : node.msg.type === 'finding'
                            ? 'bg-teal-950/80 text-teal-300 border-teal-800/80'
                            : 'bg-slate-900 text-slate-400 border-slate-800'
                        }`}>
                          {node.msg.type}
                        </span>
                      </div>

                      {/* Middle: Title / Snippet */}
                      <div className="text-[11px] text-slate-200 font-medium truncate mt-0.5">
                        {node.msg.title || node.msg.text.slice(0, 35)}
                      </div>

                      {/* Bottom Row: Parent Reference & HLC Clock */}
                      <div className="flex items-center justify-between text-[9px] font-mono text-slate-500 pt-0.5 border-t border-slate-800/60 mt-0.5">
                        <span className="truncate max-w-[100px]">
                          {node.msg.parentLocator ? (
                            <span className="text-indigo-400 flex items-center">
                              <CornerDownRight className="w-2.5 h-2.5 mr-0.5 inline" />
                              {node.msg.parentLocator}
                            </span>
                          ) : (
                            <span className="text-emerald-500 font-semibold">● ROOT</span>
                          )}
                        </span>
                        <span>
                          seq:{node.msg.seq || 0}
                        </span>
                      </div>
                    </div>
                  </foreignObject>
                </g>
              );
            })}
          </g>
        </g>
      </svg>

      {/* Bottom Floating Status / Legend Bar */}
      <div className="absolute bottom-3 left-3 right-3 z-10 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {/* Graph Stats pill */}
        <div className="pointer-events-auto bg-slate-900/90 backdrop-blur border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300 flex items-center space-x-3 shadow-lg">
          <div className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-indigo-400" />
            <span className="font-semibold text-slate-200">{graphData.nodes.length}</span>
            <span className="text-slate-400">актов в графе</span>
          </div>
          <div className="h-3 w-px bg-slate-700" />
          <div className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-sky-400" />
            <span className="font-semibold text-slate-200">{graphData.edges.length}</span>
            <span className="text-slate-400">каузальных ребер</span>
          </div>
          <div className="h-3 w-px bg-slate-700 hidden sm:block" />
          <div className="text-[11px] text-slate-400 hidden sm:inline">
            Клик: инспекция • Double-click: центрировать камеру
          </div>
        </div>

        {/* Legend pills */}
        <div className="pointer-events-auto hidden md:flex items-center space-x-1.5 bg-slate-900/90 backdrop-blur border border-slate-800 rounded-xl px-2.5 py-1 text-[10px] font-mono text-slate-400 shadow-lg">
          <span className="text-slate-500 mr-1">Типы связей:</span>
          <span className="text-sky-400 flex items-center">― ответ</span>
          <span className="text-rose-400 flex items-center">--- challenge</span>
          <span className="text-purple-400 flex items-center">― вердикт</span>
          <span className="text-teal-400 flex items-center">― finding</span>
        </div>
      </div>

      {/* Node Detail Drawer Modal when clicking a node */}
      {inspectNode && (
        <div className="absolute right-3 top-16 bottom-16 w-80 max-w-[calc(100%-24px)] z-30 bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-2xl shadow-2xl p-4 flex flex-col justify-between overflow-y-auto">
          <div className="space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center space-x-2 min-w-0">
                <div 
                  style={{ backgroundColor: inspectNode.agentConfig.nodeBg, borderColor: inspectNode.agentConfig.nodeBorder }}
                  className="w-7 h-7 rounded-lg border flex items-center justify-center shrink-0"
                >
                  <inspectNode.agentConfig.icon className="w-4 h-4 text-white" />
                </div>
                <div className="truncate">
                  <div className="text-xs font-bold text-slate-100 truncate">
                    {inspectNode.agentConfig.name}
                  </div>
                  <div className="font-mono text-[10px] text-indigo-400">
                    {inspectNode.id} • seq {inspectNode.msg.seq}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setInspectNode(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Title & Type */}
            <div>
              <span className="inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase mb-1.5 bg-indigo-950 text-indigo-300 border border-indigo-800">
                {inspectNode.msg.type}
              </span>
              <h4 className="text-xs font-bold text-slate-200">
                {inspectNode.msg.title || 'Акт без заголовка'}
              </h4>
            </div>

            {/* Message Body snippet */}
            <div className="text-xs text-slate-300 bg-slate-950/80 rounded-xl p-3 border border-slate-800/80 max-h-44 overflow-y-auto leading-relaxed">
              {inspectNode.msg.text}
            </div>

            {/* Metadata (HLC & SHA256) */}
            <div className="space-y-1.5 bg-slate-950/40 rounded-xl p-2.5 border border-slate-800/60 text-[10px] font-mono text-slate-400">
              <div className="flex items-center justify-between">
                <span className="flex items-center text-slate-500">
                  <Clock className="w-3 h-3 mr-1" /> HLC Часы:
                </span>
                <span className="text-slate-200 truncate max-w-[140px]">
                  {inspectNode.msg.hlc || 'none'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center text-slate-500">
                  <CornerDownRight className="w-3 h-3 mr-1" /> Родитель:
                </span>
                <span className="text-indigo-400 font-bold">
                  {inspectNode.msg.parentLocator || 'Корень (Root)'}
                </span>
              </div>
              {inspectNode.msg.digest && (
                <div className="flex items-center justify-between">
                  <span className="flex items-center text-slate-500">
                    <Key className="w-3 h-3 mr-1" /> SHA-256:
                  </span>
                  <span className="text-slate-300 truncate max-w-[130px]" title={inspectNode.msg.digest}>
                    {inspectNode.msg.digest.slice(0, 14)}...
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-3 border-t border-slate-800 flex items-center space-x-2">
            <button
              onClick={() => {
                onSelectLocator(inspectNode.id);
                setInspectNode(null);
              }}
              className="flex-1 py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center justify-center space-x-1.5 transition shadow-lg shadow-indigo-600/30"
            >
              <span>Показать в чате</span>
              <CornerDownRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => centerOnNode(inspectNode)}
              className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
              title="Центрировать камеру"
            >
              <Compass className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
