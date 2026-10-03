// Vendored from github.com/ever-co/ever-connect-sdk@62c3fa0a5a0b1b487de860cb2b714505caeeb7bf (packages/ts/connect-sdk/src/stats/checks.ts) by scripts/vendor-connect-sdk.mjs. Do not edit.
// @ts-nocheck: type-checked by the SDK's own strict build.
/**
 * The checks Ever Platform runs on a statistics report body, in its order and with its answers, so
 * a report the SDK lets through is one the platform accepts, and a refusal names the same field
 * with the same code:
 *
 * 1. the size limit (16 384 bytes): `413 validation_failed`, `too_large`;
 * 2. a strict JSON reader: no number with a fraction or an exponent (`type`), no integer outside
 *    64 bits (`range`), no key twice in one object (`duplicate_key`), at most 16 levels;
 * 3. the published schema in two passes: the envelope without the per-product `oneOf`, then the
 *    product's own lists, so a key of another product is named where it stands;
 * 4. `sent_at` names a day that exists.
 *
 * Field errors are `{path, code, message}`: `path` is a JSON pointer, `code` one of
 * {@link STATS_ERROR_CODES}, and `message` never repeats a value of the report. They are sorted by
 * path and code, one per (path, code), at most 20.
 */

import { byteOrder, isObject, SchemaChecker, type SchemaViolation } from '../schema';

/** The largest report body, in bytes. */
export const MAX_STATS_REPORT_BYTES = 16 * 1024;

/** The deepest nesting a report may have (the schema needs four levels). */
export const MAX_STATS_DEPTH = 16;

/** The most field errors one refusal lists. */
export const MAX_STATS_ERRORS = 20;

/** The field error codes of a refused report. */
export const STATS_ERROR_CODES = [
  'unknown_field',
  'type',
  'pattern',
  'range',
  'required',
  'duplicate_key',
  'schema_unknown',
  'too_large',
] as const;

/** A field error code of a refused report. */
export type StatsErrorCode = (typeof STATS_ERROR_CODES)[number];

/** One reason a report is refused. */
export interface StatsFieldError {
  /** The JSON pointer of the field (`""`: the whole body). */
  readonly path: string;
  /** What is wrong, from a closed list. */
  readonly code: StatsErrorCode;
  /** A sentence that never repeats the value sent. */
  readonly message: string;
}

/** The outcome of the checks: the report, or the platform's answer to it. */
export type StatsCheck =
  | { readonly ok: true; readonly report: Record<string, unknown> }
  | {
      readonly ok: false;
      readonly status: 413 | 422;
      readonly code: 'validation_failed' | 'schema_violation';
      readonly errors: readonly StatsFieldError[];
    };

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type JsonObject = { [key: string]: Json };
type Schema = { readonly [key: string]: unknown };
type OffenceKind = 'syntax' | 'fraction' | 'out_of_range' | 'duplicate_key';

const OFFENCE: Record<OffenceKind, { code: StatsErrorCode; message: string }> = {
  syntax: { code: 'type', message: 'the body is not a JSON document of the expected shape' },
  fraction: { code: 'type', message: 'numbers are integers: no fraction, no exponent' },
  out_of_range: { code: 'range', message: 'the integer is out of range' },
  duplicate_key: { code: 'duplicate_key', message: 'a key may appear once in an object' },
};

class Offence extends Error {
  constructor(
    readonly path: string,
    readonly kind: OffenceKind,
  ) {
    super(kind);
  }
}

const pointerSegment = (s: string) => s.replace(/~/g, '~0').replace(/\//g, '~1');
const child = (path: string, key: string | number) => `${path}/${pointerSegment(String(key))}`;
const I64_MIN = -(2n ** 63n);
const U64_MAX = 2n ** 64n - 1n;
const DECODER = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });

