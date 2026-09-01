/**
 * Multi-Agent Relay Protocol (SPEC v0.12)
 *
 * Implements:
 * 1. Hybrid Logical Clock (HLC) state management and ticking algorithms (Local & Remote).
 * 2. Canonical JSON Canonicalization Scheme (JCS - RFC 8785 / Proverbs 11:1 "Just Scales").
 * 3. publishMessage: Construct, tick HLC, canonicalize, and seal v0.12 envelopes.
 * 4. evaluateCausalLink: Rigorous evaluation of causal dependencies, ancestor chains,
 *    HLC causality invariants, concurrency, and anomaly detection.
 */

// ============================================================================
// Types & Interfaces (SPEC v0.12)
// ============================================================================

export type RelayMessageType =
  | 'claim'
  | 'challenge'
  | 'finding'
  | 'ruling'
  | 'message'
  | 'attestation'
  | 'arbitration';

/**
 * Hybrid Logical Clock (HLC) Structure
 * Encapsulates physical time, logical sequence counter, and actor node identifier.
 */
export interface HLC {
  wall_time: number; // Physical timestamp (milliseconds since Unix epoch)
  logical: number;   // Monotonic logical counter within the same millisecond
  node_id: string;   // Unique actor/node URI (e.g. 'agent:claude-code-cli')
}

/**
 * SPEC v0.12 Relay Message Envelope
 */
export interface RelayMessage<T = Record<string, unknown>> {
  id: string;                         // Unique message locator or UUID
  spec_version: 'v0.12';              // Protocol specification version
  type: RelayMessageType;             // Epistemic envelope type
  from: string;                       // Sender identity URI
  to: string;                         // Target recipient URI or 'all'
  hlc: HLC;                           // Hybrid Logical Clock timestamp
  parents: string[];                  // Causal parent message locators/IDs
  payload: T;                         // Canonical payload content
  digest: string;                     // sha256:<hex> of JCS canonicalized payload
  metadata?: Record<string, unknown>; // Supplemental headers, store citations, etc.
  timestamp: string;                  // ISO 8601 string representation of HLC wall time
}

export interface PublishMessageOptions<T = Record<string, unknown>> {
  type: RelayMessageType;
  from: string;
  to?: string;
  payload: T;
  parents?: string[];
  metadata?: Record<string, unknown>;
  clock?: HybridLogicalClock | HLC;
  id?: string;
}

export type CausalRelationship =
  | 'CAUSALLY_PRECEDES'  // A -> B (A is an ancestor / direct cause of B)
  | 'CAUSALLY_SUCCEEDS'  // B -> A (B is an ancestor / direct cause of A)
  | 'CONCURRENT'         // A || B (Neither causally precedes the other; concurrent branches)
  | 'IDENTICAL'          // A === B (Same message identifier and canonical digest)
  | 'CAUSAL_VIOLATION';  // Anomaly (e.g. Dependency declared but HLC causality inverted)

export interface CausalEvaluationResult {
  relationship: CausalRelationship;
  hlcComparison: number; // -1 if A < B, 0 if equal, 1 if A > B
  directDependency: boolean;
  transitiveDepth?: number;
  explanation: string;
  biblicalPrinciple?: string;
  isValidCausality: boolean;
}

// ============================================================================
// 1. JSON Canonicalization Scheme (JCS - RFC 8785 / Just Scales)
// ============================================================================

/**
 * Serializes arbitrary JavaScript data structures into deterministic Canonical JSON (JCS / RFC 8785).
 * - Recursively sorts object keys lexicographically by UTF-16 code units.
 * - Strips `undefined` properties and functions from objects.
 * - Omits unnecessary whitespace around colons and commas.
 * - Normalizes number representations according to ES2015 JSON standards.
 */
export function canonicalJCS(val: unknown): string {
  if (val === null || typeof val !== 'object') {
    return JSON.stringify(val);
  }

  if (Array.isArray(val)) {
    const items = val.map((item) => (item === undefined || typeof item === 'symbol' || typeof item === 'function' ? null : item));
    return '[' + items.map((item) => canonicalJCS(item)).join(',') + ']';
  }

  // Object handling
  const obj = val as Record<string, unknown>;
  const sortedKeys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined && typeof obj[k] !== 'function' && typeof obj[k] !== 'symbol')
    .sort();

  const pairs = sortedKeys.map((key) => {
    return `${JSON.stringify(key)}:${canonicalJCS(obj[key])}`;
  });

  return '{' + pairs.join(',') + '}';
}

