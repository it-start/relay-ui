/**
 * Checks the append-only attestation log.
 *
 * Not a unit test: this project has no test runner, and adding one is the
 * repository owner's decision. The assertions are the ones that matter for a
 * log whose entire purpose is to be honest about what it cannot know.
 *
 *   npx tsx scripts/check-attest-log.ts
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { AttestationLog } from '../server/attest/log';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'attest-check-'));
const log = new AttestationLog(dir);
log.init();

let failed = 0;
function check(name: string, ok: boolean, detail = '') {
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${name}${detail ? `  ${detail}` : ''}`);
  if (!ok) failed++;
}

check('starts empty', log.all().length === 0);

const proposal = log.append({ kind: 'proposal', text: 'roll forward', via: 'webmcp-tool' }, 'https://relay.zae.life');
check('first act has no parent', proposal.prev_digest === null);
check('tool path names one hand', proposal.distinguishes_hands === true);
check('records that the page asserted it', proposal.attested_by === 'page');
check('records that the browser attests nothing', proposal.browser_attestation === 'unavailable');
check('keeps the checked origin', proposal.origin === 'https://relay.zae.life');

const approval = log.append({ kind: 'approval', target: proposal.id, via: 'ui-trusted' }, null);
check('chains to the previous act', approval.prev_digest === proposal.digest);
check('sequence advances by one', approval.seq === proposal.seq + 1);

// The load-bearing assertion. A trusted input event is the human OR an agent
// driving the browser, and the log must refuse to collapse that into a person.
check('a trusted UI event does NOT name a hand', approval.distinguishes_hands === false);
check('and says why in the record', /no party can tell/.test(approval.basis), approval.basis);

const synthetic = log.append({ kind: 'note', text: 'scripted', via: 'ui-synthetic' }, null);
check('a scripted click is detectably not a human', synthetic.distinguishes_hands === true);

// Added after the live deployment took `via: webmcp-tool` from curl, because the
// three browser-shaped values left no honest one for a request with no page
// behind it. It must never name a hand.
const direct = log.append({ kind: 'note', text: 'from a script', via: 'direct-http' }, 'https://relay.zae.life');
check('a request with no page names no hand', direct.distinguishes_hands === false);
check('and says the server has only the origin', /origin and nothing else/.test(direct.basis), direct.basis);

let rejected = false;
try {
  log.append({ kind: 'note', text: 'x', via: 'human' as any }, null);
} catch {
  rejected = true;
}
check('an unknown via is refused rather than defaulted', rejected);

check('chain verifies', log.verify().length === 0);

// Tamper with a committed line: the log is append-only, so an edit must show.
const file = path.join(dir, 'acts.jsonl');
const lines = fs.readFileSync(file, 'utf8').trim().split('\n');
const tampered = JSON.parse(lines[1]);
tampered.via = 'webmcp-tool';
tampered.distinguishes_hands = true;
lines[1] = JSON.stringify(tampered);
fs.writeFileSync(file, `${lines.join('\n')}\n`);

const problems = new AttestationLog(dir).verify();
check(
  'rewriting an unknown hand into an agent is caught',
  problems.some((p) => p.id === tampered.id && /digest/.test(p.problem)),
  problems.map((p) => `${p.id}: ${p.problem}`).join('; ')
);

fs.rmSync(dir, { recursive: true, force: true });
console.log(failed === 0 ? '\nall checks passed' : `\n${failed} check(s) failed`);
process.exit(failed === 0 ? 0 : 1);
