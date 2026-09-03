/**
 * Append-only attestation log for the WebMCP surface.
 *
 * Separate from the relay store on purpose. `PeTextRelayStore` is read-only —
 * the p-e corpus is append-only and is written through its own guarded path —
 * so a demonstration that needs writes gets its own log rather than a new hole
 * in that one.
 *
 * What this log exists to record is not the act. It is HOW THE ACT REACHED THE
 * PAGE, which is the thing WebMCP does not preserve and cannot currently be
 * recovered afterwards.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { canonicalJson, sha256 } from '../store/canonical';

/**
 * The three ways a write reaches an agent-native page.
 *
 * EVERY VALUE HERE IS THE PAGE'S WORD. `relay-mimo` broke the stronger claim
 * this started from — that page script cannot enter the `execute()` path — and
 * the refutation is one line: `registerTool({ execute })` registers a callback
 * the page itself authored, so the page retains a reference and can call it
 * directly. `via: webmcp-tool` is therefore forgeable BY THE PAGE, though not
 * by the agent. That correction is why this file records a basis for each value
 * instead of a verdict.
 *
 * `webmcp-tool`   The page reports that `document.modelContext` dispatched it.
 *                 An agent cannot produce this value; the page can.
 *
 * `ui-synthetic`  A UI activation whose event reported `isTrusted === false` —
 *                 `element.click()` or a dispatched event. The only signal in
 *                 this list a page can actually check rather than assert.
 *                 Nothing in the WebMCP spec reads it; the DOM offers it anyway.
 *
 * `ui-trusted`    A UI activation whose event reported `isTrusted === true`.
 *                 A real input event: the human, OR an agent driving the browser
 *                 through automation, which injects input at a level that
 *                 produces trusted events indistinguishable from a person's.
 *
 *                 NO PARTY CAN TELL THESE APART — not the page, not this server,
 *                 not the agent's host. This is webmcp#288: "nothing in the
 *                 page's view of the event distinguishes the agent's activation
 *                 from the user's." We do not close it. We refuse to record it
 *                 as the human.
 *
 * What would make any of this attestable, in `relay-mimo`'s words: the browser's
 * dispatch would have to stamp the execution context with "a token the page
 * cannot forge and the agent cannot produce." That is absent from the spec, and
 * naming its absence is the whole contribution.
 */
export type Via = 'webmcp-tool' | 'ui-synthetic' | 'ui-trusted';

export const VIA_VALUES: readonly Via[] = ['webmcp-tool', 'ui-synthetic', 'ui-trusted'];

/**
 * Whether the value, taken at face value, names one hand rather than two.
 * `ui-trusted` names two and cannot be narrowed, which is the finding.
 */
export const DISTINGUISHES_HANDS: Record<Via, boolean> = {
  'webmcp-tool': true,
  'ui-synthetic': true,
  'ui-trusted': false,
};

/** What each value rests on, carried into the record so a reader need not trust this file. */
export const BASIS: Record<Via, string> = {
  'webmcp-tool':
    "the page's report of its own dispatch path; an agent cannot produce it, any script in this origin can",
  'ui-synthetic':
    'Event.isTrusted === false; the only checkable signal here, and checkable only by the page',
  'ui-trusted':
    'Event.isTrusted === true; the human or an automation agent, and no party can tell which',
};

export type ActKind = 'note' | 'proposal' | 'approval';

export interface AttestActInput {
  kind: ActKind;
  /** Free text for a note; the proposal's text for a proposal. */
  text?: string;
  /** For an approval: the `id` of the proposal being approved. */
  target?: string;
  /** What the PAGE reports about how this act reached it. Never verified here. */
  via: Via;
  /** The agent's self-reported name, when one is offered. Self-reported. */
  agent_hint?: string;
}

