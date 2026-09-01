/**
 * Canonical JSON serialization (The "Just Scales" principle - Proverbs 11:1)
 * Sorts all object keys recursively to ensure deterministic SHA-256 digests.
 */
export function canonicalJson(obj: any): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalJson).join(',') + ']';
  }
  const keys = Object.keys(obj).sort();
  const pairs = keys.map(key => `${JSON.stringify(key)}:${canonicalJson(obj[key])}`);
  return '{' + pairs.join(',') + '}';
}

/**
 * SHA-256 digest in hex using Web Crypto API
 */
export async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Synchronous mock sha256 for fast UI previews
 */
export function syncFastHash(str: string): string {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0, ch; i < str.length; i++) {
    ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const p1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const p2 = (h2 >>> 0).toString(16).padStart(8, '0');
  return (p1 + p2 + p1 + p2).slice(0, 64);
}

/**
 * UUIDv7 generator: time-ordered (k-sortable) UUID
 */
export function generateUUIDv7(): string {
  const timestamp = Date.now();
  const tsHex = timestamp.toString(16).padStart(12, '0');
  
  // 48-bit timestamp | 4-bit version (7) | 12-bit rand_a | 2-bit variant (2) | 62-bit rand_b
  const randA = Math.floor(Math.random() * 0x0fff).toString(16).padStart(3, '0');
  const randB1 = (0x8000 | Math.floor(Math.random() * 0x3fff)).toString(16).padStart(4, '0');
  const randB2 = Math.floor(Math.random() * 0xffffffffffff).toString(16).padStart(12, '0');
  
  const p1 = tsHex.slice(0, 8);
  const p2 = tsHex.slice(8, 12);
  const p3 = `7${randA}`;
  const p4 = randB1;
  const p5 = randB2;
  
  return `${p1}-${p2}-${p3}-${p4}-${p5}`;
}

/**
 * The Lot / VRF Arbiter (Proverbs 16:33 & 18:18)
 * Deterministically picks a winner between split candidates given a seed and case digest.
 */
export function castTheLot<T>(candidates: T[], seed: string, caseDigest: string): { winner: T; index: number; lotProof: string } {
  if (candidates.length === 0) {
    throw new Error("Cannot cast lot on empty candidates");
  }
  const combined = `${seed}:${caseDigest}:${candidates.length}`;
  const hash = syncFastHash(combined);
  const bigNum = parseInt(hash.slice(0, 8), 16);
  const index = bigNum % candidates.length;
  return {
    winner: candidates[index],
    index,
    lotProof: `lot:${hash.slice(0, 16)}`
  };
}
