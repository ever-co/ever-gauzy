// Vendored from github.com/ever-co/ever-connect-sdk@62c3fa0a5a0b1b487de860cb2b714505caeeb7bf (packages/ts/connect-sdk/src/errors.ts) by scripts/vendor-connect-sdk.mjs. Do not edit.
// @ts-nocheck: type-checked by the SDK's own strict build.
/**
 * The SDK's errors. Every message names a code and, where useful, a field path; none carries a
 * token, an assertion, a key, a document or a claim value, so any of them may be logged.
 */

/** A non-2xx answer of Ever Platform, parsed from its `application/problem+json` body. */
export class ProblemError extends Error {
  override readonly name = 'ProblemError';
  constructor(
    /** The HTTP status. */
    readonly status: number,
    /** The problem code, or `unknown` when the body is not a problem document. */
    readonly code: string,
    readonly detail?: string,
    /** The request id the platform echoes (`instance`), for support requests. */
    readonly instance?: string | null,
    readonly errors?: readonly { path: string; code: string; message: string }[],
    /** Seconds the platform asks to wait (`Retry-After`). */
    readonly retryAfterS?: number,
  ) {
    super(`Ever Platform answered ${status} ${code}`);
  }
}

/** A request the client refuses to send: outside the configured origin, or to an insecure origin. */
export class EgressRefusedError extends Error {
  override readonly name = 'EgressRefusedError';
  constructor(readonly code: 'absolute_url' | 'insecure_base_url' | 'redirect') {
    super(`request refused: ${code}`);
  }
}

/** A call that needs the installation's Registry id before it has one (before the first redeem). */
export class NotConnectedError extends Error {
  override readonly name = 'NotConnectedError';
  readonly code = 'no_registry_instance_id';
  constructor() {
    super('the installation is not connected yet (no Registry id)');
  }
}

/** An answer larger than the client reads (the read stopped at the limit). */
export class ResponseTooLargeError extends Error {
  override readonly name = 'ResponseTooLargeError';
  constructor(readonly limitBytes: number) {
    super(`answer larger than ${limitBytes} bytes`);
  }
}

/** A request that did not finish in time. */
export class TimeoutError extends Error {
  override readonly name = 'TimeoutError';
  constructor(readonly timeoutMs: number) {
    super(`no answer within ${timeoutMs} ms`);
  }
}

/** A client assertion that cannot be built. */
export class AssertionError extends Error {
  override readonly name = 'AssertionError';
  constructor(readonly code: 'not_a_registry_id') {
    super(`client assertion refused: ${code}`);
  }
}

/**
 * A call the client holds back because the platform would refuse it for its rate class (the
 * entitlement reads: `entitlement.max_reads_per_hour` per path, or the `Retry-After` of a 429):
 * nothing was sent. Retry after `retryAfterS` seconds.
 */
export class RateLimitedError extends Error {
  override readonly name = 'RateLimitedError';
  readonly code = 'rate_limited';
  constructor(readonly retryAfterS: number) {
    super(`held back before sending: rate_limited (retry after ${retryAfterS} s)`);
  }
}

/** A request the client refuses before any I/O: a missing idempotency key, a body that breaks its schema, a body over its limit. */
export class RequestRefusedError extends Error {
  override readonly name = 'RequestRefusedError';
  constructor(
    readonly code: 'idempotency_key_required' | 'invalid_body' | 'body_too_large' | 'link_required' | 'invalid_parameter',
    readonly errors: readonly { path: string; code: string }[] = [],
  ) {
    super(
      `request refused before sending: ${code}${errors.length ? ` (${errors.map((e) => `${e.path || '(body)'} ${e.code}`).join(', ')})` : ''}`,
    );
  }
}

/** The key manifest's verification codes, in the order the checks run. */
export type KeyManifestErrorCode =
  | 'schema_violation'
  | 'malformed'
  | 'bad_typ'
  | 'bad_alg'
  | 'unknown_root'
  | 'bad_signature'
  | 'issuer_mismatch'
  | 'manifest_not_yet_valid'
  | 'manifest_expired'
  | 'keys_sha256_mismatch';

/** A key manifest that does not verify: no key of it is trusted. */
export class KeyManifestError extends Error {
  override readonly name = 'KeyManifestError';
  constructor(readonly code: KeyManifestErrorCode) {
    super(`key manifest refused: ${code}`);
  }
}

/** The entitlement document's verification codes, in the order the checks run. */
export type EntitlementErrorCode =
  | 'malformed'
  | 'bad_typ'
  | 'bad_alg'
  | 'manifest_expired'
  | 'unknown_kid'
  | 'bad_signature'
  | 'schema_violation'
  | 'issuer_mismatch'
  | 'audience_mismatch'
  | 'instance_mismatch'
  | 'subject_mismatch'
  | 'iat_in_future'
  | 'nbf_in_future'
  | 'entitlement_stale';

/**
 * An entitlement document that does not verify. Keep the previous document. `refreshSuggested`
 * (an unknown `kid`): refresh the key set once (at most every 10 minutes) and verify again; a
 * second `unknown_kid` is final.
 */
export class EntitlementError extends Error {
  override readonly name = 'EntitlementError';
  constructor(
    readonly code: EntitlementErrorCode,
    readonly refreshSuggested = false,
    /** For `schema_violation`: the JSON pointer of the first field that breaks the schema. */
    readonly path?: string,
  ) {
    super(`entitlement document refused: ${code}`);
  }
}

/** An identifier that cannot be checked: it is never hashed or sent. */
export class LookupInputError extends Error {
  override readonly name = 'LookupInputError';
  readonly code = 'cannot_be_checked';
  constructor(readonly reason: 'empty' | 'no_country' | 'no_at_sign' | 'bad_domain' | 'unknown_kind') {
    super(`identifier cannot be checked (${reason})`);
  }
}

/** A lookup test vector the SDK does not reproduce. */
export class LookupVectorError extends Error {
  override readonly name = 'LookupVectorError';
  constructor(
    readonly index: number,
    readonly field: 'normalized' | 'hash',
  ) {
    super(`lookup test vector ${index}: the ${field} differs`);
  }
}

/** A usage report that breaks `ever.usage.v1`. */
export class UsageValidationError extends Error {
  override readonly name = 'UsageValidationError';
  constructor(readonly errors: readonly { path: string; code: string }[]) {
    super(`usage report refused: ${errors.map((e) => `${e.path || '(body)'} ${e.code}`).join(', ')}`);
  }
}
