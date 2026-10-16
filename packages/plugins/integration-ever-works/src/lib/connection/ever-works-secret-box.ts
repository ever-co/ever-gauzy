import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';
import { isKnownDefaultSecret } from '@gauzy/contracts';

type Env = Record<string, string | undefined>;

/** What a stored secret is for. Bound into the ciphertext, so one cannot be read as another. */
export type EverWorksSecretPurpose = 'api_key' | 'webhook_secret';

/**
 * Where the encryption key comes from: `k` = `ENCRYPTION_KEY`, `j` = a key derived from `JWT_SECRET`
 * (only when `ENCRYPTION_KEY` is unset and `JWT_SECRET` is not a published default).
 */
export type EverWorksKeySource = 'k' | 'j';

/** Why secrets cannot be stored safely, or `null` when they can. */
export type EverWorksKeyProblem = 'encryption_key_malformed' | 'encryption_key_default' | 'no_secret' | 'jwt_secret_default';

/** A secret that cannot be stored or read. Never carries key material, a secret or a ciphertext. */
export class EverWorksSecretError extends Error {
	constructor(readonly code: EverWorksKeyProblem | 'malformed' | 'material_missing' | 'unreadable') {
		super(EverWorksSecretError.describe(code));
		this.name = 'EverWorksSecretError';
	}

	private static describe(code: EverWorksSecretError['code']): string {
		switch (code) {
			case 'encryption_key_malformed':
				return 'ENCRYPTION_KEY is set but is not a base64-encoded 32-byte key; the Ever Works key cannot be stored. Generate one with `openssl rand -base64 32`.';
			case 'encryption_key_default':
				return 'ENCRYPTION_KEY is a value published in the Gauzy repository; the Ever Works key cannot be stored safely.';
			case 'no_secret':
				return 'Set ENCRYPTION_KEY (a base64-encoded 32-byte key) on the API before connecting Ever Works: its key is stored encrypted.';
			case 'jwt_secret_default':
				return 'ENCRYPTION_KEY is unset and JWT_SECRET is a value published in the Gauzy repository; set ENCRYPTION_KEY before connecting Ever Works.';
			default:
				return `A stored Ever Works secret cannot be read (${code}).`;
		}
	}
}

const PREFIX = 'ew1';
const HKDF_SALT = Buffer.from('gauzy-ever-works', 'utf8');
const HKDF_INFO = 'gauzy-ever-works-secret-v1';
const REQUIRED_KEY_BYTES = 32;

const set = (value: string | undefined): value is string => typeof value === 'string' && value.trim() !== '';

/**
 * Encrypts the Ever Works integration key and webhook signing secret for storage (AES-256-GCM), the
 * mechanism of `ai-provider-credential-encryption.service.ts` with three additions:
 *
 * - the key is `ENCRYPTION_KEY` (a base64 32-byte key, the variable Gauzy's encryption services read).
 *   A malformed or published value is refused rather than replaced. Only when it is unset, a key derived
 *   (HKDF-SHA256) from a `JWT_SECRET` that is not a published default is used, as Ever Connect does; with
 *   neither, nothing is stored. Never a random per-process key: a stored key must survive a restart;
 * - the ciphertext is bound to its purpose and to its connection (`aad`), so a stored value cannot be
 *   moved to another column or another tenant's row and still decrypt;
 * - the stored form records the key source (`ew1:<k|j>:<iv>:<tag>:<ciphertext>`, base64url), so a value
 *   stored under `JWT_SECRET` can still be read after `ENCRYPTION_KEY` is set (and is re-encrypted then).
 *
 * Plaintext secrets are never logged and never returned by any route.
 */
export class EverWorksSecretBox {
	constructor(private readonly env: Env = process.env) {}

