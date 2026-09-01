/**
 * Checks PeTextRelayStore against a real p-e relay store.
 *
 * Not a unit test: this project has no test runner, and adding one is the
 * repository owner's decision rather than a side effect of adding a backend.
 * The assertions are the ones that matter for a read-only view of an
 * append-only store, and the last is the one that matters most — the corpus
 * must have exactly as many records after this runs as before.
 *
 *   PE_STORE_ROOT=~/projects/p-e/relay npx tsx scripts/check-pe-store.ts
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { PeTextRelayStore } from '../server/store/peTextStore';

const root = (process.env.PE_STORE_ROOT ?? '').replace(/^~/, os.homedir());
if (!root) {
  console.error('PE_STORE_ROOT is required, e.g. ~/projects/p-e/relay');
  process.exit(2);
}

let failed = 0;
function check(name: string, ok: boolean, detail = '') {
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${name}${detail ? `  ${detail}` : ''}`);
  if (!ok) failed++;
}

const countRecords = () =>
  fs.readdirSync(root).filter((n) => /^relay-\d+\.txt$/.test(n)).length;

const before = countRecords();
const store = new PeTextRelayStore(root);
store.init();

const status = store.getStatus();
check('declares itself read-only', !status.capabilities.write && !status.capabilities.delete && !status.capabilities.reset);
check('reports markers and records', status.totalSequencesAllocated > 0 && status.presentRecordsCount > 0,
  `${status.totalSequencesAllocated} markers, ${status.presentRecordsCount} records`);

const records = store.getAllRecords();
check('one entry per marker', records.length === status.totalSequencesAllocated);

const present = records.filter((r) => r.status === 'PRESENT');
const missing = records.filter((r) => r.status === 'KNOWN_MISSING');
check('a marker with no record reads KNOWN_MISSING', missing.length === status.knownMissingCount,
  `${missing.length} of ${records.length}`);

const sample = present[present.length - 1];
check('a record parses into an envelope', sample?.envelope !== null && sample.envelope!.from !== 'unknown',
  `${sample?.locator} from ${sample?.envelope?.from}`);
check('the body survives as payload text', (sample?.envelope?.payload.text ?? '').length > 0);

const verified = store.verifyDigest(sample.locator);
check('verifyDigest names its scheme', verified?.digestScheme === 'raw-body-bytes', verified?.digestScheme);
check('the digest matches what the store computes', verified?.headerDigest === sample.envelope!.digest);

// A citation there is a (locator, digest) pair. A record naming a parent with
// no digest is LABEL_ONLY, which is not a defect, so both shapes must survive.
const withParent = present.filter((r) => r.envelope!.parent_locator !== null);
const withDigest = withParent.filter((r) => (r.envelope!.metadata as any).parent_digest);
check('parent locators survive', withParent.length > 0, `${withParent.length} records`);
check('parent digests survive where present', withDigest.length > 0,
  `${withDigest.length} of ${withParent.length} carry one`);

for (const [name, fn] of [
  ['deposit', () => store.deposit({ from: 'check', payload: {} })],
  ['deletePayload', () => store.deletePayload(sample.locator)],
  ['reset', () => store.reset()],
] as const) {
  let refused = false;
  try { fn(); } catch (e: any) { refused = e.name === 'StoreCapabilityError'; }
  check(`${name} refuses with StoreCapabilityError`, refused);
}

const after = countRecords();
check('THE CORPUS IS UNCHANGED', before === after, `${before} -> ${after}`);

console.log(failed === 0 ? '\nall checks passed' : `\n${failed} check(s) failed`);
process.exit(failed === 0 ? 0 : 1);
