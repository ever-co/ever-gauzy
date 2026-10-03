// Vendored from github.com/ever-co/ever-connect-sdk@62c3fa0a5a0b1b487de860cb2b714505caeeb7bf (packages/ts/connect-sdk/src/stats/index.ts) by scripts/vendor-connect-sdk.mjs. Do not edit.
// @ts-nocheck: type-checked by the SDK's own strict build.
/**
 * Anonymous statistics: validate a report exactly as Ever Platform does, sign the bytes that are
 * sent, send them, and read the answer.
 *
 * - {@link signStatsReport} serialises the report once, runs the platform's checks on those bytes
 *   ({@link validateStatsReportBytes}: size, strict JSON, the published `ever.stats.v1` schema,
 *   the calendar date) and signs them with the installation's statistics key. A refused report
 *   yields no bytes: {@link StatsValidationError} names each field and code, never a value.
 * - {@link sendStatsReport} posts exactly those bytes, with no credential and no cookie, and
 *   classifies the answer ({@link classifyStatsAnswer}): accepted, retry later, reset the identity
 *   (`409 key_mismatch`), or dropped until the module is upgraded.
 * - {@link walkStrings} lists every string of a report (keys included), for the products' test
 *   that no seeded name, e-mail address or other text reaches the payload.
 *
 * The statistics key is an Ed25519 key pair the installation generates on first boot for
 * statistics only; it is never the key of an Ever Platform connection.
 */
import { createHash, createPrivateKey, createPublicKey, sign as edSign, randomBytes } from 'node:crypto';
import { CONSTANTS, SCHEMAS } from '../../connect-contracts';
import { checkStatsBytes, MAX_STATS_REPORT_BYTES, redactStatsPath, type StatsFieldError } from './checks';

export type { StatsErrorCode, StatsFieldError } from './checks';
export { isCalendarDate, MAX_STATS_ERRORS, MAX_STATS_REPORT_BYTES, STATS_ERROR_CODES } from './checks';

/** The signature headers (`Ever-Stats-Key`, `Ever-Stats-Signature`, `Ever-Stats-Key-Id`). */
export const STATS_HEADERS = CONSTANTS.stats_headers;

/** The prefix of the `Ever-Stats-Signature` value. */
export const STATS_SIGNATURE_PREFIX = CONSTANTS.stats_signature_prefix;

/** The path of the report call, under the Ever Platform API origin. */
export const STATS_REPORTS_PATH = '/v1/stats/reports';

/** The waits after a failed send (429, 5xx, no answer): +1 h, +4 h, +12 h, then the next day. */
export const STATS_RETRY_DELAYS_S = [3600, 14400, 43200, 86400] as const;

const SCHEMA = SCHEMAS.stats as unknown as { readonly [key: string]: unknown };
const PKCS8_ED25519 = Uint8Array.from([0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20]);

/**
 * A report the checks refused: no bytes were produced. Its message, `toString()` and JSON name
 * fields and codes only, with any segment the schema does not name (an unknown key) shown as `*`.
 * `errors` holds the exact paths, as Ever Platform would answer them: an unknown key is its own
 * path, so do not log `errors` itself.
 */
export class StatsValidationError extends Error {
  override readonly name = 'StatsValidationError';
  readonly #errors: readonly StatsFieldError[];
  constructor(
    /** The platform's status for these bytes: 413 (too large) or 422. */
    readonly status: 413 | 422,
    /** The platform's problem code. */
    readonly code: 'validation_failed' | 'schema_violation',
    errors: readonly StatsFieldError[],
  ) {
    super(
      `statistics report refused (${status} ${code}): ${errors.map((e) => `${redactStatsPath(SCHEMA, e.path) || '(body)'} ${e.code}`).join(', ')}`,
    );
    this.#errors = errors;
  }

  /** Every field error with its exact path (sorted by path and code, at most 20); not shown by inspection. */
  get errors(): readonly StatsFieldError[] {
    return this.#errors;
  }

  /** The refusal with every path fit for a log line. */
  toJSON(): { name: string; status: 413 | 422; code: string; errors: StatsFieldError[] } {
    return {
      name: this.name,
      status: this.status,
      code: this.code,
      errors: this.errors.map((e) => ({ ...e, path: redactStatsPath(SCHEMA, e.path) })),
    };
  }
}

/** The outcome of the checks on a report. */
export type StatsValidation =
  | { readonly ok: true; readonly body: Uint8Array }
  | { readonly ok: false; readonly error: StatsValidationError };

/** Signs report bytes with the installation's statistics key (Ed25519). */
export interface StatsSigner {
  /** The public key: base64url without padding of the 32 key bytes (43 characters). */
  readonly publicKey: string;
  /** The 64-byte Ed25519 signature over exactly `bytes`. */
  sign(bytes: Uint8Array): Uint8Array;
}