	/** Why secrets cannot be stored with the secrets of this process, or `null`. */
	problem(): EverWorksKeyProblem | null {
		const raw = this.env['ENCRYPTION_KEY'];
		if (set(raw)) {
			if (isKnownDefaultSecret(raw)) return 'encryption_key_default';
			return Buffer.from(raw.trim(), 'base64').length === REQUIRED_KEY_BYTES ? null : 'encryption_key_malformed';
		}
		if (!set(this.env['JWT_SECRET'])) return 'no_secret';
		return isKnownDefaultSecret(this.env['JWT_SECRET']) ? 'jwt_secret_default' : null;
	}

	/** Whether secrets can be stored now. */
	usable(): boolean {
		return this.problem() === null;
	}

	/** The source the next value is stored under. Throws when nothing can be stored. */
	private preferredSource(): EverWorksKeySource {
		const problem = this.problem();
		if (problem) throw new EverWorksSecretError(problem);
		return set(this.env['ENCRYPTION_KEY']) ? 'k' : 'j';
	}

	private material(source: EverWorksKeySource): Buffer | null {
		if (source === 'k') {
			const raw = this.env['ENCRYPTION_KEY'];
			if (!set(raw) || isKnownDefaultSecret(raw)) return null;
			const key = Buffer.from(raw.trim(), 'base64');
			if (key.length !== REQUIRED_KEY_BYTES) return null;
			return Buffer.from(hkdfSync('sha256', key, HKDF_SALT, Buffer.from(HKDF_INFO, 'utf8'), 32));
		}
		const raw = this.env['JWT_SECRET'];
		if (!set(raw) || isKnownDefaultSecret(raw)) return null;
		return Buffer.from(hkdfSync('sha256', Buffer.from(raw, 'utf8'), HKDF_SALT, Buffer.from(HKDF_INFO, 'utf8'), 32));
	}

	private static aad(purpose: EverWorksSecretPurpose, connectionId: string): Buffer {
		return Buffer.from(`ever_works:${purpose}:${connectionId}`, 'utf8');
	}

	/** Encrypts `plain` for the given purpose and connection. */
	seal(plain: string, purpose: EverWorksSecretPurpose, connectionId: string): string {
		const source = this.preferredSource();
		const key = this.material(source) as Buffer;
		const iv = randomBytes(12);
		const cipher = createCipheriv('aes-256-gcm', key, iv);
		cipher.setAAD(EverWorksSecretBox.aad(purpose, connectionId));
		const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
		const tag = cipher.getAuthTag();
		return [PREFIX, source, iv.toString('base64url'), tag.toString('base64url'), ciphertext.toString('base64url')].join(':');
	}

	/** The source a stored value was encrypted with, or `null` when it is not one of ours. */
	static sourceOf(blob: string | null | undefined): EverWorksKeySource | null {
		const parts = typeof blob === 'string' ? blob.split(':') : [];
		return parts.length === 5 && parts[0] === PREFIX && (parts[1] === 'k' || parts[1] === 'j') ? parts[1] : null;
	}

	/** Whether a stored value should be sealed again (stored under `JWT_SECRET` while `ENCRYPTION_KEY` is now usable). */
	needsReseal(blob: string | null | undefined): boolean {
		return EverWorksSecretBox.sourceOf(blob) === 'j' && this.usable() && set(this.env['ENCRYPTION_KEY']);
	}

	/** Decrypts a stored value. Throws {@link EverWorksSecretError} (fails closed) when it cannot. */
	open(blob: string, purpose: EverWorksSecretPurpose, connectionId: string): string {
		const source = EverWorksSecretBox.sourceOf(blob);
		if (!source) throw new EverWorksSecretError('malformed');
		const [, , ivText, tagText, ciphertextText] = blob.split(':');
		const key = this.material(source);
		if (!key) throw new EverWorksSecretError('material_missing');
		try {
			// A full 16-byte tag only: a truncated tag would make a forgery cheaper.
			const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivText, 'base64url'), { authTagLength: 16 });
			decipher.setAAD(EverWorksSecretBox.aad(purpose, connectionId));
			decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
			return Buffer.concat([decipher.update(Buffer.from(ciphertextText, 'base64url')), decipher.final()]).toString('utf8');
		} catch {
			throw new EverWorksSecretError('unreadable');
		}
	}
}
