import {
	createCipheriv,
	createDecipheriv,
	createHash,
	createPrivateKey,
	createPublicKey,
	generateKeyPairSync,
	hkdfSync,
	KeyObject,
	randomBytes,
	sign as edSign
} from 'node:crypto';
import { isKnownDefaultSecret } from '@gauzy/contracts';

/**
 * The private keys of this installation are stored encrypted (AES-256-GCM). The encryption key is
 * derived with HKDF-SHA256 from, in this order:
 *
 * 1. `ENCRYPTION_KEY` (the variable Gauzy's encryption service reads), when it is set;
 * 2. `JWT_SECRET`, when it is set (any value, a published default included: the statistics key
 *    authorizes nothing but anonymous reports, and the settings page warns about it);
 * 3. a fixed value from this public source, when neither is set (development, `DEMO=true` and
 *    `ALLOW_INSECURE_JWT_SECRET=true`; any other production start refuses to run without
 *    `JWT_SECRET`); the settings page warns about it.
 *
 * A key stored under the fixed value is stored again under `JWT_SECRET` or `ENCRYPTION_KEY` once one
 * of them is set, and one stored under `JWT_SECRET` again under `ENCRYPTION_KEY`.
 *
 * Gauzy's own encryption service is deliberately not used: when `ENCRYPTION_KEY` is unset it makes
 * a random key per process, so a key stored with it could not be read after a restart.
 *
 * A stored key is `v1:<source>:<iv>:<tag>:<ciphertext>` (base64url), where `<source>` names the
 * variable the encryption key came from (`k` ENCRYPTION_KEY, `j` JWT_SECRET, `n` none). The
 * ciphertext is bound to what it holds (`stats`, `connect`, ...), so one cannot be swapped for another.
 */
export type KeyMaterialSource = 'k' | 'j' | 'n';

/**
 * What a stored secret is for: the statistics key, the Ever Platform connect key, or a document the
 * Ever Platform connection keeps (an entitlement document, an integration's configuration). The
 * purpose is bound into the ciphertext, so one cannot be read as another.
 */
export type KeyPurpose = 'stats' | 'connect' | 'entitlement' | 'integration_config';

/** Shown on the settings page while the stored keys are not protected by `ENCRYPTION_KEY`. */
export type KeyWarning = 'encryption_key_unset' | 'jwt_secret_default' | 'no_secret';

/** A stored key that cannot be read. Never carries key material or a secret. */
export class EverInstanceKeyError extends Error {
	constructor(readonly code: 'malformed' | 'material_missing' | 'unreadable') {
		super(`The stored key of this installation cannot be read (${code}).`);
		this.name = 'EverInstanceKeyError';
	}
}

type Env = Record<string, string | undefined>;

const HKDF_INFO = 'ever-instance-v1';
const HKDF_SALT = Buffer.from('ever-instance', 'utf8');
const UNPROTECTED_MATERIAL = 'ever-instance:no-secret-configured';

const set = (value: string | undefined): value is string => typeof value === 'string' && value.trim() !== '';

/** The source the next key will be stored with. */
export function preferredKeySource(env: Env = process.env): KeyMaterialSource {
	if (set(env['ENCRYPTION_KEY'])) return 'k';
	if (set(env['JWT_SECRET'])) return 'j';
	return 'n';
}

/**
 * The settings page warning, or `null` when the key is protected by `ENCRYPTION_KEY`.
 *
 * It describes how the key IS stored (`stored`, the source recorded with it), not how the next one
 * would be: a key stored under the fixed value stays there until it is stored again, whatever the
 * environment says now. Without a stored key it describes the environment.
 */
export function keyWarning(env: Env = process.env, stored?: KeyMaterialSource | null): KeyWarning | null {
	const source = stored ?? preferredKeySource(env);
	if (source === 'k') return null;
	if (source === 'n') return 'no_secret';
	return isKnownDefaultSecret(env['JWT_SECRET']) ? 'jwt_secret_default' : 'encryption_key_unset';
}

function material(source: KeyMaterialSource, env: Env): Buffer | null {
	const raw = source === 'k' ? env['ENCRYPTION_KEY'] : source === 'j' ? env['JWT_SECRET'] : UNPROTECTED_MATERIAL;
	if (!set(raw)) {
		return null;
	}
	return Buffer.from(hkdfSync('sha256', Buffer.from(raw, 'utf8'), HKDF_SALT, Buffer.from(HKDF_INFO, 'utf8'), 32));
}

const aad = (purpose: KeyPurpose) => Buffer.from(`ever_instance:${purpose}`, 'utf8');