/** Parses a body strictly; throws an {@link Offence} at the first offence. */
function strictParse(bytes: Uint8Array): Json {
  let text: string;
  try {
    text = DECODER.decode(bytes);
  } catch {
    throw new Offence('', 'syntax');
  }
  let at = 0;
  const peek = () => text[at];
  const ws = () => {
    while (at < text.length && (text[at] === ' ' || text[at] === '\t' || text[at] === '\n' || text[at] === '\r')) at += 1;
  };
  const syntax = (path: string) => new Offence(path, 'syntax');
  const isDigit = (c: string | undefined) => c !== undefined && c >= '0' && c <= '9';

  const literal = (word: string, value: Json, path: string): Json => {
    if (!text.startsWith(word, at)) throw syntax(path);
    at += word.length;
    return value;
  };

  const hex4 = (path: string): number => {
    const digits = text.slice(at, at + 4);
    if (!/^[0-9A-Fa-f]{4}$/.test(digits)) throw syntax(path);
    at += 4;
    return Number.parseInt(digits, 16);
  };

  const string = (path: string): string => {
    at += 1;
    let out = '';
    for (;;) {
      const start = at;
      while (at < text.length) {
        const c = text.charCodeAt(at);
        if (c === 0x22 || c === 0x5c || c < 0x20) break;
        at += 1;
      }
      out += text.slice(start, at);
      const c = text[at];
      if (c === '"') {
        at += 1;
        return out;
      }
      if (c !== '\\') throw syntax(path);
      at += 1;
      const e = text[at];
      at += 1;
      switch (e) {
        case '"':
        case '\\':
        case '/':
          out += e;
          break;
        case 'b':
          out += '\b';
          break;
        case 'f':
          out += '\f';
          break;
        case 'n':
          out += '\n';
          break;
        case 'r':
          out += '\r';
          break;
        case 't':
          out += '\t';
          break;
        case 'u': {
          const first = hex4(path);
          let scalar = first;
          if (first >= 0xd800 && first < 0xdc00) {
            if (text.slice(at, at + 2) !== '\\u') throw syntax(path);
            at += 2;
            const second = hex4(path);
            if (second < 0xdc00 || second >= 0xe000) throw syntax(path);
            scalar = 0x10000 + ((first - 0xd800) << 10) + (second - 0xdc00);
          } else if (first >= 0xdc00 && first < 0xe000) {
            throw syntax(path);
          }
          out += String.fromCodePoint(scalar);
          break;
        }
        default:
          throw syntax(path);
      }
    }
  };

  const number = (path: string): number => {
    const start = at;
    if (peek() === '-') at += 1;
    if (peek() === '0') at += 1;
    else if (isDigit(peek()) && peek() !== '0') while (isDigit(peek())) at += 1;
    else throw syntax(path);
    if (peek() === '.' || peek() === 'e' || peek() === 'E') throw new Offence(path, 'fraction');
    const digits = text.slice(start, at);
    const big = BigInt(digits);
    if (big < I64_MIN || big > U64_MAX) throw new Offence(path, 'out_of_range');
    return Number(digits);
  };

  const value = (path: string, depth: number): Json => {
    if (depth > MAX_STATS_DEPTH) throw syntax(path);
    const c = peek();
    if (c === '{') return object(path, depth);
    if (c === '[') return array(path, depth);
    if (c === '"') return string(path);
    if (c === 't') return literal('true', true, path);
    if (c === 'f') return literal('false', false, path);
    if (c === 'n') return literal('null', null, path);
    if (c === '-' || isDigit(c)) return number(path);
    throw syntax(path);
  };

  const object = (path: string, depth: number): JsonObject => {
    at += 1;
    // A null prototype: `__proto__` is a key like any other.
    const out: JsonObject = Object.create(null);
    ws();
    if (peek() === '}') {
      at += 1;
      return out;
    }
    for (;;) {
      ws();
      if (peek() !== '"') throw syntax(path);
      const key = string(path);
      const here = child(path, key);
      ws();
      if (peek() !== ':') throw syntax(path);
      at += 1;
      ws();
      const v = value(here, depth + 1);
      if (Object.hasOwn(out, key)) throw new Offence(here, 'duplicate_key');
      out[key] = v;
      ws();
      if (peek() === ',') at += 1;
      else if (peek() === '}') {
        at += 1;
        return out;
      } else throw syntax(path);
    }
  };

  const array = (path: string, depth: number): Json[] => {
    at += 1;
    const items: Json[] = [];
    ws();
    if (peek() === ']') {
      at += 1;
      return items;
    }
    for (;;) {
      ws();
      items.push(value(child(path, items.length), depth + 1));
      ws();
      if (peek() === ',') at += 1;
      else if (peek() === ']') {
        at += 1;
        return items;
      } else throw syntax(path);
    }
  };

  ws();
  const doc = value('', 0);
  ws();
  if (at !== text.length) throw syntax('');
  return doc;
}

