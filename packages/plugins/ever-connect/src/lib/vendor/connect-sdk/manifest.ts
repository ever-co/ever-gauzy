// Vendored from github.com/ever-co/ever-connect-sdk@62c3fa0a5a0b1b487de860cb2b714505caeeb7bf (packages/ts/connect-sdk/src/manifest.ts) by scripts/vendor-connect-sdk.mjs. Do not edit.
// @ts-nocheck: type-checked by the SDK's own strict build.
/**
 * The key manifest (`GET /.well-known/ever-keys.json`): the platform's signing keys, vouched for by
 * a compact JWS signed by a root key pinned for the issuer. No key of a manifest is trusted unless
 * every check below passes; the checks run in this order and the first failure is the answer:
 *
 *   1. the body is `{manifest, keys}` under the closed `ever.key-manifest.v1` schema, every key
 *      time is a UTC time that exists, and every key is a curve point of large order  schema_violation
 *   2. `manifest` is a compact JWS (the decoding rule of `decodeJws`)                    malformed
 *   3. header `typ` is `ever-key-manifest+jwt`                                          bad_typ
 *   4. header `alg` is `EdDSA` and there is no `crit`                                   bad_alg
 *   5. header `kid` is a root pinned for the expected issuer                            unknown_root
 *   6. the root's Ed25519 signature over `header.payload` (strict)                      bad_signature
 *   7. the payload is `{iss, iat, exp, keys_sha256, root_kid}` (`iat` and `exp` I-JSON integers)
 *      with `root_kid` = header `kid`                                                     malformed
 *   8. payload `iss` is the expected issuer (an origin)                                 issuer_mismatch
 *   9. `iat <= now + 300`                                                               manifest_not_yet_valid
 *  10. `now < exp` (not for a stored manifest read back by `KeySet.restore`)              manifest_expired
 *  11. `keys_sha256` is the hex SHA-256 of the RFC 8785 canonical JSON of `keys`        keys_sha256_mismatch
 *
 * The issuer is always given: a manifest is verified for one issuer and the keys it vouches for
 * verify documents of that issuer only. A verified manifest can only come from this function.
 */
import { CONSTANTS, SCHEMAS } from '../connect-contracts';
import { isCurvePoint, isSmallOrder } from './ed25519';
import { fromB64url, sha256Hex } from './encoding';
import { KeyManifestError } from './errors';
import { canonicalJson, decodeJws, firstNonInteger, verifyEd25519 } from './jws';
import { originOf } from './local';
import { schemaViolations } from './schema';
import { parseUtcTime } from './time';

/** Seconds of clock difference tolerated on `iat` and on a key's validity window. */
export const CLOCK_SKEW_S = 300;

/** A root public key: `iss` pins it to one issuer; a root without `iss` vouches for nothing. */
export interface RootKey {
  readonly kid: string;
  readonly x: string;
  readonly iss?: string;
  readonly kty?: string;
  readonly crv?: string;
  readonly use?: string;
  readonly alg?: string;
}

/** A signing key the manifest lists. */
export interface ManifestKey {
  readonly kty: 'OKP';
  readonly crv: 'Ed25519';
  readonly kid: string;
  readonly x: string;
  readonly use: 'sig';
  readonly alg: 'EdDSA';
  readonly ever_purpose: 'assertion' | 'intent' | 'entitlement';
  readonly state: 'active' | 'previous';
  readonly not_before: string;
  readonly not_after?: string | null;
}

/** The served body of the key manifest endpoint. */
export interface KeyManifestDocument {
  readonly manifest: string;
  readonly keys: readonly ManifestKey[];
}

declare const verified: unique symbol;

/**
 * A key manifest that passed every check. Only `verifyKeyManifest` creates one: an object of the
 * same shape built elsewhere is refused wherever a verified manifest is required.
 */
export interface VerifiedKeyManifest {
  readonly [verified]: true;
  readonly keys: readonly ManifestKey[];
  readonly rootKid: string;
  /** The issuer origin the manifest was verified for (and names). */
  readonly issuer: string;
  /** Unix seconds. */
  readonly issuedAt: number;
  /** Unix seconds; the manifest is not trusted from then on. */
  readonly expiresAt: number;
  /** The body as served, for the product to store and verify again offline. */
  readonly document: KeyManifestDocument;
}

/** Options of {@link verifyKeyManifest}. */
export interface VerifyKeyManifestOptions {
  /** The issuer the manifest is for: the API origin (`EVER_PLATFORM_API_URL`). Required. */
  readonly issuer: string;
  /**
   * Roots that REPLACE the pinned `CONSTANTS.root_keys` for this call: for tests, local runs and
   * offline tools only. A product passes nothing here; the client adds extra roots for a local
   * base URL only (see `resolveRootKeys`).
   */
  readonly unsafeRootKeys?: readonly RootKey[];
  /** Unix seconds. */
  readonly now?: number;
}

const MANIFEST_SCHEMA = SCHEMAS.keyManifest as unknown as { readonly [key: string]: unknown };
const PAYLOAD_SCHEMA = (MANIFEST_SCHEMA.$defs as { payload: unknown }).payload;
const VERIFIED = new WeakSet<object>();

