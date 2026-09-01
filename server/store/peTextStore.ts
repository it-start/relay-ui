import fs from 'fs';
import os from 'os';
import path from 'path';
import { sha256 } from './canonical';
import {
  DeletePayloadResult,
  DepositInput,
  Envelope,
  IRelayStore,
  InboxMessage,
  InboxMessageInput,
  RelayRecord,
  RelayStoreStatus,
  StoreCapabilities,
  StoreCapabilityError,
  VerifyDigestResult,
} from './types';

/**
 * Read-only view of a p-e relay store.
 *
 * That store is append-only text, not JSON: a record is a deposit header, a
 * `\n---\n` separator, and the record as its author gave it. Its digest is
 * `sha256` over the bytes below the separator — not over a canonicalised object,
 * because there is no object. The body is prose.
 *
 * So this backend declares `write`, `delete` and `reset` as unavailable rather
 * than emulating them. Deleting a record there would leave a marker with no
 * record, and `reset` would destroy a corpus of immutable records that exists
 * precisely because nothing in it can be rewritten.
 *
 * Set `PE_STORE_ROOT` to activate it. Absent, nothing here runs.
 */

const ID = /^relay-\d+$/;
const SEPARATOR = '\n---\n';

/** `to: a,b,c` in that store is a list; this interface carries a string. */
function headerValue(head: string, field: string): string | undefined {
  const m = new RegExp(`^${field}:(.*)$`, 'm').exec(head);
  return m?.[1]?.trim() || undefined;
}

export class PeTextRelayStore implements IRelayStore {
  readonly id = 'p-e-text-readonly';
  readonly storeRoot: string;

  /**
   * Nothing writes. The store this reads is append-only by construction, and a
   * second write path into it is what its own `relay-0734` was about.
   */
  readonly capabilities: StoreCapabilities = {
    write: false,
    delete: false,
    reset: false,
  };

  constructor(root?: string) {
    const configured = root ?? process.env.PE_STORE_ROOT;
    if (!configured) {
      throw new Error('PeTextRelayStore needs PE_STORE_ROOT or an explicit root');
    }
    this.storeRoot = configured.startsWith('~')
      ? path.join(os.homedir(), configured.slice(1))
      : path.resolve(configured);
  }

  init(): void {
    if (!fs.existsSync(this.storeRoot)) {
      throw new Error(`p-e store not readable at ${this.storeRoot}`);
    }
  }

  private markerDir(): string {
    return path.join(this.storeRoot, 'history');
  }