/**
 * Why this installation cannot keep the Ever Platform connect key (and the documents of that
 * connection) safely, or `null` when it can. Unlike the statistics key, the connect key authorizes
 * calls to Ever Platform, so it is stored only under `ENCRYPTION_KEY`, or under a `JWT_SECRET` that
 * is not one of the values published in the Gauzy repository; never under the fixed fallback.
 */
export type ConnectKeyMaterialProblem = 'no_secret' | 'jwt_secret_default' | 'encryption_key_default';

export function connectKeyMaterialProblem(env: Env = process.env): ConnectKeyMaterialProblem | null {
	if (set(env['ENCRYPTION_KEY'])) {
		return isKnownDefaultSecret(env['ENCRYPTION_KEY']) ? 'encryption_key_default' : null;
	}
	if (!set(env['JWT_SECRET'])) {
		return 'no_secret';
	}
	return isKnownDefaultSecret(env['JWT_SECRET']) ? 'jwt_secret_default' : null;
}

/** Encrypts `plain` for storage. */
export function wrapKey(plain: Buffer, purpose: KeyPurpose, env: Env = process.env): string {
	const source = preferredKeySource(env);
	const key = material(source, env) as Buffer;
	const iv = randomBytes(12);
	const cipher = createCipheriv('aes-256-gcm', key, iv);
	cipher.setAAD(aad(purpose));
	const ciphertext = Buffer.concat([cipher.update(plain), cipher.final()]);
	const tag = cipher.getAuthTag();
	return ['v1', source, iv.toString('base64url'), tag.toString('base64url'), ciphertext.toString('base64url')].join(':');
}

/** The source a stored key was encrypted with, or `null` when it is not a stored key. */
export function storedKeySource(blob: string | null | undefined): KeyMaterialSource | null {
	const parts = typeof blob === 'string' ? blob.split(':') : [];
	return parts.length === 5 && parts[0] === 'v1' && ['k', 'j', 'n'].includes(parts[1]) ? (parts[1] as KeyMaterialSource) : null;
}

/** Decrypts a stored key. Throws {@link EverInstanceKeyError} (fails closed) when it cannot. */
export function unwrapKey(blob: string, purpose: KeyPurpose, env: Env = process.env): Buffer {
	const source = storedKeySource(blob);
	if (!source) {
		throw new EverInstanceKeyError('malformed');
	}
	const [, , ivText, tagText, ciphertextText] = blob.split(':');
	const key = material(source, env);
	if (!key) {
		throw new EverInstanceKeyError('material_missing');
	}
	try {
		const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivText, 'base64url'));
		decipher.setAAD(aad(purpose));
		decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
		return Buffer.concat([decipher.update(Buffer.from(ciphertextText, 'base64url')), decipher.final()]);
	} catch {
		throw new EverInstanceKeyError('unreadable');
	}
}

/** A new Ed25519 key pair: the public key as 43 base64url characters, the private key as PKCS#8 DER. */
export function generateEd25519KeyPair(): { publicKey: string; privateKeyDer: Buffer } {
	const { publicKey, privateKey } = generateKeyPairSync('ed25519');
	return {
		publicKey: publicKeyToBase64Url(publicKey),
		privateKeyDer: privateKey.export({ format: 'der', type: 'pkcs8' }) as Buffer
	};
}

/** The raw 32-byte public key as base64url without padding (43 characters). */
export function publicKeyToBase64Url(publicKey: KeyObject): string {
	const jwk = publicKey.export({ format: 'jwk' });
	if (typeof jwk.x !== 'string' || jwk.crv !== 'Ed25519') {
		throw new TypeError('not an Ed25519 public key');
	}
	return jwk.x;
}

/** The public key of a PKCS#8 DER Ed25519 private key. */
export function publicKeyOfPrivate(privateKeyDer: Buffer): string {
	return publicKeyToBase64Url(createPublicKey(createPrivateKey({ key: privateKeyDer, format: 'der', type: 'pkcs8' })));
}

/** The key id Ever Platform derives from a public key: base64url of the first 8 bytes of its SHA-256 (11 characters). */
export function keyIdOf(publicKey: string): string {
	const raw = Buffer.from(publicKey, 'base64url');
	if (raw.length !== 32 || raw.toString('base64url') !== publicKey) {
		throw new TypeError('not a base64url Ed25519 public key');
	}
	return createHash('sha256').update(raw).digest().subarray(0, 8).toString('base64url');
}

/** The Ed25519 signature (64 bytes) of exactly `bytes`. */
export function signBytes(privateKeyDer: Buffer, bytes: Uint8Array): Buffer {
	return edSign(null, bytes, createPrivateKey({ key: privateKeyDer, format: 'der', type: 'pkcs8' }));
}
