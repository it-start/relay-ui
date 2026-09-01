import { RosettaPrinciple } from '../types';

export const ROSETTA_PRINCIPLES: RosettaPrinciple[] = [
  {
    id: 'just_scales',
    title: 'Just Scales & Balance',
    source: 'Proverbs 11:1, 16:11',
    quote: 'A false balance is an abomination to the LORD, but a just weight is his delight. A just balance and scales are the LORD\'s.',
    problemInAI: 'The Denominator / Boundary Drift (K1/K2): Different models or evaluators compute SHA-256 over slightly different byte slices (e.g. whitespace, key order, headers), leading to fake disputes.',
    protocolPrimitive: 'Canonical Hashing: sha256(canonical_json(payload)) with deterministic key sorting and normalized line endings before any signature or witness attestation.',
    codeSnippet: `// The "Just Scales" canonicalizer
export function canonicalJson(obj: any): string {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(canonicalJson).join(',') + ']';
  const keys = Object.keys(obj).sort();
  return '{' + keys.map(k => \`"\${k}":\${canonicalJson(obj[k])}\`).join(',') + '}';
}`,
    interactiveType: 'canonicalizer'
  },
  {
    id: 'cross_examination',
    title: 'Adversarial Cross-Examination',
    source: 'Proverbs 18:17',
    quote: 'The one who states his case first seems right, until the other comes and cross-examines him.',
    problemInAI: 'Confirmation Bias & Sycophancy: The primary model confidently asserts a solution or state transition; subsequent prompts or single-agent loops blindly trust the first output.',
    protocolPrimitive: 'Mandatory Countercase Phase: No Claim transitions directly to a Ruling without a dedicated Adversarial Challenger agent with a skeptic system instruction searching for counterexamples.',
    codeSnippet: `// Enforce independent cross-examination before state commit
async function adjudicateClaim(claim: Claim, challenger: Agent): Promise<Finding> {
  const counterCase = await challenger.findCounterExample(claim.payload);
  if (counterCase.hasFalsification) {
    return { verdict: 'VIOLATES', evidence: counterCase.proof };
  }
  return { verdict: 'PASS', evidence: 'Countercase search exhausted without contradiction' };
}`,
    interactiveType: 'cross_examination'
  },
  {
    id: 'role_separation',
    title: 'Separation of Author, Witness & Judge',
    source: 'Proverbs 28:26, 21:2',
    quote: 'Whoever trusts in his own mind is a fool... Every way of a man is right in his own eyes, but the LORD weighs the heart.',
    problemInAI: 'Self-Assessment Fallacy: An agent cannot objectively judge the correctness of its own output, as hallucinations inherit the authoring model\'s blind spots.',
    protocolPrimitive: 'Strict Role Invariant: Author != Witness != Criterion Guard. The authoring agent deposits raw bytes; witnesses attest sighting; a separate judge applies the invariant contract.',
    codeSnippet: `// Protocol enforces that author cannot be the sole evaluator
function validateAdjudicationQuorum(author: string, witness: string, judge: string): boolean {
  const uniqueParticipants = new Set([author, witness, judge]);
  if (uniqueParticipants.size < 3) {
    throw new Error("Byzantine Fault: Author, Witness, and Judge must be distinct entities");
  }
  return true;
}`,
    interactiveType: 'role_separation'
  },
  {
    id: 'pre_declared_criterion',
    title: 'Pre-Declared Criterion Threshold',
    source: 'Genesis 18:20-33',
    quote: 'I will go down to see whether they have done altogether according to the outcry... If I find at Sodom fifty righteous... then forty-five... then ten...',
    problemInAI: 'Moving Goalposts & Arbitrary Adjudication: Evaluating agents invent scoring criteria post-hoc based on the output they received rather than invariant specifications.',
    protocolPrimitive: 'Pre-Established Invariant Rule: The validation rule (e.g. MUST 1 atomic create, MUST 6 honest visibility) is frozen before the trial. Findings are evaluated strictly against this predicate.',
    codeSnippet: `// The predicate is frozen before examination starts
const SPEC_MUST_1_PREDICATE = (claim: AllocationClaim): boolean => {
  return claim.mechanism === 'wx_atomic_marker' 
      && claim.markerRetainedOnDelete === true 
      && claim.rebindPrevention === true;
};`,
    interactiveType: 'criterion_guard'
  },
  {
    id: 'the_lot',
    title: 'The Lot / VRF Tie-Breaker',
    source: 'Proverbs 16:33, 18:18',
    quote: 'The lot is cast into the lap, but its every decision is from the LORD. The lot puts an end to quarrels and decides between powerful contenders.',
    problemInAI: 'Split-Brain & Circular Deadlock: Two peer models (e.g. Claude vs ChatGPT) have 50/50 disagreement on non-invariant stylistic or heuristic choices.',
    protocolPrimitive: 'Deterministic VRF Arbitration: Decision authority is alienated from subjective agents to an immutable procedure (sha256(seed + claim_digest) % candidates) to guarantee protocol liveness.',
    codeSnippet: `// Deterministic tie-breaker when peer agents reach 50/50 impasse
export function castTheLot<T>(candidates: T[], seed: string, digest: string): T {
  const hash = sha256(\`\${seed}:\${digest}:\${candidates.length}\`);
  const index = parseInt(hash.slice(0, 8), 16) % candidates.length;
  return candidates[index];
}`,
    interactiveType: 'the_lot'
  }
];
