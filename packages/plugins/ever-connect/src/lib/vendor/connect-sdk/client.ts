// Vendored from github.com/ever-co/ever-connect-sdk@62c3fa0a5a0b1b487de860cb2b714505caeeb7bf (packages/ts/connect-sdk/src/client.ts) by scripts/vendor-connect-sdk.mjs. Do not edit.
// @ts-nocheck: type-checked by the SDK's own strict build.
/**
 * `createEverPlatformClient`: every call an installation makes to Ever Platform, one line per
 * method over the generated operation table. The client:
 *
 * - builds every URL from `baseUrl` and a path of the table (the transport refuses anything else);
 * - refuses before any I/O: a write without its `Idempotency-Key`, a per-link call without its
 *   link id, a body that breaks its schema (unknown fields included), a statistics body over
 *   16 KiB or a mirror batch over 4 MiB;
 * - authenticates lazily: the first call that needs the instance token signs a client assertion
 *   with the connect key (no Registry id yet: `NotConnectedError`, before any I/O), keeps the
 *   token in memory, and on a 401 gets a new one and retries once; `401 credential_revoked` is
 *   answered at once, never retried;
 * - sends `User-Agent: ever-connect-sdk/<version> (<product>/<version>)` and an `x-request-id`;
 * - answers `{notModified: true}` for a 304 and a `ProblemError` for any other non-2xx answer.
 */
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { CONSTANTS, type operations, type Product } from '../connect-contracts';
import { signClientAssertion } from './assertion';
import { ULID } from './encoding';
import { type CachedEntitlement, type VerifiedEntitlement, verifyEntitlement } from './entitlement';
import { EntitlementError, NotConnectedError, ProblemError, RateLimitedError, RequestRefusedError } from './errors';
import { OPERATIONS, type OperationId, type OperationSpec, REQUEST_SCHEMAS, SDK_VERSION } from './generated/operations';
import type { InstanceSigner } from './keys';
import { KeySet, type KeySetUpdate } from './keyset';
import { isLocalUrl, originOf, warnOnce } from './local';
import { pinnedRootKeys, type RootKey, type VerifiedKeyManifest, verifyKeyManifest } from './manifest';
import { schemaViolations } from './schema';
import type { SignedStatsReport } from './stats';
import { InstanceTokens } from './token';
import { checkBaseUrl, MAX_RESPONSE_BYTES, problemFrom, send, type TransportConfig, type WireResponse } from './transport';

type Ops = operations;
type JsonOf<T> = T extends { readonly content: { readonly 'application/json': infer B } } ? B : undefined;
/** The request body type of an operation. */
export type RequestBody<Id extends OperationId> =
  NonNullable<Ops[Id]['requestBody']> extends { readonly content: { readonly 'application/json': infer B } } ? B : never;
/** The success body type of an operation (2xx answers). */
export type ResponseBody<Id extends OperationId> = {
  [S in keyof Ops[Id]['responses']]: S extends 200 | 201 | 202 | 204 ? JsonOf<Ops[Id]['responses'][S]> : never;
}[keyof Ops[Id]['responses']];
/** A conditional read whose cached copy is current. */
export interface NotModified {
  readonly notModified: true;
}

/** The input of one call. */
export interface CallInput<B = unknown> {
  readonly path?: Readonly<Record<string, string>>;
  readonly query?: Readonly<Record<string, string | number | boolean | null | undefined>>;
  readonly body?: B;
  readonly idempotencyKey?: string;
  /** The tenant link (`Ever-Link-Id`) of a per-link call. */
  readonly linkId?: string;
  /** Sends `If-None-Match: "<seq>"`; a 304 answers `{notModified: true}`. */
  readonly ifNoneMatchSeq?: number;
  /** The person's Ever ID token, for the calls a person makes through the product. */
  readonly personToken?: string;
  /** Long-poll seconds (the read deadline becomes `waitS + 5`). */
  readonly waitS?: number;
  readonly signal?: AbortSignal;
}