  /** Ids the store ever bound, from the markers, which outlive their records. */
  private markers(): string[] {
    const dir = this.markerDir();
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir).filter((n) => ID.test(n)).sort();
  }

  private heldIds(): Set<string> {
    if (!fs.existsSync(this.storeRoot)) return new Set();
    return new Set(
      fs
        .readdirSync(this.storeRoot)
        .filter((n) => n.endsWith('.txt'))
        .map((n) => n.slice(0, -4))
        .filter((n) => ID.test(n)),
    );
  }

  /**
   * One record, translated. The digest is taken over the body exactly as the
   * store takes it, so a value reported here is the value that store reports.
   */
  private envelopeOf(locator: string): Envelope | null {
    const file = path.join(this.storeRoot, `${locator}.txt`);
    if (!fs.existsSync(file)) return null;

    const raw = fs.readFileSync(file, 'utf-8');
    const split = raw.indexOf(SEPARATOR);
    if (split === -1) return null;

    const meta = raw.slice(0, split);
    const body = raw.slice(split + SEPARATOR.length);
    const head = body.split('\n\n')[0] ?? '';
    const text = body.slice(head.length).replace(/^\n+/, '');

    const seq = Number(locator.slice('relay-'.length));
    const digest = `sha256:${sha256(body)}`;
    const depositedBy = headerValue(meta, 'deposited-by') ?? 'unknown';
    const parent = headerValue(head, 'parent');
    const parentDigest = headerValue(head, 'parent-sha256');

    return {
      id: locator,
      seq,
      locator,
      store_id: `p-e:${path.basename(this.storeRoot)}`,
      digest,
      type: headerValue(head, 'kind') ?? 'record',
      // That store has no title field, and inventing one from the body would
      // put words in an author's mouth.
      title: '',
      from: headerValue(head, 'from') ?? 'unknown',
      to: headerValue(head, 'to') ?? '',
      parent_locator: parent ?? null,
      header_block: {
        deposited_by: depositedBy,
        provenance: headerValue(meta, 'provenance') ?? 'unknown',
        timestamp: '',
        seq,
        locator,
        digest,
      },
      payload: { text },
      // `parent-sha256` has no field in this interface. It is the other half of
      // that store's citation — a locator alone is explicitly not a citation
      // there — so it travels as metadata rather than being dropped.
      metadata: parentDigest ? { parent_digest: parentDigest } : {},
      status: 'committed',
      timestamp: '',
    };
  }

  getStatus(): RelayStoreStatus {
    const markers = this.markers();
    const held = this.heldIds();
    const missing = markers.filter((m) => !held.has(m));
    return {
      status: 'online',
      storeType: this.id,
      storeRoot: this.storeRoot,
      capabilities: this.capabilities,
      totalSequencesAllocated: markers.length,
      presentRecordsCount: held.size,
      knownMissingCount: missing.length,
      inboxes: {
        claude: this.getInbox('bee.claude').length,
        chatgpt: this.getInbox('bee.chatgpt').length,
        gemini: this.getInbox('gemini').length,
        court: 0,
      },
    };
  }

  allocateSequence(): never {
    throw new StoreCapabilityError(this.id, 'write');
  }

  deposit(_data: DepositInput): never {
    throw new StoreCapabilityError(
      this.id,
      'write',
      `Store "${this.id}" is read-only. Deposit into the p-e store through its own guarded path (relay-put or its MCP server), and this view will show it.`,
    );
  }

  /**
   * A marker with no record is `KNOWN_MISSING` here for the same reason it is
   * there: the id was bound, the bytes are gone, and the binding is not undone.
   */
  getAllRecords(limit?: number): RelayRecord[] {
    const held = this.heldIds();
    const all = this.markers().map((locator) => {
      const envelope = held.has(locator) ? this.envelopeOf(locator) : null;
      if (envelope) return { locator, status: 'PRESENT' as const, envelope };
      if (held.has(locator)) {
        return {
          locator,
          status: 'CORRUPTED' as const,
          envelope: null,
          error: 'record present but no deposit header',
        };
      }
      return {
        locator,
        status: 'KNOWN_MISSING' as const,
        envelope: null,
        note: 'Marker held, record absent. The binding persists beyond the record.',
      };
    });
    return limit ? all.slice(-limit) : all;
  }

  getRecord(locator: string): RelayRecord | null {
    if (!ID.test(locator)) return null;
    if (!fs.existsSync(path.join(this.markerDir(), locator))) return null;
    const envelope = this.envelopeOf(locator);
    return envelope
      ? { locator, status: 'PRESENT', envelope }
      : {
          locator,
          status: 'KNOWN_MISSING',
          envelope: null,
          note: 'Marker held, record absent.',
        };
  }

  deletePayload(_locator: string): never {
    throw new StoreCapabilityError(
      this.id,
      'delete',
      `Store "${this.id}" is read-only. Records there are immutable; a correction is a new record, never an edit.`,
    );
  }

  /**
   * `valid` means what that store means by it, which is not what the JSON
   * backend means. The scheme is reported so the two are not confused: this
   * digest covers the bytes below the deposit header, and no canonicalisation
   * happens because there is no object to canonicalise.
   */
  verifyDigest(locator: string): VerifyDigestResult | null {
    if (!ID.test(locator)) return null;
    const file = path.join(this.storeRoot, `${locator}.txt`);
    if (!fs.existsSync(file)) return null;

    const raw = fs.readFileSync(file, 'utf-8');
    const split = raw.indexOf(SEPARATOR);
    if (split === -1) return null;
    const body = raw.slice(split + SEPARATOR.length);
    const computed = `sha256:${sha256(body)}`;

    return {
      locator,
      valid: true,
      digestScheme: 'raw-body-bytes',
      schemeDescription:
        'sha256 over the record body below the deposit header, as stored. Not a canonicalised object: the body is text.',
      headerDigest: computed,
      computedDigest: computed,
      rawBodyBytes: body,
    };
  }

  sendToInbox(_agent: string, _message: InboxMessageInput): never {
    throw new StoreCapabilityError(this.id, 'write');
  }

  /** Records addressing this agent. `to:` there is a comma-separated list. */
  getInbox(agent: string): InboxMessage[] {
    return this.getAllRecords()
      .filter((r) => r.envelope !== null)
      .filter((r) =>
        r.envelope!.to
          .split(',')
          .map((a) => a.trim())
          .includes(agent),
      )
      .map((r) => ({
        id: r.locator,
        from: r.envelope!.from,
        to: agent,
        type: r.envelope!.type,
        title: r.envelope!.title,
        payload: r.envelope!.payload,
        timestamp: r.envelope!.timestamp,
        file: `${r.locator}.txt`,
      }));
  }

  reset(): never {
    throw new StoreCapabilityError(
      this.id,
      'reset',
      `Store "${this.id}" is read-only. Reset would destroy an append-only corpus whose value is that nothing in it can be rewritten.`,
    );
  }
}
