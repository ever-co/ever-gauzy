// Vendored from github.com/ever-co/ever-connect-sdk@62c3fa0a5a0b1b487de860cb2b714505caeeb7bf (packages/ts/connect-sdk/src/transport.ts) by scripts/vendor-connect-sdk.mjs. Do not edit.
// @ts-nocheck: type-checked by the SDK's own strict build.
/**
 * The one place the SDK hands a request to `fetch`. It holds no path of its own: the client passes
 * a path from the generated operation table, and the transport joins it to the base URL.
 *
 * - The base URL is `https://`, or `http://` on a local host only (`insecure_base_url`).
 * - A URL outside the base URL's origin and path prefix is refused before any I/O (`absolute_url`).
 * - Redirects are never followed (a 3xx answer is refused with `redirect`, no second request);
 *   no cookie is sent or kept.
 * - Every request has a deadline (`TimeoutError`).
 * - A non-2xx answer becomes a `ProblemError`; secrets of the request never appear in it.
 */
import { EgressRefusedError, ProblemError, ResponseTooLargeError, TimeoutError } from './errors';
import { isLocalHost } from './local';

/** The largest answer body read by default. */
export const MAX_RESPONSE_BYTES = 4 * 1024 * 1024;

/** Reads an answer body, refusing it past `limit` bytes (the read stops there). */
async function readLimited(response: Response, limit: number): Promise<Uint8Array> {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > limit) {
    await response.body?.cancel().catch(() => undefined);
    throw new ResponseTooLargeError(limit);
  }
  if (!response.body) return new Uint8Array(await response.arrayBuffer());
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) {
      await reader.cancel().catch(() => undefined);
      throw new ResponseTooLargeError(limit);
    }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

/** What the transport needs from the client. */
export interface TransportConfig {
  readonly base: URL;
  readonly fetch: typeof globalThis.fetch;
}

/** One request, already checked by the client. */
export interface WireRequest {
  readonly method: string;
  /** A path from the operation table, path parameters filled in (starts with `/`). */
  readonly path: string;
  readonly query?: URLSearchParams;
  readonly headers: Record<string, string>;
  readonly body?: Uint8Array;
  readonly timeoutMs: number;
  /** The largest answer body read (default 4 MiB). */
  readonly maxResponseBytes?: number;
  readonly signal?: AbortSignal;
}

/** An answer, read in full. */
export interface WireResponse {
  readonly status: number;
  readonly headers: Headers;
  readonly body: Uint8Array;
}

/** Checks a base URL: http(s), no credentials, query or fragment; `http://` only on a local host. */
export function checkBaseUrl(baseUrl: string): URL {
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new TypeError('baseUrl is not a URL');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new TypeError('baseUrl is http or https');
  if (url.username || url.password || url.search || url.hash) throw new TypeError('baseUrl has no credentials, query or fragment');
  if (url.protocol === 'http:' && !isLocalHost(url.hostname)) throw new EgressRefusedError('insecure_base_url');
  return url;
}

const prefixOf = (base: URL) => base.pathname.replace(/\/+$/, '');

/** The URL of `path` under `base`; refuses anything that would leave the base origin or prefix. */
export function urlFor(base: URL, path: string, query?: URLSearchParams): URL {
  if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//') || path.includes('\\'))
    throw new EgressRefusedError('absolute_url');
  const prefix = prefixOf(base);
  const url = new URL(`${base.origin}${prefix}${path}`);
  if (url.origin !== base.origin || !(url.pathname === prefix || url.pathname.startsWith(`${prefix}/`)))
    throw new EgressRefusedError('absolute_url');
  // Dot segments would be resolved away by URL; a path that changed is refused.
  if (url.pathname !== `${prefix}${path.split('?')[0]}`) throw new EgressRefusedError('absolute_url');
  if (query && [...query.keys()].length > 0) url.search = query.toString();
  return url;
}

/** Sends one request. Throws `EgressRefusedError`, `TimeoutError`, or what `fetch` throws. */
export async function send(config: TransportConfig, req: WireRequest): Promise<WireResponse> {
  const url = urlFor(config.base, req.path, req.query);
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, req.timeoutMs);
  const onAbort = () => controller.abort(req.signal?.reason);
  if (req.signal) {
    if (req.signal.aborted) controller.abort(req.signal.reason);
    else req.signal.addEventListener('abort', onAbort, { once: true });
  }
  try {
    const response = await config.fetch(url.toString(), {
      method: req.method,
      headers: req.headers,
      body: req.body,
      redirect: 'manual',
      credentials: 'omit',
      cache: 'no-store',
      signal: controller.signal,
    });
    if (response.type === 'opaqueredirect' || (response.status >= 300 && response.status < 400 && response.status !== 304)) {
      await response.body?.cancel().catch(() => undefined);
      throw new EgressRefusedError('redirect');
    }
    const body = await readLimited(response, req.maxResponseBytes ?? MAX_RESPONSE_BYTES);
    return { status: response.status, headers: response.headers, body };
  } catch (error) {
    if (timedOut) throw new TimeoutError(req.timeoutMs);
    throw error;
  } finally {
    clearTimeout(timer);
    req.signal?.removeEventListener('abort', onAbort);
  }
}

function retryAfter(headers: Headers, body: Record<string, unknown> | null): number | undefined {
  const h = headers.get('retry-after');
  if (h !== null) {
    if (/^[0-9]+$/.test(h.trim())) return Number(h.trim());
    const at = Date.parse(h);
    if (!Number.isNaN(at)) return Math.max(0, Math.ceil((at - Date.now()) / 1000));
  }
  const s = body?.retry_after_s;
  return typeof s === 'number' && Number.isInteger(s) && s >= 0 ? s : undefined;
}

/**
 * Replaces every instance token (`evit_…`) and every compact JWS (an assertion, a document) in
 * `text` with `[redacted]`. The client keeps no copy of a secret to look for: both are recognised
 * by their shape.
 */
export function redact(text: string): string {
  return text.replace(/evit_[A-Za-z0-9_-]+/g, '[redacted]').replace(/eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*/g, '[redacted]');
}

/** The problem of a non-2xx answer (`unknown` when the body is not a problem document). */
export function problemFrom(res: WireResponse): ProblemError {
  let doc: Record<string, unknown> | null = null;
  try {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(res.body));
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) doc = parsed as Record<string, unknown>;
  } catch {
    doc = null;
  }
  const code = typeof doc?.code === 'string' && /^[a-z0-9_]{1,64}$/.test(doc.code) ? doc.code : 'unknown';
  const detail = typeof doc?.detail === 'string' ? redact(doc.detail) : undefined;
  const instance = typeof doc?.instance === 'string' ? doc.instance : (res.headers.get('x-request-id') ?? null);
  const errors = Array.isArray(doc?.errors)
    ? (doc.errors as unknown[])
        .filter((e): e is Record<string, unknown> => e !== null && typeof e === 'object')
        .map((e) => ({
          path: typeof e.path === 'string' ? e.path : '',
          code: typeof e.code === 'string' ? e.code : 'unknown',
          message: typeof e.message === 'string' ? redact(e.message) : '',
        }))
        .filter((e) => !/client_assertion|client_secret/.test(e.path))
    : undefined;
  return new ProblemError(res.status, code, detail, instance, errors, retryAfter(res.headers, doc));
}