/** The field errors of a parsed report against the statistics schema (sorted, one per path and code, at most 20). */
export function statsSchemaErrors(schema: Schema, document: unknown): StatsFieldError[] {
  const checker = new SchemaChecker(schema);
  const { oneOf: _perProduct, ...envelope } = schema;
  const found: SchemaViolation[] = [];
  checker.check(envelope, document, '', found);
  const productSchema = isObject(schema.properties) ? schema.properties.product : undefined;
  const products = isObject(productSchema) && Array.isArray(productSchema.enum) ? productSchema.enum : [];
  const defs = isObject(schema.$defs) ? schema.$defs : {};
  const product = isObject(document) ? document.product : undefined;
  if (typeof product === 'string' && products.includes(product) && isObject(defs[product])) {
    const lists = defs[product] as { [key: string]: unknown };
    for (const section of ['counts', 'features', 'aggregates'] as const) {
      const value = (document as { [key: string]: unknown })[section];
      if (isObject(value) && lists[section] !== undefined) checker.check(lists[section], value, `/${section}`, found);
    }
  }
  const seen = new Set<string>();
  const errors: StatsFieldError[] = [];
  for (const v of found) {
    const code: StatsErrorCode = v.path === '/schema' && v.kind !== 'required' ? 'schema_unknown' : v.kind === 'shape' ? 'type' : v.kind;
    const key = `${v.path}\u0000${code}`;
    if (seen.has(key)) continue;
    seen.add(key);
    errors.push({ path: v.path, code, message: v.message });
  }
  errors.sort((a, b) => byteOrder(a.path, b.path) || byteOrder(a.code, b.code));
  return errors.slice(0, MAX_STATS_ERRORS);
}

/** Whether `YYYY-MM-DD` names a day that exists. */
export function isCalendarDate(text: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1) return false;
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mo - 1] as number;
  return d <= days;
}

/** Runs the platform's checks on a report body (see the module comment). */
export function checkStatsBytes(schema: Schema, bytes: Uint8Array): StatsCheck {
  if (bytes.length > MAX_STATS_REPORT_BYTES)
    return {
      ok: false,
      status: 413,
      code: 'validation_failed',
      errors: [{ path: '', code: 'too_large', message: `the body is larger than ${MAX_STATS_REPORT_BYTES} bytes` }],
    };
  let document: Json;
  try {
    document = strictParse(bytes);
  } catch (error) {
    if (!(error instanceof Offence)) throw error;
    const { code, message } = OFFENCE[error.kind];
    return { ok: false, status: 422, code: 'schema_violation', errors: [{ path: error.path, code, message }] };
  }
  const errors = statsSchemaErrors(schema, document);
  if (errors.length === 0 && !isCalendarDate(String((document as JsonObject).sent_at)))
    errors.push({ path: '/sent_at', code: 'range', message: 'not a calendar date' });
  if (errors.length > 0) return { ok: false, status: 422, code: 'schema_violation', errors };
  return { ok: true, report: document as Record<string, unknown> };
}

/** Every property name the schema declares, anywhere (its vocabulary). */
function vocabulary(schema: unknown, words = new Set<string>()): Set<string> {
  if (Array.isArray(schema)) for (const item of schema) vocabulary(item, words);
  else if (isObject(schema)) {
    if (isObject(schema.properties)) for (const k of Object.keys(schema.properties)) words.add(k);
    for (const v of Object.values(schema)) vocabulary(v, words);
  }
  return words;
}

const VOCABULARY = new WeakMap<object, Set<string>>();

/**
 * A field path fit for a log line: a segment stays when the schema names it, or it is a currency
 * code or an array index; any other segment (an unknown key, which could be a name or an e-mail
 * address) becomes `*`.
 */
export function redactStatsPath(schema: Schema, path: string): string {
  let words = VOCABULARY.get(schema);
  if (!words) {
    words = vocabulary(schema);
    VOCABULARY.set(schema, words);
  }
  if (path === '') return '';
  return path
    .split('/')
    .slice(1)
    .map((raw) => {
      const segment = raw.replace(/~1/g, '/').replace(/~0/g, '~');
      return /^[A-Z]{3}$/.test(segment) || /^\d{1,2}$/.test(segment) || words.has(segment) ? raw : '*';
    })
    .reduce((out, s) => `${out}/${s}`, '');
}