/** Whether `value` is a manifest `verifyKeyManifest` answered (not an object of the same shape). */
export const isVerifiedKeyManifest = (value: unknown): value is VerifiedKeyManifest =>
  value !== null && typeof value === 'object' && VERIFIED.has(value);

/** The pinned root keys of this SDK release (one per issuer; no TEST root). */
export const pinnedRootKeys = (): readonly RootKey[] => CONSTANTS.root_keys as readonly RootKey[];

/** Lower-case hex SHA-256 of the RFC 8785 canonical JSON of a key list (`keys_sha256`). */
export const keysSha256 = (keys: unknown): string => sha256Hex(canonicalJson(keys));

/** Whether a base64url public key is a curve point of large order. */
const strongKey = (x: string): boolean => {
  const raw = fromB64url(x);
  return raw?.length === 32 && isCurvePoint(raw) && !isSmallOrder(raw);
};

/** The key rules the schema cannot say: times that exist, keys of large order. */
function keysWellFormed(keys: readonly ManifestKey[]): boolean {
  return keys.every(
    (k) =>
      parseUtcTime(k.not_before) !== null &&
      (k.not_after === undefined || k.not_after === null || parseUtcTime(k.not_after) !== null) &&
      strongKey(k.x),
  );
}

/**
 * Verifies a key manifest body for one issuer. Answers the keys it vouches for, or throws
 * {@link KeyManifestError} with the code of the first failed check.
 */
export function verifyKeyManifest(body: unknown, options: VerifyKeyManifestOptions): VerifiedKeyManifest {
  return verify(body, options, false);
}

/**
 * The same checks for a manifest read back from storage, except its `exp`: reading a stored key
 * set back (a restart) is not a new verification, and the keys of an expired manifest verify no
 * new document (`manifest_expired` from the entitlement verifier). Used by `KeySet.restore` only.
 */
export function verifyStoredKeyManifest(body: unknown, options: VerifyKeyManifestOptions): VerifiedKeyManifest {
  return verify(body, options, true);
}

function verify(body: unknown, options: VerifyKeyManifestOptions, stored: boolean): VerifiedKeyManifest {
  if (!options || typeof options.issuer !== 'string') throw new TypeError('verifyKeyManifest needs the issuer (the API origin)');
  const roots = options.unsafeRootKeys ?? pinnedRootKeys();
  const now = Math.floor(options.now ?? Date.now() / 1000);
  const expected = originOf(options.issuer);

  // 1. The closed schema of the served body, and the key rules it cannot say.
  if (schemaViolations(MANIFEST_SCHEMA, body).length > 0) throw new KeyManifestError('schema_violation');
  const doc = body as KeyManifestDocument;
  if (!keysWellFormed(doc.keys)) throw new KeyManifestError('schema_violation');
  // 2. A compact JWS.
  const jws = decodeJws(doc.manifest);
  if (!jws) throw new KeyManifestError('malformed');
  const { header, payload } = jws;
  // 3-4. Type, then algorithm (before any key is looked at).
  if (header.typ !== CONSTANTS.key_manifest_typ) throw new KeyManifestError('bad_typ');
  if (header.alg !== 'EdDSA' || 'crit' in header) throw new KeyManifestError('bad_alg');
  // 5. A root pinned for this issuer: a root vouches only for the issuer it names.
  const root =
    expected === null
      ? undefined
      : roots.find(
          (r) =>
            typeof header.kid === 'string' &&
            r.kid === header.kid &&
            typeof r.iss === 'string' &&
            originOf(r.iss) === expected &&
            strongKey(r.x),
        );
  if (!root) throw new KeyManifestError('unknown_root');
  // 6. The root's signature.
  if (!verifyEd25519(root.x, jws.signingInput, jws.signature)) throw new KeyManifestError('bad_signature');
  // 7. The payload shape (`iat` and `exp` written as I-JSON integers); the payload names the root that signed it.
  if (
    schemaViolations(MANIFEST_SCHEMA, payload, PAYLOAD_SCHEMA).length > 0 ||
    firstNonInteger(jws.payloadNumbers, ['/iat', '/exp']) !== null ||
    payload.root_kid !== header.kid
  )
    throw new KeyManifestError('malformed');
  const p = payload as { iss: string; iat: number; exp: number; keys_sha256: string; root_kid: string };
  // 8. The issuer.
  if (p.iss !== expected) throw new KeyManifestError('issuer_mismatch');
  // 9-10. The validity window.
  if (p.iat > now + CLOCK_SKEW_S) throw new KeyManifestError('manifest_not_yet_valid');
  if (!stored && now >= p.exp) throw new KeyManifestError('manifest_expired');
  // 11. The served keys are the keys the root signed.
  if (keysSha256(doc.keys) !== p.keys_sha256) throw new KeyManifestError('keys_sha256_mismatch');

  // A deep, frozen copy: nothing the caller still holds can change what was verified.
  const keys = Object.freeze((JSON.parse(JSON.stringify(doc.keys)) as ManifestKey[]).map((k) => Object.freeze(k)));
  const result = Object.freeze({
    keys,
    rootKid: root.kid,
    issuer: expected,
    issuedAt: p.iat,
    expiresAt: p.exp,
    document: Object.freeze({ manifest: doc.manifest, keys }),
  }) as unknown as VerifiedKeyManifest;
  VERIFIED.add(result);
  return result;
}
