// Vendored from github.com/ever-co/ever-connect-sdk@62c3fa0a5a0b1b487de860cb2b714505caeeb7bf (packages/ts/connect-sdk/src/assertion.ts) by scripts/vendor-connect-sdk.mjs. Do not edit.
// @ts-nocheck: type-checked by the SDK's own strict build.
/**
 * The client assertion (RFC 7523) an installation signs with its connect key to get an instance
 * token, and the subject hash Ever Platform sends instead of an Ever ID subject.
 */
import { createHash, randomBytes } from 'node:crypto';
import { CONSTANTS } from '../connect-contracts';
import { b64url, sha256Hex, ULID } from './encoding';
import { AssertionError, NotConnectedError } from './errors';
import { signJws } from './jws';
import type { InstanceSigner } from './keys';

/** Options of {@link signClientAssertion}. */
export interface ClientAssertionOptions {
  readonly signer: InstanceSigner;
  /** The Registry id the redeem answered (`instance_id`); null before the first redeem. */
  readonly registryInstanceId: string | null | undefined;
  /** `<API origin>/v1/instances/token`. */
  readonly audience: string;
  /** Lifetime, capped at 300 s. */
  readonly ttlS?: number;
  /** Unix seconds. */
  readonly now?: number;
  /** The assertion id; default 16 random bytes (base64url). Fixed only in tests: the platform refuses a replayed id. */
  readonly jti?: string;
}

/**
 * The RFC 7523 client assertion for `issueInstanceToken`: header `{alg: EdDSA, kid, typ: JWT}`,
 * claims `iss = sub =` the Registry id, `aud`, a random `jti`, `iat` and `exp = iat + min(ttl, 300)`,
 * written in name order (the platform's own signer writes the same bytes).
 * Refuses before signing when no Registry id exists yet, and when the id is not a ULID (the
 * anonymous statistics id, a UUID, never authenticates).
 */
export async function signClientAssertion(o: ClientAssertionOptions): Promise<string> {
  const id = o.registryInstanceId;
  if (id === null || id === undefined || id === '') throw new NotConnectedError();
  if (!ULID.test(id)) throw new AssertionError('not_a_registry_id');
  const iat = Math.floor(o.now ?? Date.now() / 1000);
  const ttl = Math.min(Math.max(1, Math.floor(o.ttlS ?? CONSTANTS.assertion_max_ttl_s)), CONSTANTS.assertion_max_ttl_s);
  return signJws(
    (bytes) => o.signer.sign(bytes),
    { kid: o.signer.kid, typ: CONSTANTS.client_assertion_typ },
    { aud: o.audience, exp: iat + ttl, iat, iss: id, jti: o.jti ?? b64url(randomBytes(16)), sub: id },
  );
}

/**
 * The hash Ever Platform sends instead of an Ever ID subject (`subject_hash` of
 * `ever.registry.person.deletion_requested`): lower-case hex SHA-256 of `<issuer>#<subject>`.
 */
export const subjectHash = (issuer: string, subject: string): string => sha256Hex(`${issuer}#${subject}`);

/** The RFC 7638 thumbprint of an Ed25519 public key (`cnf.jkt` of a key rotation proof). */
export const jwkThumbprint = (x: string): string =>
  b64url(createHash('sha256').update(`{"crv":"Ed25519","kty":"OKP","x":"${x}"}`).digest());

/** Options of {@link signKeyRotation}. */
export interface KeyRotationOptions {
  /** The connect key in use now. */
  readonly current: InstanceSigner;
  /** The connect key to install. */
  readonly next: InstanceSigner;
  readonly registryInstanceId: string | null | undefined;
  /** The issuer (the API origin): the proofs are for `<issuer>/v1/instances/me/keys`. */
  readonly issuer: string;
  /** Unix seconds. */
  readonly now?: number;
}

/**
 * The body of a connect-key rotation: the new public key and two proofs, one signed with the
 * current key and one with the new key, each a client assertion for the rotation endpoint that
 * binds the new key (`cnf.jkt`), each with its own `jti`. An instance token alone never rotates a
 * key. The statistics key is not involved: rotating the connect key never changes the statistics
 * identity.
 */
export async function signKeyRotation(o: KeyRotationOptions) {
  const id = o.registryInstanceId;
  if (id === null || id === undefined || id === '') throw new NotConnectedError();
  if (!ULID.test(id)) throw new AssertionError('not_a_registry_id');
  const x = b64url(o.next.publicKeyRaw);
  const iat = Math.floor(o.now ?? Date.now() / 1000);
  const aud = `${new URL(o.issuer).origin}/v1/instances/me/keys`;
  const proof = (signer: InstanceSigner) =>
    signJws(
      (bytes) => signer.sign(bytes),
      { kid: signer.kid, typ: CONSTANTS.client_assertion_typ },
      {
        aud,
        cnf: { jkt: jwkThumbprint(x) },
        exp: iat + CONSTANTS.assertion_max_ttl_s,
        iat,
        iss: id,
        jti: b64url(randomBytes(16)),
        sub: id,
      },
    );
  return {
    public_jwk: { kty: 'OKP' as const, crv: 'Ed25519' as const, x },
    current_key_proof: await proof(o.current),
    new_key_proof: await proof(o.next),
  };
}
