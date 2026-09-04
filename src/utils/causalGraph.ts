import { ChatMessage, getAgentConfig, AgentConfigItem } from '../components/chatTypes';

export interface DAGNode {
  id: string; // locator, e.g. "relay-0001"
  msg: ChatMessage;
  agentConfig: AgentConfigItem;
  depth: number;
  lane: number;
  x: number;
  y: number;
  width: number;
  height: number;
  parents: string[];
  children: string[];
  isRoot: boolean;
  isLeaf: boolean;
  clusterId: string;
}

export interface DAGEdge {
  id: string;
  source: string;
  target: string;
  type: 'reply' | 'challenge' | 'ruling' | 'finding' | 'attestation' | 'default';
  path: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
}

export interface CausalGraphData {
  nodes: DAGNode[];
  nodeMap: Map<string, DAGNode>;
  edges: DAGEdge[];
  roots: DAGNode[];
  clusters: Map<string, DAGNode[]>;
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    width: number;
    height: number;
  };
}

export type GraphOrientation = 'horizontal' | 'vertical';

const NODE_WIDTH_H = 220;
const NODE_HEIGHT_H = 76;
const LAYER_GAP_H = 110;
const LANE_GAP_H = 96;

const NODE_WIDTH_V = 210;
const NODE_HEIGHT_V = 72;
const LAYER_GAP_V = 100;
const LANE_GAP_V = 240;

/**
 * Builds a topological Causal Directed Acyclic Graph (DAG) from a list of ChatMessages.
 * Correctly accounts for multi-agent parentLocators and HLC order.
 */
