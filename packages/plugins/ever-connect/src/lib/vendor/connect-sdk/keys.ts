// Vendored from github.com/ever-co/ever-connect-sdk@62c3fa0a5a0b1b487de860cb2b714505caeeb7bf (packages/ts/connect-sdk/src/keys.ts) by scripts/vendor-connect-sdk.mjs. Do not edit.
// @ts-nocheck: type-checked by the SDK's own strict build.
/**
 * The installation's connect key: generation, key id and a signer over a Node key.
 *
 * The signer is a key, not an identity: the Registry id (the ULID the redeem answered) goes into
 * the assertion separately, and the statistics key and id never meet a connect call. Keep the
 * statistics key separate from the connect key: rotating the connect key then never touches the
 * statistics series.
 */
import { createPrivateKey, createPublicKey, sign as edSign, generateKeyPairSync, type KeyObject } from 'node:crypto';
import { b64url, fromB64url, sha256 } from './encoding';

/** Signs bytes with an Ed25519 key the SDK never sees. */
export interface InstanceSigner {
  /** `base64url(sha256(raw public key)[0:8])`: the key id the platform derives. */
  readonly kid: string;
  /** The raw 32-byte public key (`public_jwk.x`, decoded). */
  readonly publicKeyRaw: Uint8Array;
  sign(bytes: Uint8Array): Promise<Uint8Array>;
}

/** An Ed25519 public key as a JWK. */
export interface Ed25519PublicJwk {
  readonly kty: 'OKP';
  readonly crv: 'Ed25519';
  readonly x: string;
}

/** The key id of a public key: base64url of the first 8 bytes of SHA-256 over the 32 key bytes. */
export function keyIdFromPublicJwk(jwk: { x: string }): string {
  const raw = fromB64url(jwk.x);
  if (raw?.length !== 32) throw new TypeError('not an Ed25519 public key (x is 32 bytes, base64url)');
  return b64url(sha256(raw).subarray(0, 8));
}

/** A new connect key: store `privateKeyPkcs8Der` as a secret; `publicJwk` goes into the redeem. */
export function generateInstanceKeyPair(): { publicJwk: Ed25519PublicJwk; privateKeyPkcs8Der: Uint8Array; kid: string } {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const x = publicKey.export({ format: 'jwk' }).x as string;
  return {
    publicJwk: { kty: 'OKP', crv: 'Ed25519', x },
    privateKeyPkcs8Der: new Uint8Array(privateKey.export({ format: 'der', type: 'pkcs8' })),
    kid: keyIdFromPublicJwk({ x }),
  };
}

const PKCS8_ED25519 = Uint8Array.from([0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20]);

/**
 * A signer over a Node key: a `KeyObject`, a PKCS#8 DER private key, or a 32-byte seed. Neither
 * JSON nor inspection shows more than the key id.
 */
export function makeNodeSigner(key: KeyObject | Uint8Array): InstanceSigner {
  let privateKey: KeyObject;
  if (key instanceof Uint8Array) {
    const der = key.length === 32 ? Buffer.concat([PKCS8_ED25519, key]) : Buffer.from(key);
    privateKey = createPrivateKey({ key: der, format: 'der', type: 'pkcs8' });
  } else privateKey = key;
  if (privateKey.asymmetricKeyType !== 'ed25519') throw new TypeError('an Ed25519 private key');
  const x = createPublicKey(privateKey).export({ format: 'jwk' }).x as string;
  const kid = keyIdFromPublicJwk({ x });
  const publicKeyRaw = fromB64url(x) as Uint8Array;
  return {
    kid,
    publicKeyRaw,
    sign: async (bytes: Uint8Array) => new Uint8Array(edSign(null, bytes, privateKey)),
    toJSON: () => ({ kid }),
    toString: () => `InstanceSigner(${kid})`,
  } as InstanceSigner;
}

/** The public JWK of a signer (what the redeem and the key rotation send). */
export const publicJwkOf = (signer: InstanceSigner): Ed25519PublicJwk => ({ kty: 'OKP', crv: 'Ed25519', x: b64url(signer.publicKeyRaw) });
