// Vendored from github.com/ever-co/ever-connect-sdk@62c3fa0a5a0b1b487de860cb2b714505caeeb7bf (packages/ts/connect-sdk/src/jws.ts) by scripts/vendor-connect-sdk.mjs. Do not edit.
// @ts-nocheck: type-checked by the SDK's own strict build.
/**
 * Compact JWS (RFC 7515) with EdDSA over Ed25519 (RFC 8037) only, and RFC 8785 canonical JSON for
 * the one shape the key manifest needs (arrays and objects of strings, integers and nulls).
 *
 * A JWS is decoded by one rule in both SDKs and on the platform: at most 64 KiB; three canonical
 * base64url parts; header and payload are JSON objects in valid UTF-8 (a leading byte-order mark
 * is not whitespace); no string or member name holds a lone surrogate; every number fits a double
 * (a number past it does not parse); at most 127 nested arrays and objects. Anything else is
 * `malformed`. How a number is written is checked where the value is read: the verifiers require
 * the integer claims they read to be I-JSON integers ({@link numberForms}).
 */
import { createPublicKey, verify as edVerify, type KeyObject } from 'node:crypto';
import { isSmallOrder } from './ed25519';
import { b64url, fromB64url } from './encoding';

/** The longest compact JWS a verifier reads. */
export const MAX_JWS_LENGTH = 65536;
/** The largest integer a claim may hold (I-JSON: 2^53 - 1). */
export const MAX_INTEGER = 9007199254740991;
/** The deepest nesting of arrays and objects a JWS part may have. */
const MAX_DEPTH = 127;
const MAX_SAFE = 9007199254740991n;
const INTEGER_TOKEN = /^(0|-?[1-9][0-9]*)$/;
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;
const WHITESPACE = new Set([' ', '\t', '\n', '\r']);

const pointerSegment = (s: string) => s.replace(/~/g, '~0').replace(/\//g, '~1');

/** Whether a number token is an I-JSON integer: no fraction, no exponent, not `-0`, within plus or minus 2^53 - 1. */
function integerToken(token: string): boolean {
  if (!INTEGER_TOKEN.test(token)) return false;
  const n = BigInt(token);
  return n <= MAX_SAFE && n >= -MAX_SAFE;
}

interface Frame {
  readonly array: boolean;
  /** The JSON pointer of the container. */
  readonly at: string;
  key: string;
  index: number;
  expectKey: boolean;
}

/**
 * How each number of a JSON text (already known to parse) is written: a map from the JSON pointer
 * of every number to whether it is an I-JSON integer (no fraction, no exponent, not `-0`, within
 * plus or minus 2^53 - 1). A member given twice counts as `JSON.parse` reads it: the last one.
 * `null` when the text nests more than 127 arrays and objects.
 */
export function numberForms(text: string): Map<string, boolean> | null {
  const forms = new Map<string, boolean>();
  const stack: Frame[] = [];
  /** The pointer of the value that starts here. */
  const here = (): string => {
    const top = stack.at(-1);
    if (!top) return '';
    return `${top.at}/${top.array ? String(top.index) : pointerSegment(top.key)}`;
  };
  /** A value replaces whatever an earlier member of the same name held. */
  const begin = (at: string) => {
    for (const k of [...forms.keys()]) if (k === at || k.startsWith(`${at}/`)) forms.delete(k);
  };
  let i = 0;
  while (i < text.length) {
    const c = text[i] as string;
    if (WHITESPACE.has(c)) {
      i += 1;
      continue;
    }
    const top = stack.at(-1);
    if (c === '{' || c === '[') {
      const at = here();
      begin(at);
      if (stack.length >= MAX_DEPTH) return null;
      stack.push({ array: c === '[', at, key: '', index: 0, expectKey: c === '{' });
      i += 1;
    } else if (c === '}' || c === ']') {
      stack.pop();
      i += 1;
    } else if (c === ',') {
      if (top?.array) top.index += 1;
      else if (top) top.expectKey = true;
      i += 1;
    } else if (c === ':') {
      if (top) top.expectKey = false;
      i += 1;
    } else if (c === '"') {
      let j = i + 1;
      while (j < text.length && text[j] !== '"') j += text[j] === '\\' ? 2 : 1;
      const raw = text.slice(i, j + 1);
      if (top && !top.array && top.expectKey) top.key = JSON.parse(raw) as string;
      else begin(here());
      i = j + 1;
    } else if (c === '-' || (c >= '0' && c <= '9')) {
      let j = i + 1;
      while (j < text.length && /[0-9eE.+-]/.test(text[j] as string)) j += 1;
      const at = here();
      begin(at);
      forms.set(at, integerToken(text.slice(i, j)));
      i = j;
    } else {
      // true, false, null
      begin(here());
      while (i < text.length && /[a-z]/.test(text[i] as string)) i += 1;
    }
  }
  return forms;
}

/** Whether every string and member name is well formed (no lone surrogate) and every number is finite. */
function wellFormed(value: unknown): boolean {
  if (typeof value === 'string') return !LONE_SURROGATE.test(value);
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(wellFormed);
  if (value !== null && typeof value === 'object') return Object.entries(value).every(([k, v]) => !LONE_SURROGATE.test(k) && wellFormed(v));
  return true;
}

/** A decoded compact JWS. */
export interface DecodedJws {
  readonly header: Record<string, unknown>;
  readonly payload: Record<string, unknown>;
  /**
   * How each number of the payload is written, by JSON pointer: true for an I-JSON integer
   * ({@link numberForms}).
   */
  readonly payloadNumbers: ReadonlyMap<string, boolean>;
  /** `base64url(header) "." base64url(payload)`, the bytes the signature covers. */
  readonly signingInput: string;
  readonly signature: Uint8Array;
}

const isRecord = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);