export interface EverPlatformClientOptions {
  /** `EVER_PLATFORM_API_URL`: https, or http on a local host only. */
  readonly baseUrl: string;
  /** Names the product in the `User-Agent`. */
  readonly userAgentProduct: { readonly product: Product; readonly version: string };
  /** The connect key (never the statistics key). Needed for every call that uses the instance token. */
  readonly signer?: InstanceSigner;
  /** The Registry id the redeem answered; null before the first redeem. */
  readonly registryInstanceId?: () => string | null;
  readonly fetch?: typeof globalThis.fetch;
  readonly timeouts?: { readonly readMs?: number; readonly writeMs?: number };
  /** Extra root keys: honoured only when `baseUrl` is a local host, otherwise ignored with one warning. */
  readonly rootKeys?: readonly RootKey[];
  /**
   * The issuer documents name, when it differs from the origin of `baseUrl` (a mock or a local
   * build behind another name): honoured only when `baseUrl` is a local host.
   */
  readonly issuer?: string;
  /** Unix seconds (tests). */
  readonly now?: () => number;
  readonly onToken?: (event: { acquired_at: number; expires_in: number }) => void;
  /** Where the one warning about an ignored override goes (default `console.warn`). */
  readonly onWarning?: (message: string) => void;
  /** The environment `EVER_PLATFORM_ROOT_KEYS_FILE` is read from (default `process.env`). */
  readonly env?: Readonly<Record<string, string | undefined>>;
}

/** The root keys a client trusts: the pinned ones, plus extra ones for a local base URL only. */
export function resolveRootKeys(o: {
  readonly baseUrl: string;
  readonly rootKeys?: readonly RootKey[];
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly onWarning?: (message: string) => void;
}): readonly RootKey[] {
  const pinned = pinnedRootKeys();
  const env = o.env ?? process.env;
  const file = env[CONSTANTS.root_keys_file_env];
  if ((o.rootKeys?.length ?? 0) === 0 && !file) return pinned;
  if (!isLocalUrl(o.baseUrl)) {
    warnOnce(
      `extra root keys (the rootKeys option or ${CONSTANTS.root_keys_file_env}) are ignored: the base URL is not a local host`,
      o.onWarning,
    );
    return pinned;
  }
  const extra: RootKey[] = [...(o.rootKeys ?? [])];
  if (file) {
    const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'));
    const keys = Array.isArray(parsed) ? parsed : (parsed as { keys?: unknown }).keys;
    if (!Array.isArray(keys)) throw new TypeError(`${CONSTANTS.root_keys_file_env} is not a JWKS`);
    for (const k of keys) if (k && typeof k.kid === 'string' && typeof k.x === 'string') extra.push(k as RootKey);
  }
  return [...pinned, ...extra];
}

const enc = new TextEncoder();
const IDEMPOTENCY_KEY = /^[\x21-\x7e]{1,255}$/;