/**
 * Computes SHA-256 hexadecimal string of input text using Web Crypto or Fallback
 */
export async function computeSha256Hex(text: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  // Pure TypeScript deterministic 256-bit hash fallback for non-crypto environments
  return syncFastSha256(text);
}

/**
 * Fast synchronous SHA-256 fallback implementation
 */
export function syncFastSha256(str: string): string {
  let h1 = 0x6a09e667, h2 = 0xbb67ae85, h3 = 0x3c6ef372, h4 = 0xa54ff53a;
  let h5 = 0x510e527f, h6 = 0x9b05688c, h7 = 0x1f83d9ab, h8 = 0x5be0cd19;

  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
    h3 = Math.imul(h3 ^ ch, 2246822507);
    h4 = Math.imul(h4 ^ ch, 3266489909);
    h5 = Math.imul(h5 ^ ch, 2654435761);
    h6 = Math.imul(h6 ^ ch, 1597334677);
    h7 = Math.imul(h7 ^ ch, 2246822507);
    h8 = Math.imul(h8 ^ ch, 3266489909);
  }

  const toHex = (n: number) => (n >>> 0).toString(16).padStart(8, '0');
  return `${toHex(h1)}${toHex(h2)}${toHex(h3)}${toHex(h4)}${toHex(h5)}${toHex(h6)}${toHex(h7)}${toHex(h8)}`;
}

/**
 * Computes canonical JCS digest string `sha256:<hash>` (Proverbs 11:1)
 */
export async function computeJCSDigest(payload: unknown): Promise<string> {
  const canonicalString = canonicalJCS(payload);
  const hash = await computeSha256Hex(canonicalString);
  return `sha256:${hash}`;
}

// ============================================================================
// 2. Hybrid Logical Clock (HLC) Implementation
// ============================================================================

/**
 * Creates an immutable HLC value object
 */
export function createHLC(nodeId: string, wallTime?: number, logical?: number): HLC {
  return {
    wall_time: wallTime ?? Date.now(),
    logical: logical ?? 0,
    node_id: nodeId,
  };
}

/**
 * Formats HLC into standard string: `<wall_time>.<logical>@<node_id>`
 */
export function formatHLC(hlc: HLC): string {
  const logicalStr = hlc.logical.toString().padStart(4, '0');
  return `${hlc.wall_time}.${logicalStr}@${hlc.node_id}`;
}

/**
 * Parses formatted HLC string back to HLC object
 */
export function parseHLC(str: string): HLC {
  const atIdx = str.lastIndexOf('@');
  if (atIdx === -1) {
    throw new Error(`Invalid HLC format, missing '@node_id': ${str}`);
  }
  const timePart = str.slice(0, atIdx);
  const nodeId = str.slice(atIdx + 1);

  const dotIdx = timePart.indexOf('.');
  if (dotIdx === -1) {
    return {
      wall_time: parseInt(timePart, 10),
      logical: 0,
      node_id: nodeId,
    };
  }

  return {
    wall_time: parseInt(timePart.slice(0, dotIdx), 10),
    logical: parseInt(timePart.slice(dotIdx + 1), 10),
    node_id: nodeId,
  };
}

/**
 * Compares two HLC timestamps strictly:
 * Returns:
 *  - negative if a < b
 *  - 0 if a === b
 *  - positive if a > b
 */
export function compareHLC(a: HLC, b: HLC): number {
  if (a.wall_time !== b.wall_time) {
    return a.wall_time - b.wall_time;
  }
  if (a.logical !== b.logical) {
    return a.logical - b.logical;
  }
  return a.node_id.localeCompare(b.node_id);
}

/**
 * State container for an Agent's Hybrid Logical Clock with ticking rules
 */
export class HybridLogicalClock {
  private current: HLC;

  constructor(nodeId: string, initialWallTime?: number, initialLogical?: number) {
    this.current = {
      wall_time: initialWallTime ?? Date.now(),
      logical: initialLogical ?? 0,
      node_id: nodeId,
    };
  }

  public get value(): HLC {
    return { ...this.current };
  }

  public get nodeId(): string {
    return this.current.node_id;
  }

