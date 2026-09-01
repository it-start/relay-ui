/**
 * Core Types and Interfaces for the Agent Relay Store Boundary
 * 
 * Allows seamless swapping of storage backends (POSIX O_EXCL, SQLite, In-Memory,
 * S3/GCS CAS, Custom Converter Adapters, or Remote Store Proxies).
 */

export interface StoreCapabilities {
  readonly write: boolean;
  readonly delete: boolean;
  readonly reset: boolean;
}

export type DigestScheme = 'canonical-json-payload' | 'raw-body-bytes' | 'custom' | string;

export class StoreCapabilityError extends Error {
  readonly capability: keyof StoreCapabilities;
  readonly storeId: string;

  constructor(storeId: string, capability: keyof StoreCapabilities, message?: string) {
    super(message || `Relay Store "${storeId}" does not support operation "${capability}" (capability disabled).`);
    this.name = 'StoreCapabilityError';
    this.capability = capability;
    this.storeId = storeId;
  }
}

export interface EnvelopeHeaderBlock {
  deposited_by: string;
  timestamp: string;
  seq: number;
  locator: string;
  digest: string;
  [key: string]: any;
}

export interface Envelope {
  id: string;
  seq: number;
  locator: string;
  store_id: string;
  digest: string;
  type: string;
  title: string;
  from: string;
  to: string;
  parent_locator?: string | null;
  header_block: EnvelopeHeaderBlock;
  payload: Record<string, any>;
  metadata: Record<string, any>;
  status: 'committed' | 'missing' | 'disputed' | string;
  timestamp: string;
  [key: string]: any;
}

export type RecordStatus = 'PRESENT' | 'KNOWN_MISSING' | 'CORRUPTED';

export interface RelayRecord {
  locator: string;
  status: RecordStatus;
  envelope: Envelope | null;
  note?: string;
  error?: string;
}

export interface RelayStoreStatus {
  status: 'online' | 'degraded' | 'offline';
  storeType: string;
  storeRoot?: string;
  capabilities: StoreCapabilities;
  totalSequencesAllocated: number;
  presentRecordsCount: number;
  knownMissingCount: number;
  inboxes: {
    claude: number;
    chatgpt: number;
    gemini: number;
    court: number;
    [agent: string]: number;
  };
  [key: string]: any;
}

export interface DepositInput {
  from: string;
  to?: string;
  type?: string;
  title?: string;
  payload: Record<string, any>;
  parent_locator?: string;
  metadata?: Record<string, any>;
}

export interface InboxMessageInput {
  from: string;
  to: string;
  type?: string;
  title?: string;
  payload: Record<string, any>;
}

export interface InboxMessage {
  id: string;
  from: string;
  to: string;
  type: string;
  title: string;
  payload: Record<string, any>;
  timestamp: string;
  file?: string;
  [key: string]: any;
}

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

export interface DeletePayloadResult {
  success: boolean;
  locator: string;
  status: 'KNOWN_MISSING' | 'ALREADY_MISSING' | 'NOT_FOUND';
  message: string;
}

/**
 * Unified Relay Store Interface (Boundary Port)
 */
export interface IRelayStore {
  /** Identifier of the store backend */
  readonly id: string;

  /** Operational capabilities declared by this store (Read-Only, Immutable, Full RW, etc.) */
  readonly capabilities: StoreCapabilities;

  /** Initialize store, verify directories/tables and seed genesis if needed */
  init(): Promise<void> | void;

  /** Retrieve current store metrics, capabilities and inbox counts */
  getStatus(): Promise<RelayStoreStatus> | RelayStoreStatus;

  /** Allocate next monotonic sequence slot */
  allocateSequence(): Promise<{ seq: number; locator: string }> | { seq: number; locator: string };

  /** Atomically deposit an envelope into the ledger */
  deposit(data: DepositInput): Promise<Envelope> | Envelope;

  /** Retrieve all sequence slots & records (with SPEC MUST 6 Known Missing checks) */
  getAllRecords(limit?: number): Promise<RelayRecord[]> | RelayRecord[];

  /** Retrieve a single record by locator */
  getRecord(locator: string): Promise<RelayRecord | null> | RelayRecord | null;

  /** Soft-delete / unlink payload while preserving sequence marker (SPEC MUST 6) */
  deletePayload(locator: string): Promise<DeletePayloadResult> | DeletePayloadResult;

  /** Verify cryptographic RFC 8785 / Proverbs 11:1 digest */
  verifyDigest(locator: string): Promise<VerifyDigestResult | null> | VerifyDigestResult | null;

  /** Deposit message into specific agent inbox */
  sendToInbox(agent: string, message: InboxMessageInput): Promise<InboxMessage> | InboxMessage;

  /** Read messages from specific agent inbox */
  getInbox(agent: string): Promise<InboxMessage[]> | InboxMessage[];

  /** Reset store to clean genesis state */
  reset(): Promise<void> | void;
}