export function createEverPlatformClient(o: EverPlatformClientOptions) {
  const base = checkBaseUrl(o.baseUrl);
  const transport: TransportConfig = { base, fetch: o.fetch ?? globalThis.fetch.bind(globalThis) };
  const now = o.now ?? (() => Math.floor(Date.now() / 1000));
  const readMs = o.timeouts?.readMs ?? CONSTANTS.timeouts_ms.read;
  const writeMs = o.timeouts?.writeMs ?? CONSTANTS.timeouts_ms.write;
  const local = isLocalUrl(o.baseUrl);
  if (o.issuer !== undefined && !local) warnOnce('the issuer option is ignored: the base URL is not a local host', o.onWarning);
  const issuer = (local && o.issuer !== undefined ? originOf(o.issuer) : null) ?? base.origin;
  const rootKeys = resolveRootKeys({ baseUrl: o.baseUrl, rootKeys: o.rootKeys, env: o.env, onWarning: o.onWarning });
  const product = o.userAgentProduct;
  if (!product || !CONSTANTS.products.includes(product.product) || !/^[\x21-\x7e]{1,64}$/.test(product.version))
    throw new TypeError('userAgentProduct names a product and its version');
  const userAgent = `ever-connect-sdk/${SDK_VERSION} (${product.product}/${product.version})`;
  const registryId = () => (o.registryInstanceId ? o.registryInstanceId() : null);
  const tokens = new InstanceTokens({
    now,
    onToken: o.onToken,
    acquire: async () => {
      if (!o.signer) throw new TypeError('authenticated calls need the connect key (the signer option)');
      const assertion = await signClientAssertion({
        signer: o.signer,
        registryInstanceId: registryId(),
        audience: `${issuer}${CONSTANTS.assertion_audience_path}`,
        now: now(),
      });
      const answer = (await call('instanceToken', {
        body: { grant_type: 'client_credentials', client_assertion_type: CONSTANTS.client_assertion_type, client_assertion: assertion },
      })) as { access_token: string; expires_in: number };
      return answer;
    },
  });

  function prepare(id: OperationId, input: CallInput) {
    const op: OperationSpec = OPERATIONS[id];
    let path = op.path;
    for (const name of op.pathParams) {
      const value = input.path?.[name];
      if (typeof value !== 'string' || value === '' || value.length > 256)
        throw new RequestRefusedError('invalid_parameter', [{ path: name, code: 'required' }]);
      path = path.replace(`{${name}}`, encodeURIComponent(value));
    }
    const query = new URLSearchParams();
    for (const [name, value] of Object.entries(input.query ?? {})) {
      if (value === undefined || value === null) continue;
      if (!op.query.includes(name)) throw new RequestRefusedError('invalid_parameter', [{ path: name, code: 'unknown_field' }]);
      query.set(name, String(value));
    }
    const headers: Record<string, string> = {
      accept: 'application/json, application/problem+json',
      'user-agent': userAgent,
    };
    if (op.idempotencyKey !== 'none') {
      if (input.idempotencyKey === undefined) {
        if (op.idempotencyKey === 'required') throw new RequestRefusedError('idempotency_key_required');
      } else if (!IDEMPOTENCY_KEY.test(input.idempotencyKey))
        throw new RequestRefusedError('invalid_parameter', [{ path: 'Idempotency-Key', code: 'pattern' }]);
      else headers['idempotency-key'] = input.idempotencyKey;
    }
    if (op.linkHeader !== 'none') {
      if (input.linkId === undefined) {
        if (op.linkHeader === 'required') throw new RequestRefusedError('link_required');
      } else if (!ULID.test(input.linkId)) throw new RequestRefusedError('invalid_parameter', [{ path: 'Ever-Link-Id', code: 'pattern' }]);
      else headers['ever-link-id'] = input.linkId;
    }
    if (op.conditional && input.ifNoneMatchSeq !== undefined) {
      if (!Number.isSafeInteger(input.ifNoneMatchSeq) || input.ifNoneMatchSeq < 0)
        throw new RequestRefusedError('invalid_parameter', [{ path: 'If-None-Match', code: 'range' }]);
      headers['if-none-match'] = `"${input.ifNoneMatchSeq}"`;
    }
    if (op.auth === 'person' && (typeof input.personToken !== 'string' || input.personToken === ''))
      throw new RequestRefusedError('invalid_parameter', [{ path: 'Authorization', code: 'required' }]);
    let body: Uint8Array | undefined;
    if (op.body) {
      if (input.body === undefined) {
        if (op.body.required) throw new RequestRefusedError('invalid_body', [{ path: '', code: 'required' }]);
      } else {
        const violations = schemaViolations(REQUEST_SCHEMAS, input.body, op.body.schema);
        if (violations.length > 0)
          throw new RequestRefusedError(
            'invalid_body',
            violations.map((v) => ({ path: v.path, code: v.kind })),
          );
        body = enc.encode(JSON.stringify(input.body));
        if (id === 'instanceMirrorApps' && body.length > CONSTANTS.mirror.max_bytes) throw new RequestRefusedError('body_too_large');
        headers['content-type'] = 'application/json';
      }
    } else if (input.body !== undefined) throw new RequestRefusedError('invalid_body', [{ path: '', code: 'unknown_field' }]);
    const timeoutMs =
      id === 'instancePollEvents' ? ((input.waitS ?? CONSTANTS.feed.wait_s) + 5) * 1000 : op.method === 'GET' ? readMs : writeMs;
    // Mirrored app listings may be large; every other answer is small.
    const maxResponseBytes = id === 'instanceListMirroredApps' ? 16 * MAX_RESPONSE_BYTES : MAX_RESPONSE_BYTES;
    return { op, path, query, headers, body, timeoutMs, maxResponseBytes };
  }

  async function answer(op: OperationSpec, res: WireResponse): Promise<unknown> {
    if (res.status === 304 && op.conditional) return { notModified: true } satisfies NotModified;
    if (!op.success.includes(res.status) || res.status === 304) throw problemFrom(res);
    if (res.body.length === 0) return undefined;
    try {
      return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(res.body));
    } catch {
      throw new ProblemError(res.status, 'unknown', 'the answer is not JSON', res.headers.get('x-request-id'));
    }
  }

  // The entitlement reads (rate class `instance-entitlement`): the platform answers, per installation
  // and path, a bucket of `entitlement.max_reads_per_hour` reads refilled one every
  // 3600 / max_reads_per_hour seconds (the generic cell rate algorithm). The client keeps the same
  // account per path, holds back a read the platform would refuse, and honours a 429's `Retry-After`.
  const ENTITLEMENT_WINDOW_S = 3600;
  const readInterval = ENTITLEMENT_WINDOW_S / CONSTANTS.entitlement.max_reads_per_hour;
  const readTolerance = readInterval * (CONSTANTS.entitlement.max_reads_per_hour - 1);
  const nextRead = new Map<string, number>();
  const heldUntil = new Map<string, number>();
  function rateWait(op: OperationSpec, path: string, at: number): number {
    if (op.rateLimit !== 'instance-entitlement') return 0;
    const held = (heldUntil.get(path) ?? 0) - at;
    const ahead = Math.max(nextRead.get(path) ?? at, at) - at;
    return Math.ceil(Math.max(held, ahead - readTolerance, 0));
  }
  function rateNote(op: OperationSpec, path: string, at: number, res: WireResponse): void {
    if (op.rateLimit !== 'instance-entitlement') return;
    nextRead.set(path, Math.max(nextRead.get(path) ?? at, at) + readInterval);
    if (res.status === 429) {
      const retry = Number(res.headers.get('retry-after'));
      heldUntil.set(path, at + (Number.isSafeInteger(retry) && retry > 0 ? retry : readInterval));
    }
  }

  /** Sends one operation of the table. */
  async function call<Id extends OperationId>(id: Id, input: CallInput<RequestBody<Id>> = {}): Promise<ResponseBody<Id> | NotModified> {
    const p = prepare(id, input as CallInput);
    // No Registry id: refuse before anything goes out (the token would need one).
    if (p.op.auth === 'instance' && !tokens.held && !registryId()) throw new NotConnectedError();
    const wait = rateWait(p.op, p.path, now());
    if (wait > 0) throw new RateLimitedError(wait);
    for (let attempt = 0; ; attempt += 1) {
      const headers: Record<string, string> = { ...p.headers, 'x-request-id': randomUUID() };
      if (p.op.auth === 'instance') headers.authorization = `Bearer ${await tokens.get()}`;
      else if (p.op.auth === 'person') headers.authorization = `Bearer ${input.personToken}`;
      const res = await send(transport, {
        method: p.op.method,
        path: p.path,
        query: p.query,
        headers,
        body: p.body,
        timeoutMs: p.timeoutMs,
        maxResponseBytes: p.maxResponseBytes,
        signal: input.signal,
      });
      rateNote(p.op, p.path, now(), res);
      if (res.status === 401 && p.op.auth === 'instance') {
        const problem = problemFrom(res);
        tokens.invalidate();
        if (problem.code === 'credential_revoked' || attempt > 0) throw problem;
        continue;
      }
      return (await answer(p.op, res)) as ResponseBody<Id> | NotModified;
    }
  }

  /** The same call, for operations that never answer 304. */
  const plain = <Id extends OperationId>(id: Id, input: CallInput<RequestBody<Id>> = {}) => call(id, input) as Promise<ResponseBody<Id>>;

  /** Sends a signed statistics report (no token, ever): the exact bytes that were signed. */
  async function sendStatsReport(signed: SignedStatsReport, signal?: AbortSignal): Promise<ResponseBody<'ingestStatsReport'>> {
    if (!(signed?.body instanceof Uint8Array)) throw new RequestRefusedError('invalid_body');
    if (signed.body.length > CONSTANTS.stats.max_bytes) throw new RequestRefusedError('body_too_large');
    const names = Object.values(CONSTANTS.stats_headers).map((n) => n.toLowerCase());
    const headers: Record<string, string> = {
      accept: 'application/json, application/problem+json',
      'user-agent': userAgent,
      'content-type': 'application/json',
      'x-request-id': randomUUID(),
    };
    for (const [name, value] of Object.entries(signed.headers)) if (names.includes(name.toLowerCase())) headers[name.toLowerCase()] = value;
    const op: OperationSpec = OPERATIONS.ingestStatsReport;
    const res = await send(transport, { method: op.method, path: op.path, headers, body: signed.body, timeoutMs: writeMs, signal });
    return (await answer(op, res)) as ResponseBody<'ingestStatsReport'>;
  }

  async function manifest(): Promise<VerifiedKeyManifest> {
    const body = await plain('get_key_manifest');
    return verifyKeyManifest(body, { unsafeRootKeys: rootKeys, issuer, now: now() });
  }

  const client = {
    baseUrl: base.toString(),
    /** The issuer documents must name (the origin of `baseUrl`, or the local override). */
    issuer,
    call,
    keys: {
      /** The key manifest, verified against the trusted roots before it is answered. */
      manifest,
      /** Fetches the manifest and builds the next key set; a refused manifest keeps `current`. */
      async refresh(current?: KeySet): Promise<KeySetUpdate> {
        const body = await plain('get_key_manifest');
        if (current) return current.update(body, { unsafeRootKeys: rootKeys, issuer, now: now() });
        return { keySet: KeySet.verify(body, { unsafeRootKeys: rootKeys, issuer, now: now() }), replaced: true, error: null };
      },
      /** The roots this client trusts. */
      rootKeys: () => rootKeys,
    },
    connect: {
      legal: () => plain('getConnectLegal'),
      redeem: (req: RequestBody<'connectRedeem'>, idempotencyKey: string) => plain('connectRedeem', { body: req, idempotencyKey }),
      completeProvisionIntent: (jti: string, req: RequestBody<'completeProvisionIntent'>) =>
        plain('completeProvisionIntent', { path: { jti }, body: req }),
    },
    instances: {
      /** Acquires the instance token now (otherwise the first call does). */
      token: async (): Promise<void> => {
        if (!registryId()) throw new NotConnectedError();
        await tokens.get();
      },
      self: () => plain('getInstanceSelf'),
      heartbeat: (req: RequestBody<'instanceHeartbeat'>) => plain('instanceHeartbeat', { body: req }),
      events: (after: string | null, opts: { waitS?: number; limit?: number; signal?: AbortSignal } = {}) =>
        plain('instancePollEvents', {
          query: { after: after ?? undefined, wait: opts.waitS, limit: opts.limit },
          waitS: opts.waitS,
          signal: opts.signal,
        }),
      ackEvents: (lastId: string) => plain('instanceAckEvents', { body: { last_id: lastId } as RequestBody<'instanceAckEvents'> }),
      entitlement: (ifNoneMatchSeq?: number) => call('instanceGetEntitlement', { ifNoneMatchSeq }),
      linkEntitlement: (linkId: string, ifNoneMatchSeq?: number) =>
        call('instanceGetLinkEntitlement', { path: { link: linkId }, ifNoneMatchSeq }),
      integrations: () => plain('instanceGetIntegrations'),
      consentUrl: (q: { integration: string; link?: string; return?: string }) => plain('instanceGetConsentUrl', { query: q }),
      setIntegration: (key: string, req: RequestBody<'instanceDisableIntegration'>) =>
        plain('instanceDisableIntegration', { path: { key }, body: req }),
      acceptIntegration: (key: string, req: RequestBody<'instanceAcceptIntegration'>, idempotencyKey: string) =>
        plain('instanceAcceptIntegration', { path: { key }, body: req, idempotencyKey }),
      statsLink: (req: RequestBody<'instanceLinkStats'>, idempotencyKey: string) =>
        plain('instanceLinkStats', { body: req, idempotencyKey }),
      tenantLinks: {
        create: (req: RequestBody<'instanceCreateTenantLink'>, idempotencyKey: string) =>
          plain('instanceCreateTenantLink', { body: req, idempotencyKey }),
        remove: (linkId: string) => plain('instanceUnlinkTenantLink', { path: { link: linkId } }),
        rekey: (linkId: string, req: RequestBody<'instanceRekeyTenantLink'>) =>
          plain('instanceRekeyTenantLink', { path: { link: linkId }, body: req }),
      },
      identifiers: {
        put: (linkId: string, req: RequestBody<'instancePutLinkIdentifiers'>) =>
          plain('instancePutLinkIdentifiers', { path: { link: linkId }, body: req }),
        remove: (linkId: string) => plain('instanceDeleteLinkIdentifiers', { path: { link: linkId } }),
      },
      oidcClient: {
        request: (req: RequestBody<'instanceRequestOidcClient'>, idempotencyKey: string) =>
          plain('instanceRequestOidcClient', { body: req, idempotencyKey }),
        get: () => plain('instanceGetOidcClient'),
      },
      personLinks: {
        create: (req: RequestBody<'instanceCreatePersonLink'>, idempotencyKey: string) =>
          plain('instanceCreatePersonLink', { body: req, idempotencyKey }),
        remove: (productUserRef: string) => plain('instanceDeletePersonLink', { path: { ref: productUserRef } }),
      },
      ack: (req: RequestBody<'instanceAckRequest'>) => plain('instanceAckRequest', { body: req }),
      orgProfile: (req: RequestBody<'instancePushOrgProfile'>, idempotencyKey: string) =>
        plain('instancePushOrgProfile', { body: req, idempotencyKey }),
      usage: (linkId: string, req: RequestBody<'instanceReportUsage'>, idempotencyKey: string) =>
        plain('instanceReportUsage', { body: req, idempotencyKey, linkId }),
      usageReadings: (linkId: string, req: RequestBody<'instanceReportUsageReadings'>, idempotencyKey: string) =>
        plain('instanceReportUsageReadings', { body: req, idempotencyKey, linkId }),
      billingLinks: {
        create: (linkId: string, req: RequestBody<'instanceCreateBillingLink'>, idempotencyKey: string) =>
          plain('instanceCreateBillingLink', { body: req, idempotencyKey, linkId }),
      },
      mirrorApps: {
        push: (batch: RequestBody<'instanceMirrorApps'>) => plain('instanceMirrorApps', { body: batch }),
        list: (cursor?: string, limit?: number) => plain('instanceListMirroredApps', { query: { cursor, limit } }),
      },
      managedOperationResult: (operationId: string, req: RequestBody<'instanceReportManagedOperationResult'>) =>
        plain('instanceReportManagedOperationResult', { path: { operation: operationId }, body: req }),
      webhooks: {
        create: (req: RequestBody<'instanceCreateWebhook'>, idempotencyKey: string) =>
          plain('instanceCreateWebhook', { body: req, idempotencyKey }),
      },
      disconnect: async (idempotencyKey: string) => {
        const out = await plain('instanceDisconnect', { idempotencyKey });
        tokens.invalidate();
        return out;
      },
      rotateKey: (req: RequestBody<'instanceRotateKey'>, idempotencyKey: string) =>
        plain('instanceRotateKey', { body: req, idempotencyKey }),
    },
    identity: {
      resolve: (req: RequestBody<'resolveIdentity'>) => plain('resolveIdentity', { body: req }),
      /** The person's context (their own Ever ID token). */
      context: (personToken: string) => plain('getMyContext', { personToken }),
      memberships: (personToken: string) => plain('listMyMemberships', { personToken }),
    },
    consent: {
      /** The in-product consent call: a step-up Ever ID token of an owner or admin of the organization. */
      setIntegrationState: (
        a: { org: string; instance: string; key: string },
        req: RequestBody<'putIntegrationState'>,
        idempotencyKey: string,
        personToken: string,
      ) => plain('putIntegrationState', { path: a, body: req, idempotencyKey, personToken }),
    },
    lookup: {
      salt: () => plain('getLookupSalt'),
      testVectors: () => plain('getLookupTestVectors'),
      query: (linkId: string, req: RequestBody<'lookupCounterparties'>) => plain('lookupCounterparties', { body: req, linkId }),
    },
    stats: {
      sendReport: sendStatsReport,
    },
    /**
     * Verifies an entitlement document for this installation: the issuer is this client's, the
     * instance its Registry id, the subject `instance:<id>` unless a link subject is given.
     */
    verifyEntitlement(
      jws: string,
      v: { keySet: KeySet; subject?: string; cached?: CachedEntitlement | null; now?: number },
    ): VerifiedEntitlement {
      const id = registryId();
      if (!id) throw new NotConnectedError();
      return verifyEntitlement(jws, {
        keySet: v.keySet,
        expectedIssuer: issuer,
        expectedInstanceId: id,
        expectedSubject: v.subject ?? `instance:${id}`,
        cached: v.cached,
        now: v.now ?? now(),
      });
    },
    /**
     * Verifies an entitlement document and owns the key-set refresh rules: on `unknown_kid` with
     * `refreshSuggested`, the key set is refreshed once (at most every 10 minutes) and the document
     * verified again; a second `unknown_kid` is final. On `manifest_expired` (keys of an expired
     * manifest verify no new document), the key set is refreshed and the document verified again.
     * Answers the result and the key set to keep (a new one when the refresh replaced it).
     */
    async verifyEntitlementRefreshing(
      jws: string,
      v: { keySet: KeySet; subject?: string; cached?: CachedEntitlement | null; now?: number },
    ): Promise<{ verified: VerifiedEntitlement; keySet: KeySet }> {
      try {
        return { verified: client.verifyEntitlement(jws, v), keySet: v.keySet };
      } catch (error) {
        if (!(error instanceof EntitlementError)) throw error;
        // An expired manifest: fetch the current one. An unknown key id the manifest does not list:
        // fetch it at most once every 10 minutes.
        const expired = error.code === 'manifest_expired';
        const unknown = error.code === 'unknown_kid' && error.refreshSuggested && v.keySet.unknownKidRefreshAllowed(v.now ?? now());
        if (!expired && !unknown) throw error;
        const update = await client.keys.refresh(v.keySet);
        if (!update.replaced) throw error;
        return { verified: client.verifyEntitlement(jws, { ...v, keySet: update.keySet }), keySet: update.keySet };
      }
    },
    toJSON: () => ({ baseUrl: base.toString() }),
    [Symbol.for('nodejs.util.inspect.custom')]: () => `EverPlatformClient { baseUrl: ${base.toString()} }`,
  };
  return client;
}

export type EverPlatformClient = ReturnType<typeof createEverPlatformClient>;
