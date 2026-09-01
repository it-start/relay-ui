export type AgentRole = 'author' | 'challenger' | 'criterion_guard' | 'arbitrator' | 'witness';

export interface AgentInfo {
  id: string;
  name: string;
  avatar: string;
  role: AgentRole;
  flavor: string;
  color: string;
}

export type AdjudicationPhase = 
  | 'claim'
  | 'weighing'
  | 'challenge'
  | 'criterion_check'
  | 'arbitration'
  | 'ruling';

export type FindingVerdict = 'PASS' | 'VIOLATES' | 'UNDECIDABLE';
export type VisibilityState = 'PRESENT' | 'KNOWN_MISSING' | 'UNKNOWN';

export interface AdjudicationStep {
  phase: AdjudicationPhase;
  title: string;
  agent: AgentInfo;
  description: string;
  biblicalPrinciple?: string;
  scriptureRef?: string;
  payload: Record<string, any>;
  verdict?: FindingVerdict;
  outputLog?: string;
  timestamp: string;
}

export interface AdjudicationCase {
  id: string;
  title: string;
  summary: string;
  criterionRef: string;
  criterionText: string;
  initialClaim: {
    author: string;
    action: string;
    rawPayload: Record<string, any>;
    digest: string;
  };
  steps: AdjudicationStep[];
  finalRuling: {
    status: 'COMMITTED' | 'REJECTED' | 'ARBITRATED';
    rulingText: string;
    ledgerSeq?: number;
    witnessCount: number;
    digest: string;
  };
}

export interface RosettaPrinciple {
  id: string;
  title: string;
  source: string;
  quote: string;
  problemInAI: string;
  protocolPrimitive: string;
  codeSnippet: string;
  interactiveType: 'canonicalizer' | 'cross_examination' | 'role_separation' | 'criterion_guard' | 'the_lot';
}

export interface RelayEnvelope {
  id: string;
  seq?: number;
  type: 'claim' | 'challenge' | 'finding' | 'ruling' | 'message';
  store_id: string;
  locator: string;
  digest: string;
  from: string;
  to: string;
  parent?: string;
  header_block?: {
    id?: string;
    deposited_by?: string;
    timestamp?: string;
    [key: string]: any;
  };
  payload: Record<string, any>;
  status: 'pending' | 'verified' | 'committed' | 'rejected';
}

export interface FailureModeSimulation {
  id: string;
  name: string;
  specClause: string;
  description: string;
  historicalIncident: string;
  naiveBehavior: string;
  v1ConformingBehavior: string;
  guaranteeAffected: 'G1' | 'G2a' | 'G2b' | 'Ordering' | 'None';
}

export interface StoreCapabilities {
  readonly write: boolean;
  readonly delete: boolean;
  readonly reset: boolean;
}

export type DigestScheme = 'canonical-json-payload' | 'raw-body-bytes' | 'custom' | string;

export interface VerifyDigestResult {
  locator: string;
  valid: boolean;
  digestScheme: DigestScheme;
  schemeDescription?: string;
  headerDigest: string;
  computedDigest: string;
  canonicalPayloadString?: string;
  rawBodyBytes?: string;
}