/** A signed report: send `body` as it is, with `headers`. */
export interface SignedStatsReport {
  readonly body: Uint8Array;
  readonly headers: Readonly<Record<string, string>>;
}

const b64url = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64url');

/** The key id the platform derives from a public key: base64url of the first 8 bytes of its SHA-256. */
export function statsKeyId(publicKey: string): string {
  const raw = Buffer.from(publicKey, 'base64url');
  if (raw.length !== 32 || b64url(raw) !== publicKey) throw new TypeError('not a base64url Ed25519 public key');
  return b64url(createHash('sha256').update(raw).digest().subarray(0, 8));
}

/** A signer over a 32-byte Ed25519 seed (the private key as the installation stores it). */
export function statsSignerFromSeed(seed: Uint8Array): StatsSigner {
  if (!(seed instanceof Uint8Array) || seed.length !== 32) throw new TypeError('a statistics key seed is 32 bytes');
  const privateKey = createPrivateKey({ key: Buffer.concat([PKCS8_ED25519, seed]), format: 'der', type: 'pkcs8' });
  const jwk = createPublicKey(privateKey).export({ format: 'jwk' });
  if (typeof jwk.x !== 'string') throw new TypeError('not an Ed25519 key');
  const publicKey = jwk.x;
  return {
    publicKey,
    sign: (bytes: Uint8Array) => new Uint8Array(edSign(null, bytes, privateKey)),
    // Neither JSON nor inspection shows more than the public key.
    toJSON: () => ({ publicKey }),
    toString: () => `StatsSigner(${publicKey})`,
  } as StatsSigner;
}

/** A new statistics key: store `seed` (secret) and keep using `signer`. */
export function generateStatsKey(): { readonly seed: Uint8Array; readonly signer: StatsSigner } {
  const seed = new Uint8Array(randomBytes(32));
  return { seed, signer: statsSignerFromSeed(seed) };
}

/** Runs the platform's checks on report bytes, as they will be sent. */
export function validateStatsReportBytes(body: Uint8Array): StatsValidation {
  const checked = checkStatsBytes(SCHEMA, body);
  return checked.ok ? { ok: true, body } : { ok: false, error: new StatsValidationError(checked.status, checked.code, checked.errors) };
}

/** Serialises a report once (`JSON.stringify`) and runs the platform's checks on those bytes. */
export function validateStatsReport(report: unknown): StatsValidation {
  let text: string | undefined;
  try {
    text = JSON.stringify(report);
  } catch {
    text = undefined;
  }
  if (typeof text !== 'string')
    return {
      ok: false,
      error: new StatsValidationError(422, 'schema_violation', [{ path: '', code: 'type', message: 'the report is not a JSON value' }]),
    };
  return validateStatsReportBytes(new TextEncoder().encode(text));
}

/** Signs report bytes the checks accepted; throws {@link StatsValidationError} otherwise. */
export function signStatsReportBytes(body: Uint8Array, signer: StatsSigner, options: { keyId?: boolean } = {}): SignedStatsReport {
  const checked = validateStatsReportBytes(body);
  if (!checked.ok) throw checked.error;
  const signature = signer.sign(checked.body);
  if (signature.length !== 64) throw new TypeError('an Ed25519 signature is 64 bytes');
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    [STATS_HEADERS.key]: signer.publicKey,
    [STATS_HEADERS.signature]: `${STATS_SIGNATURE_PREFIX}${b64url(signature)}`,
  };
  if (options.keyId) headers[STATS_HEADERS.key_id] = statsKeyId(signer.publicKey);
  return { body: checked.body, headers };
}

/**
 * Validates a report, serialises it once and signs exactly those bytes. Throws
 * {@link StatsValidationError} (and produces no bytes) when the platform would refuse it.
 */
export function signStatsReport(report: unknown, signer: StatsSigner, options: { keyId?: boolean } = {}): SignedStatsReport {
  const checked = validateStatsReport(report);
  if (!checked.ok) throw checked.error;
  return signStatsReportBytes(checked.body, signer, options);
}

/** One string of a report: an object key or a string value, at its JSON pointer. */
export interface StatsString {
  readonly path: string;
  readonly value: string;
  readonly kind: 'key' | 'value';
}

/** Every string of a value, keys included, depth first, in key order. */
export function walkStrings(value: unknown, path = ''): StatsString[] {
  const out: StatsString[] = [];
  const visit = (v: unknown, at: string) => {
    if (typeof v === 'string') out.push({ path: at, value: v, kind: 'value' });
    else if (Array.isArray(v)) v.forEach((item, i) => visit(item, `${at}/${i}`));
    else if (v !== null && typeof v === 'object')
      for (const [k, item] of Object.entries(v)) {
        const here = `${at}/${k.replace(/~/g, '~0').replace(/\//g, '~1')}`;
        out.push({ path: here, value: k, kind: 'key' });
        visit(item, here);
      }
  };
  visit(value, path);
  return out;
}