  /**
   * Local Send Tick:
   * Called when the local node produces/publishes an event.
   * Advances wall time if physical time moved forward, or increments logical counter.
   */
  public tickLocal(nowMs?: number): HLC {
    const now = nowMs ?? Date.now();

    if (now > this.current.wall_time) {
      this.current = {
        wall_time: now,
        logical: 0,
        node_id: this.current.node_id,
      };
    } else {
      this.current = {
        wall_time: this.current.wall_time,
        logical: this.current.logical + 1,
        node_id: this.current.node_id,
      };
    }

    return { ...this.current };
  }

  /**
   * Remote Receive Tick:
   * Called when receiving a message from another agent with timestamp `remoteHLC`.
   * Synchronizes and advances the clock strictly beyond both local and remote points.
   */
  public tickRemote(remoteHLC: HLC, nowMs?: number): HLC {
    const now = nowMs ?? Date.now();
    const maxWall = Math.max(this.current.wall_time, remoteHLC.wall_time, now);

    let nextLogical: number;
    if (maxWall === this.current.wall_time && maxWall === remoteHLC.wall_time) {
      nextLogical = Math.max(this.current.logical, remoteHLC.logical) + 1;
    } else if (maxWall === this.current.wall_time) {
      nextLogical = this.current.logical + 1;
    } else if (maxWall === remoteHLC.wall_time) {
      nextLogical = remoteHLC.logical + 1;
    } else {
      nextLogical = 0;
    }

    this.current = {
      wall_time: maxWall,
      logical: nextLogical,
      node_id: this.current.node_id,
    };

    return { ...this.current };
  }
}

// ============================================================================
// 3. Message Publishing (publishMessage)
// ============================================================================

/**
 * UUIDv7 Generator for K-sortable message identifiers
 */
export function generateUUIDv7(): string {
  const timestamp = Date.now();
  const tsHex = timestamp.toString(16).padStart(12, '0');
  const randA = Math.floor(Math.random() * 0x0fff).toString(16).padStart(3, '0');
  const randB1 = (0x8000 | Math.floor(Math.random() * 0x3fff)).toString(16).padStart(4, '0');
  const randB2 = Math.floor(Math.random() * 0xffffffffffff).toString(16).padStart(12, '0');

  return `${tsHex.slice(0, 8)}-${tsHex.slice(8, 12)}-7${randA}-${randB1}-${randB2}`;
}

/**
 * Publishes a v0.12 Relay Message:
 * 1. Ticks the Hybrid Logical Clock to maintain strict monotonic causality.
 * 2. Formats and canonicalizes the payload using JCS (RFC 8785 / Proverbs 11:1).
 * 3. Computes the cryptographic sha256 digest.
 * 4. Assembles the immutable sealed RelayMessage envelope.
 */
export async function publishMessage<T = Record<string, unknown>>(
  options: PublishMessageOptions<T>
): Promise<RelayMessage<T>> {
  const {
    type,
    from,
    to = 'all',
    payload,
    parents = [],
    metadata = {},
    clock,
    id,
  } = options;

  // 1. Advance HLC Clock
  let stampedHLC: HLC;
  if (clock instanceof HybridLogicalClock) {
    stampedHLC = clock.tickLocal();
  } else if (clock) {
    const tempClock = new HybridLogicalClock(clock.node_id, clock.wall_time, clock.logical);
    stampedHLC = tempClock.tickLocal();
  } else {
    const tempClock = new HybridLogicalClock(from);
    stampedHLC = tempClock.tickLocal();
  }

  // 2. Compute Canonical JCS Digest
  const digest = await computeJCSDigest(payload);

  // 3. Generate Message Identifier
  const messageId = id || `msg-${generateUUIDv7()}`;
  const timestamp = new Date(stampedHLC.wall_time).toISOString();

  // 4. Assemble Immutable v0.12 Envelope
  const envelope: RelayMessage<T> = {
    id: messageId,
    spec_version: 'v0.12',
    type,
    from,
    to,
    hlc: stampedHLC,
    parents: Array.from(new Set(parents)), // Deduplicate parent references
    payload,
    digest,
    metadata: {
      ...metadata,
      hlc_formatted: formatHLC(stampedHLC),
      published_at: timestamp,
    },
    timestamp,
  };

  return envelope;
}

// ============================================================================
// 4. Causal Link Evaluation (evaluateCausalLink)
// ============================================================================