function json(part: string): { value: Record<string, unknown>; numbers: Map<string, boolean> } | null {
  const bytes = fromB64url(part);
  if (!bytes) return null;
  try {
    const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
    const value: unknown = JSON.parse(text);
    if (!isRecord(value) || !wellFormed(value)) return null;
    const numbers = numberForms(text);
    return numbers ? { value, numbers } : null;
  } catch {
    return null;
  }
}

/** Splits and decodes a compact JWS; null unless it is exactly three canonical base64url parts with JSON objects. */
export function decodeJws(token: unknown): DecodedJws | null {
  if (typeof token !== 'string' || token.length > MAX_JWS_LENGTH) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [h, p, s] = parts as [string, string, string];
  const header = json(h);
  const payload = json(p);
  const signature = fromB64url(s);
  if (!header || !payload || !signature) return null;
  return { header: header.value, payload: payload.value, payloadNumbers: payload.numbers, signingInput: `${h}.${p}`, signature };
}

/**
 * The first of `pointers` (in the order given) whose value is a number that is not an I-JSON
 * integer as written, or null. A pointer without a number is not checked here (the schema is).
 */
export function firstNonInteger(numbers: ReadonlyMap<string, boolean>, pointers: readonly string[]): string | null {
  for (const p of pointers) if (numbers.get(p) === false) return p;
  return null;
}

/** Public keys already imported (public data; bounded). */
const KEYS = new Map<string, KeyObject>();

/**
 * Whether `signature` is a valid Ed25519 signature by the key `x` (base64url, 32 bytes) over
 * `message`, under the strict rule: a small-order public key or a small-order `R` never verifies
 * (as `verify_strict` in the Rust crate and on the platform).
 */
export function verifyEd25519(x: string, message: string | Uint8Array, signature: Uint8Array): boolean {
  const raw = fromB64url(x);
  if (raw?.length !== 32 || signature.length !== 64) return false;
  if (isSmallOrder(raw) || isSmallOrder(signature.subarray(0, 32))) return false;
  try {
    let key = KEYS.get(x);
    if (!key) {
      key = createPublicKey({ key: { kty: 'OKP', crv: 'Ed25519', x }, format: 'jwk' });
      if (KEYS.size >= 64) KEYS.clear();
      KEYS.set(x, key);
    }
    return edVerify(null, typeof message === 'string' ? Buffer.from(message, 'utf8') : message, key, signature);
  } catch {
    return false;
  }
}

/** Signs a compact JWS (`alg: EdDSA`) with a signer of raw bytes. */
export async function signJws(
  sign: (bytes: Uint8Array) => Promise<Uint8Array> | Uint8Array,
  header: Record<string, unknown>,
  payload: Record<string, unknown>,
): Promise<string> {
  const input = `${b64url(JSON.stringify({ alg: 'EdDSA', ...header }))}.${b64url(JSON.stringify(payload))}`;
  const signature = await sign(new TextEncoder().encode(input));
  return `${input}.${b64url(signature)}`;
}

/** UTF-16 code unit order of two strings (RFC 8785 sorts member names this way). */
function utf16Order(a: string, b: string): number {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i += 1) {
    const d = a.charCodeAt(i) - b.charCodeAt(i);
    if (d !== 0) return d;
  }
  return a.length - b.length;
}

/**
 * RFC 8785 canonical JSON of a value made of objects, arrays, strings, booleans, nulls and
 * integers; throws for any other number (refused rather than mis-canonicalised).
 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) throw new TypeError('canonical JSON: only integers are supported');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (isRecord(value)) {
    const names = Object.keys(value)
      .filter((k) => value[k] !== undefined)
      .sort(utf16Order);
    return `{${names.map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(',')}}`;
  }
  throw new TypeError('canonical JSON: unsupported value');
}