export interface AttestAct {
  seq: number;
  id: string;
  ts: string;
  kind: ActKind;
  text: string | null;
  target: string | null;
  via: Via;
  /** False only for `ui-trusted`, and that is the whole point of the log. */
  distinguishes_hands: boolean;
  /** Why that boolean has the value it has, in the record rather than in a doc. */
  basis: string;
  agent_hint: string | null;
  /**
   * Who asserted `via`, and it is never this server. The page can see which
   * path an act arrived on; the server receives an ordinary HTTP request and
   * can check only where it came from. Recording the limit rather than
   * implying a verification we did not perform.
   */
  attested_by: 'page';
  /**
   * Absent from WebMCP, and the reason nothing above is stronger than a claim:
   * relay-mimo's fix is a browser-stamped execution context the page cannot
   * forge and the agent cannot produce.
   */
  browser_attestation: 'unavailable';
  /** Checked by the server, unlike everything above it. */
  origin: string | null;
  prev_digest: string | null;
  digest: string;
}

const DEFAULT_DIR = path.join(process.cwd(), '.attest');

function resolveDir(): string {
  const configured = process.env.ATTEST_LOG_ROOT;
  if (!configured) return DEFAULT_DIR;
  return configured.replace(/^~(?=$|\/)/, os.homedir());
}

export class AttestationLog {
  readonly dir: string;
  readonly file: string;

  constructor(dir = resolveDir()) {
    this.dir = dir;
    this.file = path.join(dir, 'acts.jsonl');
  }

  init(): void {
    fs.mkdirSync(this.dir, { recursive: true });
    if (!fs.existsSync(this.file)) fs.writeFileSync(this.file, '', 'utf8');
  }

  /**
   * A line that will not parse is surfaced, not skipped. A log that silently
   * drops what it cannot read reports a clean history it does not have.
   */
  all(): AttestAct[] {
    if (!fs.existsSync(this.file)) return [];
    const out: AttestAct[] = [];
    const lines = fs.readFileSync(this.file, 'utf8').split('\n');
    for (const line of lines) {
      if (!line.trim()) continue;
      out.push(JSON.parse(line) as AttestAct);
    }
    return out;
  }

  last(): AttestAct | null {
    const all = this.all();
    return all.length ? all[all.length - 1] : null;
  }

  append(input: AttestActInput, origin: string | null): AttestAct {
    if (!VIA_VALUES.includes(input.via)) {
      throw new Error(`via must be one of ${VIA_VALUES.join(', ')}`);
    }
    const prev = this.last();
    const body = {
      seq: (prev?.seq ?? 0) + 1,
      id: `act-${String((prev?.seq ?? 0) + 1).padStart(4, '0')}`,
      ts: new Date().toISOString(),
      kind: input.kind,
      text: input.text ?? null,
      target: input.target ?? null,
      via: input.via,
      distinguishes_hands: DISTINGUISHES_HANDS[input.via],
      basis: BASIS[input.via],
      agent_hint: input.agent_hint ?? null,
      attested_by: 'page' as const,
      browser_attestation: 'unavailable' as const,
      origin,
      prev_digest: prev?.digest ?? null,
    };
    const act: AttestAct = { ...body, digest: sha256(canonicalJson(body)) };
    // Append, never rewrite. The failure this log is about is a record that
    // says the wrong hand acted; a log that can be edited cannot report it.
    fs.appendFileSync(this.file, `${JSON.stringify(act)}\n`, 'utf8');
    return act;
  }

  /** Recomputes every digest and every link. Returns the breaks, not a boolean. */
  verify(): { seq: number; id: string; problem: string }[] {
    const problems: { seq: number; id: string; problem: string }[] = [];
    let prevDigest: string | null = null;
    let expectedSeq = 1;
    for (const act of this.all()) {
      const { digest, ...body } = act;
      if (sha256(canonicalJson(body)) !== digest) {
        problems.push({ seq: act.seq, id: act.id, problem: 'digest does not match body' });
      }
      if (act.prev_digest !== prevDigest) {
        problems.push({ seq: act.seq, id: act.id, problem: 'prev_digest does not match the previous act' });
      }
      if (act.seq !== expectedSeq) {
        problems.push({ seq: act.seq, id: act.id, problem: `sequence jumped; expected ${expectedSeq}` });
      }
      prevDigest = digest;
      expectedSeq = act.seq + 1;
    }
    return problems;
  }
}

let active: AttestationLog | null = null;

export function getAttestationLog(): AttestationLog {
  if (!active) {
    active = new AttestationLog();
    active.init();
  }
  return active;
}