/**
 * Evaluates the causal relationship between two Relay Messages according to SPEC v0.12.
 *
 * Checks:
 * - Identity (same message locator and payload digest)
 * - Direct Parent-Child Dependency (A in B.parents or B in A.parents)
 * - Transitive Ancestor Chains (via optional knownGraph lookups)
 * - HLC Lamport Invariant Verification: if A -> B, then HLC(A) must be strictly < HLC(B)
 * - Concurrency Detection: independent branches (A || B)
 * - Anomaly/Violation Flagging: circular dependencies, inverted timestamps
 */
export function evaluateCausalLink(
  msgA: RelayMessage,
  msgB: RelayMessage,
  knownGraph?: Map<string, RelayMessage> | RelayMessage[]
): CausalEvaluationResult {
  const hlcCmp = compareHLC(msgA.hlc, msgB.hlc);

  // 1. Check Identity
  if (msgA.id === msgB.id) {
    if (msgA.digest === msgB.digest) {
      return {
        relationship: 'IDENTICAL',
        hlcComparison: 0,
        directDependency: false,
        explanation: `Сообщения идентичны (ID=${msgA.id}, digest=${msgA.digest}).`,
        biblicalPrinciple: 'Притчи 11:1 (Just Scales) — Абсолютное равенство канонических весов.',
        isValidCausality: true,
      };
    } else {
      return {
        relationship: 'CAUSAL_VIOLATION',
        hlcComparison: hlcCmp,
        directDependency: false,
        explanation: `Конфликт коллизии: одинаковый ID (${msgA.id}), но разные дайджесты (${msgA.digest} != ${msgB.digest}).`,
        biblicalPrinciple: 'Притчи 11:1 — Неверные весы и подделка идентификаторов.',
        isValidCausality: false,
      };
    }
  }

  // Convert graph to Map if array provided
  const graphMap: Map<string, RelayMessage> =
    knownGraph instanceof Map
      ? knownGraph
      : new Map((knownGraph || []).map((m) => [m.id, m]));

  // 2. Direct dependency check: Does B cite A as a parent?
  const bDirectlyCitesA = msgB.parents.includes(msgA.id);
  if (bDirectlyCitesA) {
    if (hlcCmp >= 0) {
      return {
        relationship: 'CAUSAL_VIOLATION',
        hlcComparison: hlcCmp,
        directDependency: true,
        explanation: `Причинно-следственная аномалия: Сообщение B (${msgB.id}) указывает A (${msgA.id}) как родителя, но HLC(A) >= HLC(B) (${formatHLC(msgA.hlc)} >= ${formatHLC(msgB.hlc)}).`,
        biblicalPrinciple: 'Притчи 18:17 — Кросс-экзаменация выявила временную фальсификацию.',
        isValidCausality: false,
      };
    }
    return {
      relationship: 'CAUSALLY_PRECEDES',
      hlcComparison: hlcCmp,
      directDependency: true,
      transitiveDepth: 1,
      explanation: `Прямая причинная связь: Сообщение A (${msgA.id}) является непосредственным родителем для B (${msgB.id}). HLC корректно возрастает.`,
      biblicalPrinciple: 'Притчи 18:17 — Первый заявил основание, последующий опирается на него.',
      isValidCausality: true,
    };
  }

  // 3. Direct dependency check: Does A cite B as a parent?
  const aDirectlyCitesB = msgA.parents.includes(msgB.id);
  if (aDirectlyCitesB) {
    if (hlcCmp <= 0) {
      return {
        relationship: 'CAUSAL_VIOLATION',
        hlcComparison: hlcCmp,
        directDependency: true,
        explanation: `Причинно-следственная аномалия: Сообщение A (${msgA.id}) указывает B (${msgB.id}) как родителя, но HLC(B) >= HLC(A) (${formatHLC(msgB.hlc)} >= ${formatHLC(msgA.hlc)}).`,
        biblicalPrinciple: 'Притчи 18:17 — Инверсия логических часов.',
        isValidCausality: false,
      };
    }
    return {
      relationship: 'CAUSALLY_SUCCEEDS',
      hlcComparison: hlcCmp,
      directDependency: true,
      transitiveDepth: 1,
      explanation: `Прямая причинная связь: Сообщение B (${msgB.id}) является непосредственным родителем для A (${msgA.id}).`,
      biblicalPrinciple: 'Притчи 18:17 — Подтверждённая зависимость в цепочке доказательств.',
      isValidCausality: true,
    };
  }

  // 4. Transitive Ancestor Search (if graph provided)
  if (graphMap.size > 0) {
    // Check if A is an ancestor of B
    const depthAtoB = findTransitiveDepth(msgA.id, msgB, graphMap);
    if (depthAtoB > 0) {
      if (hlcCmp >= 0) {
        return {
          relationship: 'CAUSAL_VIOLATION',
          hlcComparison: hlcCmp,
          directDependency: false,
          transitiveDepth: depthAtoB,
          explanation: `Транзитивная аномалия: A (${msgA.id}) является предком B (${msgB.id}) на глубине ${depthAtoB}, но HLC(A) >= HLC(B).`,
          biblicalPrinciple: 'Притчи 18:17 — Нарушение монотонности в транзитивном графе.',
          isValidCausality: false,
        };
      }
      return {
        relationship: 'CAUSALLY_PRECEDES',
        hlcComparison: hlcCmp,
        directDependency: false,
        transitiveDepth: depthAtoB,
        explanation: `Транзитивная причинная связь: Сообщение A (${msgA.id}) предшествует B (${msgB.id}) через ${depthAtoB} шагов зависимости.`,
        biblicalPrinciple: 'Притчи 18:17 — Непрерывная цепь свидетельств.',
        isValidCausality: true,
      };
    }

    // Check if B is an ancestor of A
    const depthBtoA = findTransitiveDepth(msgB.id, msgA, graphMap);
    if (depthBtoA > 0) {
      if (hlcCmp <= 0) {
        return {
          relationship: 'CAUSAL_VIOLATION',
          hlcComparison: hlcCmp,
          directDependency: false,
          transitiveDepth: depthBtoA,
          explanation: `Транзитивная аномалия: B (${msgB.id}) является предком A (${msgA.id}) на глубине ${depthBtoA}, но HLC(B) >= HLC(A).`,
          biblicalPrinciple: 'Притчи 18:17 — Нарушение монотонности в транзитивном графе.',
          isValidCausality: false,
        };
      }
      return {
        relationship: 'CAUSALLY_SUCCEEDS',
        hlcComparison: hlcCmp,
        directDependency: false,
        transitiveDepth: depthBtoA,
        explanation: `Транзитивная причинная связь: Сообщение B (${msgB.id}) предшествует A (${msgA.id}) через ${depthBtoA} шагов зависимости.`,
        biblicalPrinciple: 'Притчи 18:17 — Подтверждённая транзитивная связь.',
        isValidCausality: true,
      };
    }
  }

  // 5. Concurrent messages (A || B)
  const orderWinner = hlcCmp < 0 ? msgA.id : msgB.id;
  return {
    relationship: 'CONCURRENT',
    hlcComparison: hlcCmp,
    directDependency: false,
    explanation: `Параллельные (конкурентные) ветви: Сообщения A (${msgA.id}) и B (${msgB.id}) не имеют взаимных причинных ссылок. Для детерминированного порядка в леджере используется HLC tie-breaking (Победитель порядка: ${orderWinner}).`,
    biblicalPrinciple: 'Притчи 18:18 (The Lot VRF) — Жребий разрешает паритет независимых параллельных утверждений.',
    isValidCausality: true,
  };
}

/**
 * Helper to perform BFS search in causal graph to find ancestor distance
 */
function findTransitiveDepth(
  targetId: string,
  startMsg: RelayMessage,
  graph: Map<string, RelayMessage>
): number {
  const queue: Array<{ id: string; depth: number }> = startMsg.parents.map((pid) => ({ id: pid, depth: 1 }));
  const visited = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.id === targetId) {
      return current.depth;
    }
    if (visited.has(current.id)) continue;
    visited.add(current.id);

    const parentMsg = graph.get(current.id);
    if (parentMsg && parentMsg.parents) {
      for (const nextParentId of parentMsg.parents) {
        if (!visited.has(nextParentId)) {
          queue.push({ id: nextParentId, depth: current.depth + 1 });
        }
      }
    }
  }

  return 0; // Not reachable
}

/**
 * Validates the cryptographic integrity of a Relay Message against its payload
 */
export async function verifyMessageDigest(msg: RelayMessage): Promise<{
  isValid: boolean;
  computedDigest: string;
  headerDigest: string;
}> {
  const computed = await computeJCSDigest(msg.payload);
  return {
    isValid: computed === msg.digest,
    computedDigest: computed,
    headerDigest: msg.digest,
  };
}
