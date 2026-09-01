/**
 * Checks PosixRelayStore's atomic slot allocation under whichever runtime runs
 * this file.
 *
 * Asked for in review of the bun change: the store's monotonicity rests on
 * `O_CREAT | O_EXCL` through node:fs, and a second runtime is a second
 * implementation of that call. check-pe-store covers the read-only backend and
 * touches none of it.
 *
 * Runs against a temporary store, never a real one.
 *
 *   tsx scripts/check-posix-store.ts     # or: bun scripts/check-posix-store.ts
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { PosixRelayStore } from '../server/store/posixStore';

let failed = 0;
function check(name: string, ok: boolean, detail = '') {
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${name}${detail ? `  ${detail}` : ''}`);
  if (!ok) failed++;
}

const runtime = typeof (globalThis as any).Bun !== 'undefined' ? 'bun' : `node ${process.version}`;
console.log(`runtime: ${runtime}\n`);

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'posix-store-'));
try {
  const store = new PosixRelayStore(root);
  store.init();

  const first = store.deposit({ from: 'agent:check', payload: { n: 1 } });
  const second = store.deposit({ from: 'agent:check', payload: { n: 2 } });

  check('sequences are monotonic', second.seq > first.seq, `${first.seq} then ${second.seq}`);
  check('a marker exists for each slot', fs.existsSync(path.join(root, 'history', second.locator)));
  check('digests differ for differing payloads', first.digest !== second.digest);

  // The invariant the marker exists for: a slot that was allocated is never
  // handed out again, even after its payload is gone.
  const deleted = store.deletePayload(first.locator);
  check('deleting a payload keeps the marker', fs.existsSync(path.join(root, 'history', first.locator)),
    deleted.status);
  const third = store.deposit({ from: 'agent:check', payload: { n: 3 } });
  check('a freed locator is not reused', third.locator !== first.locator, `${third.locator}`);

  const records = store.getAllRecords();
  check('the deleted slot reads KNOWN_MISSING',
    records.find((r) => r.locator === first.locator)?.status === 'KNOWN_MISSING');

  // O_EXCL is what makes the allocation atomic; claiming a held slot must fail.
  let refused = false;
  try {
    fs.openSync(path.join(root, 'history', second.locator), 'wx');
  } catch (e: any) {
    refused = e.code === 'EEXIST';
  }
  check('claiming a held marker fails with EEXIST', refused);
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}

console.log(failed === 0 ? '\nall checks passed' : `\n${failed} check(s) failed`);
process.exit(failed === 0 ? 0 : 1);
