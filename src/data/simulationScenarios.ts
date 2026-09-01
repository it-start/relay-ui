import { AdjudicationCase, FailureModeSimulation } from '../types';

export const SIMULATION_CASES: AdjudicationCase[] = [
  {
    id: 'case_relay_0183',
    title: 'Case #0183: The Rebind & Deletion Paradox',
    summary: 'Agent Claude proposes freeing `relay-0183` upon record deletion to recycle sequence numbers. Agent ChatGPT challenges with the historical rebinding disaster, and Gemini applies SPEC MUST 1 & MUST 6.',
    criterionRef: 'SPEC.md#MUST-1 & MUST-6',
    criterionText: 'MUST 1: Each authority binds (authority_id, seq) uniquely, monotonically, and never reuses a seq. The marker persists beyond deletion of the record. MUST 6: Visibility state is exposed honestly; deletion keeps (authority, seq, digest) in ledger and answers KNOWN_MISSING.',
    initialClaim: {
      author: 'Agent Claude (CLI)',
      action: 'DELETE /history/relay-0183 -> unlink(marker) -> free seq for new deposit',
      rawPayload: {
        targetId: 'relay-0183',
        action: 'unlink_both_marker_and_payload',
        recycleSeq: true,
        rationale: 'Save disk inodes on local filesystem'
      },
      digest: '7a9f8b2c41de03f69123aa4e7195c82bd260811e55041a4a11b0e998722c191a'
    },
    steps: [
      {
        phase: 'claim',
        title: 'Initial Deposit & Deletion Proposal',
        agent: {
          id: 'claude',
          name: 'Claude Code (CLI)',
          avatar: '⚡',
          role: 'author',
          flavor: 'Anthropic Opus / Sonnet Engine',
          color: 'amber'
        },
        description: 'Claude proposes to clean up both the payload file and the allocation marker `history/relay-0183` to reclaim disk space, claiming `held.has(proposedId) === false` is sufficient for safety.',
        payload: {
          code: 'await fs.unlink("history/relay-0183"); held.delete(183);',
          claimedSafety: 'True (id is no longer held)'
        },
        outputLog: '[CLAIM_SUBMITTED] Target id=183. Proposed unbinding and marker unlink. Waiting for weighing & adversarial cross-examination.',
        timestamp: '10:14:02.102'
      },
      {
        phase: 'weighing',
        title: 'Canonical Normalization & Weighing',
        agent: {
          id: 'canonicalizer',
          name: 'Canonicalizer (The Just Scales)',
          avatar: '⚖️',
          role: 'witness',
          flavor: 'Proverbs 11:1 Deterministic Engine',
          color: 'blue'
        },
        description: 'The raw JSON payload is stripped of transient formatting, keys sorted alphabetically, and hashed to produce an immutable subject digest `sha256(canonical(bytes))`.',
        biblicalPrinciple: 'Proverbs 11:1 - A just weight is his delight',
        scriptureRef: 'Prov 11:1',
        payload: {
          normalizedKeys: ['action', 'rationale', 'recycleSeq', 'targetId'],
          canonicalBytes: '{"action":"unlink_both_marker_and_payload","rationale":"Save disk inodes on local filesystem","recycleSeq":true,"targetId":"relay-0183"}',
          calculatedDigest: '7a9f8b2c41de03f69123aa4e7195c82bd260811e55041a4a11b0e998722c191a'
        },
        outputLog: '[SCALES_CALIBRATED] Canonical SHA-256 digest generated: 7a9f8b... Scale verified without denominator drift.',
        timestamp: '10:14:02.340'
      },
      {
        phase: 'challenge',
        title: 'Adversarial Counter-Case (Cross-Examination)',
        agent: {
          id: 'chatgpt',
          name: 'ChatGPT (Web Challenger)',
          avatar: '🛡️',
          role: 'challenger',
          flavor: 'OpenAI GPT-4o Adversarial Reviewer',
          color: 'emerald'
        },
        description: 'ChatGPT cross-examines the claim, invoking Proverbs 18:17: "The first seems right until the other cross-examines". Proves that if reader A witnessed `relay-0183` as document α, and after deletion new writer deposits document β into `relay-0183`, reader A\'s citations become corrupted (historical incident relay-0183 second occupant).',
        biblicalPrinciple: 'Proverbs 18:17 - One states his case first until another comes and examines him',
        scriptureRef: 'Prov 18:17',
        verdict: 'VIOLATES',
        payload: {
          falsificationProof: 'Falsification Attack Vector: Citation rebinding anomaly',
          victimReader: 'Reader_04 (saw digest d1="alpha")',
          afterState: 'Reader_09 (sees digest d2="beta" at same relay-0183)',
          violation: 'Broken Monotonicity of `bound` capability'
        },
        outputLog: '[COUNTERCASE_FILED] Found critical rebind vulnerability! Reusing 183 violates G1 invariant. Finding: VIOLATES.',
        timestamp: '10:14:02.780'
      },
      {
        phase: 'criterion_check',
        title: 'Evaluation against Pre-Declared Criterion',
        agent: {
          id: 'gemini',
          name: 'Gemini (Criterion Guard & Judge)',
          avatar: '💎',
          role: 'criterion_guard',
          flavor: 'Google DeepMind Invariant Verifier',
          color: 'purple'
        },
        description: 'Gemini compares the finding against SPEC MUST 1 and MUST 6. Genesis 18 pattern: checking against the pre-established law rather than subjective consensus.',
        biblicalPrinciple: 'Genesis 18:20-33 - Examination under explicit justice threshold',
        scriptureRef: 'Gen 18:25',
        verdict: 'VIOLATES',
        payload: {
          evaluatedAgainst: 'SPEC.md Lines 151-163 (MUST 1) & 181-186 (MUST 6)',
          must1Check: 'FAIL: Marker must persist beyond deletion of the record',
          must6Check: 'FAIL: Deleted payload must answer KNOWN_MISSING, ledger retains binding',
          remedyRequired: 'Keep empty marker file history/relay-0183 forever with O_EXCL'
        },
        outputLog: '[CRITERION_APPLIED] Finding matches SPEC violation. Proposal rejected under MUST 1 rule: deleted id is NOT freed.',
        timestamp: '10:14:03.110'
      },
      {
        phase: 'ruling',
        title: 'Binding Invariant Ruling & Commit',
        agent: {
          id: 'adjudicator',
          name: 'Court of Agents (Adjudicator Log)',
          avatar: '📜',
          role: 'arbitrator',
          flavor: 'Immutable Append-Only Authority',
          color: 'indigo'
        },
        description: 'The court renders a definitive, non-rewindable ruling. The proposal is rejected. The conforming fix is applied: marker is preserved, ledger responds with `KNOWN_MISSING`.',
        payload: {
          decision: 'REJECT_WITH_PRESCRIBED_FIX',
          conformingCode: 'await fs.unlink("records/relay-0183.dat"); // Do NOT unlink history/relay-0183 marker!',
          statusResponse: 'KNOWN_MISSING',
          ledgerIntact: true
        },
        outputLog: '[RULING_RECORDED] Case #0183 closed. Invariant G1 preserved. Ruling committed to immutable ledger.',
        timestamp: '10:14:03.550'
      }
    ],
    finalRuling: {
      status: 'COMMITTED',
      rulingText: 'REJECTED proposal to delete marker. Conforming state enforced: empty marker history/relay-0183 remains permanently; payload reads KNOWN_MISSING; G1 monotone binding preserved.',
      ledgerSeq: 183,
      witnessCount: 3,
      digest: '7a9f8b2c41de03f69123aa4e7195c82bd260811e55041a4a11b0e998722c191a'
    }
  },
  {
    id: 'case_race_condition',
    title: 'Case #0225: The 16 Racing Writers (max+1 vs wx/O_EXCL)',
    summary: 'A fast-path optimization claims that in-memory `max(ids)+1` is safe when checked before write. A 16-writer stress test causes twin allocation collision. The court enforces atomic POSIX markers.',
    criterionRef: 'SPEC.md#MUST-1 & Capsule 04',
    criterionText: 'MUST 1: Allocation MUST be settled by an atomic exclusive commit, never by reading the current maximum — max+1 cannot be made safe by care, and an exclusive create already is.',
    initialClaim: {
      author: 'Legacy Worker (Local)',
      action: 'nextFree() = max(present) + 1 -> write(relay-NNNN)',
      rawPayload: {
        strategy: 'max_plus_one',
        writersCount: 16,
        concurrencyModel: 'optimistic_read_then_write'
      },
      digest: '9e41a87b1c3e4492b1a87ff43e9011ba24f8d551e2239aa812fec9001b9a2233'
    },
    steps: [
      {
        phase: 'claim',
        title: 'Optimistic max+1 Allocation Strategy',
        agent: {
          id: 'legacy_worker',
          name: 'Legacy Worker (Local)',
          avatar: '⚙️',
          role: 'author',
          flavor: 'Legacy relay daemon',
          color: 'slate'
        },
        description: 'Author claims reading directory max ID + 1 is 3x faster than testing file markers on disk.',
        payload: {
          code: 'const nextId = Math.max(...existingIds) + 1; await write(`relay-${nextId}`);',
          justification: 'Lower disk I/O in single-authority mode'
        },
        outputLog: '[CLAIM_SUBMITTED] Optimization claim filed. Fast-path max+1 allocation.',
        timestamp: '11:02:10.010'
      },
      {
        phase: 'weighing',
        title: 'Deterministic Weighing of Proposed Code',
        agent: {
          id: 'canonicalizer',
          name: 'Canonicalizer (The Just Scales)',
          avatar: '⚖️',
          role: 'witness',
          flavor: 'Proverbs 11:1 Engine',
          color: 'blue'
        },
        description: 'Code payload canonicalized into standard AST representation.',
        payload: {
          strategyHash: '9e41a87b1c3e4492b1a87ff43e9011ba24f8d551e2239aa812fec9001b9a2233'
        },
        outputLog: '[SCALES_CALIBRATED] AST normalized and digest locked.',
        timestamp: '11:02:10.150'
      },
      {
        phase: 'challenge',
        title: 'Fuzzing Counter-Case (Capsule 04 Simulation)',
        agent: {
          id: 'chatgpt',
          name: 'ChatGPT (Adversarial Tester)',
          avatar: '🛡️',
          role: 'challenger',
          flavor: 'High-Concurrency Fuzzing Engine',
          color: 'emerald'
        },
        description: 'Challenger spawns 16 concurrent simulated threads on `max+1`. Result: 2 threads read max=224 at the exact same millisecond, both claiming `relay-0225`! Historical reproduction of incident relay-0225/0232.',
        verdict: 'VIOLATES',
        payload: {
          racingThreads: 16,
          collisionCount: 2,
          conflictedId: 'relay-0225',
          historicalIncidentRef: 'relay-0225 collided with relay-0232 within 2 hours'
        },
        outputLog: '[COUNTERCASE_FILED] Falsification verified! 2 concurrent writers claimed relay-0225 simultaneously. Finding: VIOLATES.',
        timestamp: '11:02:10.890'
      },
      {
        phase: 'criterion_check',
        title: 'SPEC MUST 1 Invariant Enforcement',
        agent: {
          id: 'gemini',
          name: 'Gemini (Criterion Guard)',
          avatar: '💎',
          role: 'criterion_guard',
          flavor: 'Invariant Verifier',
          color: 'purple'
        },
        description: 'Checks against MUST 1: "max+1 cannot be made safe by care, and an exclusive create already is". Enforces `wx`/`O_EXCL` empty marker files.',
        verdict: 'VIOLATES',
        payload: {
          prescribedMechanism: 'Empty file history/relay-NNNN created with O_EXCL/wx',
          resultUnderWx: '16 racing writers -> 16 distinct ids, 0 duplicates'
        },
        outputLog: '[CRITERION_APPLIED] Non-atomic max+1 explicitly forbidden by MUST 1.',
        timestamp: '11:02:11.200'
      },
      {
        phase: 'ruling',
        title: 'Mandatory Adoption of wx/O_EXCL Markers',
        agent: {
          id: 'adjudicator',
          name: 'Court of Agents (Adjudicator)',
          avatar: '📜',
          role: 'arbitrator',
          flavor: 'Protocol Authority',
          color: 'indigo'
        },
        description: 'All writers must acquire `history/relay-NNNN` via exclusive atomic filesystem creation before writing any payload bytes.',
        payload: {
          decision: 'ENFORCE_ATOMIC_MARKERS',
          guarantee: 'G1 Safe under any concurrent POSIX processes'
        },
        outputLog: '[RULING_RECORDED] Atomic wx markers confirmed as sole compliant allocation engine.',
        timestamp: '11:02:11.500'
      }
    ],
    finalRuling: {
      status: 'COMMITTED',
      rulingText: 'ENFORCED: max+1 banned; allocation exclusively governed by O_EXCL empty marker acquisition (Capsule 04 verified 16/16 unique).',
      ledgerSeq: 225,
      witnessCount: 4,
      digest: '9e41a87b1c3e4492b1a87ff43e9011ba24f8d551e2239aa812fec9001b9a2233'
    }
  },
  {
    id: 'case_the_lot_tiebreak',
    title: 'Case #0354: The 50/50 Deadlock & The Lot (VRF)',
    summary: 'Claude Code and ChatGPT agree on all safety guarantees for cross-store import wrappers, but have a 50/50 irreconcilable disagreement on metadata key naming (`source_store:` vs `origin_authority:`). The court invokes The Lot (Proverbs 18:18).',
    criterionRef: 'Proverbs 18:18 & 16:33 (The Lot Arbitration Protocol)',
    criterionText: 'The lot puts an end to quarrels and decides between powerful contenders. When both candidates satisfy all safety invariants and consensus deadlocks, authority is transferred to the deterministic VRF lot.',
    initialClaim: {
      author: 'Claude Code vs ChatGPT',
      action: 'Deadlock on non-safety styling parameter for import envelope wrapper',
      rawPayload: {
        candidateA: { name: 'Claude Proposition', key: 'source_store', format: 'uri' },
        candidateB: { name: 'ChatGPT Proposition', key: 'origin_authority', format: 'urn' }
      },
      digest: 'c4f2e981ba0034a179ee4120891d4e0824bba7112049e390cfae881249b019ee'
    },
    steps: [
      {
        phase: 'claim',
        title: 'Peer Impasse on Envelope Naming',
        agent: {
          id: 'claude',
          name: 'Claude Code',
          avatar: '⚡',
          role: 'author',
          flavor: 'Advocate for candidate A',
          color: 'amber'
        },
        description: 'Both candidates A (`source_store`) and B (`origin_authority`) satisfy all SPEC MUST requirements (3-tuple isolation, no id collisions). Discussion has looped for 4 rounds without convergence.',
        payload: {
          candidateA: 'source_store',
          candidateB: 'origin_authority',
          deadlockRounds: 4
        },
        outputLog: '[IMPASSE_DETECTED] 50/50 split-brain on non-functional naming preference.',
        timestamp: '14:20:01.000'
      },
      {
        phase: 'weighing',
        title: 'Equivalence Proof Verification',
        agent: {
          id: 'canonicalizer',
          name: 'Canonicalizer',
          avatar: '⚖️',
          role: 'witness',
          flavor: 'Invariant Verification',
          color: 'blue'
        },
        description: 'Both options verified to produce identical security properties under MUST 5 (Cross-store isolation).',
        verdict: 'PASS',
        payload: {
          candidateASafety: '100% compliant',
          candidateBSafety: '100% compliant'
        },
        outputLog: '[SCALES_CALIBRATED] Both candidates are mathematically valid. Impasse is purely stylistic.',
        timestamp: '14:20:01.210'
      },
      {
        phase: 'challenge',
        title: 'Self-Assessment Rejection',
        agent: {
          id: 'chatgpt',
          name: 'ChatGPT',
          avatar: '🛡️',
          role: 'challenger',
          flavor: 'Epistemic Humility Agent',
          color: 'emerald'
        },
        description: 'Acknowledges Proverbs 21:2: "A man\'s way seems right in his own eyes". Neither agent has higher inherent authority to force its preference on the other.',
        biblicalPrinciple: 'Proverbs 28:26 & 21:2',
        scriptureRef: 'Prov 21:2',
        verdict: 'UNDECIDABLE',
        payload: {
          reason: 'Subjective preference cannot dictate protocol canon'
        },
        outputLog: '[HUMILITY_ACKNOWLEDGED] Neither agent can unilaterally decree truth. Invoking Lot mechanism.',
        timestamp: '14:20:01.550'
      },
      {
        phase: 'arbitration',
        title: 'The Lot / VRF Casting',
        agent: {
          id: 'the_lot',
          name: 'The Lot (VRF Arbiter)',
          avatar: '🎲',
          role: 'arbitrator',
          flavor: 'Proverbs 18:18 Deterministic Arbiter',
          color: 'rose'
        },
        description: 'The Lot is cast: `sha256("LOT_SEED_0354" + caseDigest) % 2`. Decision authority is alienated from the subjective disputants to the immutable cryptographic procedure.',
        biblicalPrinciple: 'Proverbs 16:33 & 18:18 - The lot puts an end to quarrels',
        scriptureRef: 'Prov 18:18',
        payload: {
          candidates: ['source_store (Claude)', 'origin_authority (ChatGPT)'],
          seed: 'LOT_SEED_0354',
          caseDigest: 'c4f2e981ba0034a179ee4120891d4e0824bba7112049e390cfae881249b019ee',
          calculatedModulo: 0,
          chosenWinner: 'source_store (Claude)',
          lotProof: 'lot:8f2a1b9c03de45fa'
        },
        outputLog: '[LOT_CAST] VRF modulo selected Index 0: `source_store`. All agents submit to the immutable verdict.',
        timestamp: '14:20:01.900'
      },
      {
        phase: 'ruling',
        title: 'Final Uncontested Commit',
        agent: {
          id: 'adjudicator',
          name: 'Court of Agents',
          avatar: '📜',
          role: 'arbitrator',
          flavor: 'Consensus Engine',
          color: 'indigo'
        },
        description: 'The deadlock is dissolved immediately without rancor or infinite bikeshedding. `source_store` committed as official envelope field name.',
        payload: {
          adoptedKey: 'source_store',
          status: 'SETTLED_BY_LOT'
        },
        outputLog: '[RULING_RECORDED] Deadlock broken via The Lot. Consensus 100% reached.',
        timestamp: '14:20:02.150'
      }
    ],
    finalRuling: {
      status: 'ARBITRATED',
      rulingText: 'SETTLED BY THE LOT: `source_store` selected deterministically via Proverbs 18:18 VRF. Both agents accepted without recursive dispute.',
      ledgerSeq: 354,
      witnessCount: 4,
      digest: 'c4f2e981ba0034a179ee4120891d4e0824bba7112049e390cfae881249b019ee'
    }
  }
];