/** What to do after a send. */
export type StatsSendOutcome =
  /** Stored; `superseded` when it replaced a report of the same month sent the same UTC day. */
  | { readonly kind: 'accepted'; readonly status: 202; readonly superseded: boolean }
  /** Try again in `retryAfterS` seconds (429, 5xx, a failed connection or a timeout). */
  | { readonly kind: 'retry'; readonly status: number | null; readonly code: string | null; readonly retryAfterS: number }
  /** `409 key_mismatch`: the id is pinned to another key; reset the statistics identity (new id, new key). */
  | { readonly kind: 'reset_identity'; readonly status: 409; readonly code: 'key_mismatch' }
  /** Refused for good (400, 413, 415, 422, any other answer): do not resend until the module is upgraded. */
  | {
      readonly kind: 'dropped';
      readonly status: number;
      readonly code: string | null;
      readonly errors: readonly { readonly path: string; readonly code: string }[];
    };

const delay = (attempt: number) => STATS_RETRY_DELAYS_S[Math.min(Math.max(attempt, 0), STATS_RETRY_DELAYS_S.length - 1)] as number;

/**
 * Classifies an answer of `POST /v1/stats/reports`. `attempt` counts the failed sends before this
 * one (0 for the first), and picks the wait of a retry; a `Retry-After` longer than it wins.
 */
export function classifyStatsAnswer(status: number, body: unknown, retryAfter: string | null = null, attempt = 0): StatsSendOutcome {
  const doc = body !== null && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const code = typeof doc.code === 'string' ? doc.code : null;
  if (status === 202) return { kind: 'accepted', status: 202, superseded: doc.superseded === true };
  if (status === 409 && code === 'key_mismatch') return { kind: 'reset_identity', status: 409, code: 'key_mismatch' };
  if (status === 429 || status >= 500) {
    const asked = retryAfter !== null && /^\d+$/.test(retryAfter.trim()) ? Number(retryAfter.trim()) : 0;
    return { kind: 'retry', status, code, retryAfterS: Math.max(delay(attempt), asked) };
  }
  const errors = Array.isArray(doc.errors)
    ? doc.errors
        .filter(
          (e): e is { path: string; code: string } =>
            e !== null && typeof e === 'object' && typeof e.path === 'string' && typeof e.code === 'string',
        )
        .map(({ path, code: c }) => ({ path, code: c }))
    : [];
  return { kind: 'dropped', status, code, errors };
}

/** Options of {@link sendStatsReport}. */
export interface SendStatsReportOptions {
  /** The Ever Platform API origin (`EVER_STATS_API_URL`, default `https://api.ever.co`). */
  readonly baseUrl: string;
  /** The fetch to use (default: the global one). */
  readonly fetch?: typeof globalThis.fetch;
  /** `ever-connect-sdk/<sdk version> (<product>/<product version>)`. */
  readonly userAgent?: string;
  /** The request timeout (default: the write timeout of the constants, 10 s). */
  readonly timeoutMs?: number;
  /** Failed sends before this one: picks the wait of a retry (default 0). */
  readonly attempt?: number;
}

/** The report endpoint under an origin; only `http:` and `https:` are accepted. */
export function statsReportsUrl(baseUrl: string): string {
  const url = new URL(baseUrl);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new TypeError('the statistics API URL is http or https');
  if (url.username || url.password || url.search || url.hash)
    throw new TypeError('the statistics API URL carries no credential, query or fragment');
  return `${url.origin}${url.pathname.replace(/\/+$/, '')}${STATS_REPORTS_PATH}`;
}

/**
 * Posts a signed report: exactly its bytes, its headers, no credential, no cookie, no redirect.
 * Never throws for an answer or a failed connection; it answers what to do next.
 */
export async function sendStatsReport(signed: SignedStatsReport, options: SendStatsReportOptions): Promise<StatsSendOutcome> {
  if (signed.body.length > MAX_STATS_REPORT_BYTES) throw new TypeError('a signed report is at most 16384 bytes');
  const url = statsReportsUrl(options.baseUrl);
  const fetcher = options.fetch ?? globalThis.fetch;
  const headers: Record<string, string> = { ...signed.headers, 'content-type': 'application/json' };
  if (options.userAgent) headers['user-agent'] = options.userAgent;
  const attempt = options.attempt ?? 0;
  let response: Response;
  try {
    response = await fetcher(url, {
      method: 'POST',
      headers,
      body: signed.body,
      redirect: 'manual',
      credentials: 'omit',
      signal: AbortSignal.timeout(options.timeoutMs ?? CONSTANTS.timeouts_ms.write),
    });
  } catch {
    return { kind: 'retry', status: null, code: null, retryAfterS: delay(attempt) };
  }
  let body: unknown = null;
  try {
    const text = await response.text();
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  return classifyStatsAnswer(response.status, body, response.headers.get('retry-after'), attempt);
}