export function buildCausalDAG(
  messages: ChatMessage[],
  orientation: GraphOrientation = 'horizontal'
): CausalGraphData {
  const nodeMap = new Map<string, DAGNode>();
  const nodes: DAGNode[] = [];
  const edges: DAGEdge[] = [];
  const clusters = new Map<string, DAGNode[]>();

  if (!messages || messages.length === 0) {
    return {
      nodes: [],
      nodeMap,
      edges: [],
      roots: [],
      clusters,
      bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0 }
    };
  }

  // 1. First pass: Register all nodes
  const locatorMap = new Map<string, ChatMessage>();
  for (const msg of messages) {
    const locator = msg.locator || `relay-${String(msg.seq || 0).padStart(4, '0')}`;
    locatorMap.set(locator, msg);
  }

  for (const msg of messages) {
    const locator = msg.locator || `relay-${String(msg.seq || 0).padStart(4, '0')}`;
    const agentConfig = getAgentConfig(msg.sender);

    const node: DAGNode = {
      id: locator,
      msg,
      agentConfig,
      depth: 0,
      lane: 0,
      x: 0,
      y: 0,
      width: orientation === 'horizontal' ? NODE_WIDTH_H : NODE_WIDTH_V,
      height: orientation === 'horizontal' ? NODE_HEIGHT_H : NODE_HEIGHT_V,
      parents: [],
      children: [],
      isRoot: true,
      isLeaf: true,
      clusterId: 'root'
    };

    nodeMap.set(locator, node);
    nodes.push(node);
  }

  // 2. Second pass: Construct parent-child links
  for (const node of nodes) {
    const pLoc = node.msg.parentLocator;
    if (pLoc && nodeMap.has(pLoc) && pLoc !== node.id) {
      node.parents.push(pLoc);
      node.isRoot = false;
      const parentNode = nodeMap.get(pLoc)!;
      parentNode.children.push(node.id);
      parentNode.isLeaf = false;
    }
  }

  // 3. Third pass: Calculate topological depth (Sugiyama layering)
  const visited = new Set<string>();

  function calculateDepth(n: DAGNode, currentDepth: number) {
    if (currentDepth > n.depth) {
      n.depth = currentDepth;
    }
    for (const childId of n.children) {
      const childNode = nodeMap.get(childId);
      if (childNode) {
        calculateDepth(childNode, n.depth + 1);
      }
    }
  }

  // Start from roots
  const roots = nodes.filter((n) => n.isRoot);
  for (const root of roots) {
    calculateDepth(root, 0);
  }

  // For disconnected cycles or unvisited nodes, assign default sequential depth
  nodes.forEach((n, idx) => {
    if (n.parents.length === 0 && !n.isRoot) {
      n.depth = 0;
    }
  });

  // 4. Cluster by conversation threads & assign lanes
  let laneCounter = 0;
  const depthLaneMap = new Map<number, number>();

  // Sort nodes primarily by depth, then by sequence / timestamp
  nodes.sort((a, b) => {
    if (a.depth !== b.depth) return a.depth - b.depth;
    return (a.msg.seq || 0) - (b.msg.seq || 0);
  });

  for (const node of nodes) {
    const currentLane = depthLaneMap.get(node.depth) || 0;
    node.lane = currentLane;
    depthLaneMap.set(node.depth, currentLane + 1);

    // Group into clusters based on root ancestor
    let rootAncestor = node.id;
    let curr = node;
    while (curr.parents.length > 0) {
      const parent = nodeMap.get(curr.parents[0]);
      if (!parent) break;
      rootAncestor = parent.id;
      curr = parent;
    }
    node.clusterId = rootAncestor;
    if (!clusters.has(rootAncestor)) {
      clusters.set(rootAncestor, []);
    }
    clusters.get(rootAncestor)!.push(node);
  }

  // 5. Compute coordinates based on orientation
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const node of nodes) {
    if (orientation === 'horizontal') {
      node.x = node.depth * (NODE_WIDTH_H + LAYER_GAP_H) + 60;
      node.y = node.lane * (NODE_HEIGHT_H + LANE_GAP_H) + 60;
    } else {
      node.x = node.lane * (NODE_WIDTH_V + LANE_GAP_V) + 60;
      node.y = node.depth * (NODE_HEIGHT_V + LAYER_GAP_V) + 60;
    }

    minX = Math.min(minX, node.x);
    maxX = Math.max(maxX, node.x + node.width);
    minY = Math.min(minY, node.y);
    maxY = Math.max(maxY, node.y + node.height);
  }

  if (minX === Infinity) {
    minX = 0; maxX = 800; minY = 0; maxY = 600;
  }

  // 6. Build cubic Bezier connecting edges
  for (const node of nodes) {
    for (const childId of node.children) {
      const child = nodeMap.get(childId);
      if (!child) continue;

      let edgeType: DAGEdge['type'] = 'default';
      if (child.msg.type === 'challenge') edgeType = 'challenge';
      else if (child.msg.type === 'ruling') edgeType = 'ruling';
      else if (child.msg.type === 'finding') edgeType = 'finding';
      else if (child.msg.type === 'attestation') edgeType = 'attestation';
      else if (child.msg.type === 'claim') edgeType = 'reply';

      let sourceX = 0;
      let sourceY = 0;
      let targetX = 0;
      let targetY = 0;
      let path = '';

      if (orientation === 'horizontal') {
        sourceX = node.x + node.width;
        sourceY = node.y + node.height / 2;
        targetX = child.x;
        targetY = child.y + child.height / 2;

        const deltaX = Math.max(40, (targetX - sourceX) / 2);
        path = `M ${sourceX} ${sourceY} C ${sourceX + deltaX} ${sourceY}, ${targetX - deltaX} ${targetY}, ${targetX} ${targetY}`;
      } else {
        sourceX = node.x + node.width / 2;
        sourceY = node.y + node.height;
        targetX = child.x + child.width / 2;
        targetY = child.y;

        const deltaY = Math.max(40, (targetY - sourceY) / 2);
        path = `M ${sourceX} ${sourceY} C ${sourceX} ${sourceY + deltaY}, ${targetX} ${targetY - deltaY}, ${targetX} ${targetY}`;
      }

      edges.push({
        id: `${node.id}->${child.id}`,
        source: node.id,
        target: child.id,
        type: edgeType,
        path,
        sourceX,
        sourceY,
        targetX,
        targetY
      });
    }
  }

  return {
    nodes,
    nodeMap,
    edges,
    roots,
    clusters,
    bounds: {
      minX,
      maxX,
      minY,
      maxY,
      width: Math.max(800, maxX - minX + 120),
      height: Math.max(500, maxY - minY + 120)
    }
  };
}

/**
 * Returns all ancestor node IDs for a given locator (walking up parents).
 */
export function getAncestors(locator: string, nodeMap: Map<string, DAGNode>): Set<string> {
  const result = new Set<string>();
  const queue = [locator];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const node = nodeMap.get(currentId);
    if (!node) continue;

    for (const parentId of node.parents) {
      if (!result.has(parentId)) {
        result.add(parentId);
        queue.push(parentId);
      }
    }
  }

  return result;
}

/**
 * Returns all descendant node IDs for a given locator (walking down children).
 */
export function getDescendants(locator: string, nodeMap: Map<string, DAGNode>): Set<string> {
  const result = new Set<string>();
  const queue = [locator];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const node = nodeMap.get(currentId);
    if (!node) continue;

    for (const childId of node.children) {
      if (!result.has(childId)) {
        result.add(childId);
        queue.push(childId);
      }
    }
  }

  return result;
}

/**
 * Returns full lineage trace (ancestors + self + descendants).
 */
export function getCausalTrace(locator: string, nodeMap: Map<string, DAGNode>) {
  const ancestors = getAncestors(locator, nodeMap);
  const descendants = getDescendants(locator, nodeMap);
  const lineage = new Set<string>([locator, ...ancestors, ...descendants]);

  return {
    ancestors,
    descendants,
    lineage
  };
}