export const FAILURE_SIMULATIONS: FailureModeSimulation[] = [
  {
    id: 'fail_rebind',
    name: 'Id Rebinding after Deletion (relay-0183)',
    specClause: 'SPEC MUST 1 & MUST 6',
    description: 'A record is deleted, and its integer sequence number is recycled for a new deposit.',
    historicalIncident: 'relay-0183 held two completely different documents across time, corrupting historical citations.',
    naiveBehavior: 'Store removes file and marks index as available: held.delete(id). Next insert takes id.',
    v1ConformingBehavior: 'Empty file marker history/relay-NNNN is permanent. Delete only unlinks records/relay-NNNN.dat. Id is never rebound.',
    guaranteeAffected: 'G1'
  },
  {
    id: 'fail_crash_commit',
    name: 'Crash between Ledger and Payload',
    specClause: 'SPEC MUST 6 & MUST 8',
    description: 'Power fails after the ledger sequence allocation marker is committed, but before payload bytes are flushed to disk.',
    historicalIncident: 'audit-03 F1 / Gemini observation on orphaned IDs.',
    naiveBehavior: 'Client throws 500 error or treats missing bytes as UNKNOWN.',
    v1ConformingBehavior: 'State is exposed honestly as KNOWN_MISSING (the binding is valid, bytes unreachable), preserving ledger integrity.',
    guaranteeAffected: 'G2a'
  },
  {
    id: 'fail_rename_overwrite',
    name: 'Silent Overwrite via Atomic rename()',
    specClause: 'SPEC MUST 8 (Crash-atomic AND Create-or-Fail)',
    description: 'Implementer uses POSIX rename() thinking "atomic" solves concurrency, but rename silently replaces existing files.',
    historicalIncident: 'relay-0407 measured silent re-opening of rebinding vulnerability.',
    naiveBehavior: 'fs.renameSync(tempFile, targetFile) clobbers existing file silently.',
    v1ConformingBehavior: 'Two-stage write: wx/O_EXCL marker claim first, then write with O_EXCL. rename() without O_EXCL is banned.',
    guaranteeAffected: 'G1'
  },
  {
    id: 'fail_cross_store_bare_cite',
    name: 'Bare Locator Cross-Store Citation',
    specClause: 'SPEC Citing a Record (Chatgpt relay-0354)',
    description: 'A message references `relay-0042` from a foreign authority without specifying the store identity and content digest.',
    historicalIncident: 'OBS-063: Colliding local IDs in merged multi-agent streams.',
    naiveBehavior: 'Citing bare relay-0042 resolves to local store\'s 42 instead of foreign store.',
    v1ConformingBehavior: 'Cross-store citations MUST be the 3-tuple (store_id, locator, content_digest).',
    guaranteeAffected: 'None'
  }
];
