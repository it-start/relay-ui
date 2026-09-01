import crypto from 'crypto';

/**
 * Just Scales Canonical JSON serialization (RFC 8785 / Proverbs 11:1)
 * Keys recursively sorted lexicographically by UTF-16 code units, strict IEEE-754 numbers.
 */
export function canonicalJson(obj: any): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalJson).join(',') + ']';
  }
  const keys = Object.keys(obj).sort();
  const pairs = keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(obj[key])}`);
  return '{' + pairs.join(',') + '}';
}

/**
 * Compute SHA-256 hex digest
 */
export function sha256(str: string): string {
  return crypto.createHash('sha256').update(str).digest('hex');
}
