import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';
import { isKnownDefaultSecret } from '@gauzy/contracts';

type Env = Record<string, string | undefined>;

/** What a stored secret is for. Bound into the ciphertext, so one cannot be read as another. */
export type InboxSecretPurpose = 'provider_config';

/**
 * Where the encryption key comes from: `k` = `ENCRYPTION_KEY`, `j` = a key derived from `JWT_SECRET` (only when
 * `ENCRYPTION_KEY` is unset and `JWT_SECRET` is not a published default).
 */
export type InboxKeySource = 'k' | 'j';

/** Why secrets cannot be stored safely, or `null` when they can. */
export type InboxKeyProblem =
	'encryption_key_malformed' | 'encryption_key_default' | 'no_secret' | 'jwt_secret_default';

/** A secret that cannot be stored or read. Never carries key material, a secret or a ciphertext. */
export class InboxSecretError extends Error {
	constructor(readonly code: InboxKeyProblem | 'malformed' | 'material_missing' | 'unreadable') {
		super(InboxSecretError.describe(code));
		this.name = 'InboxSecretError';
	}

	private static describe(code: InboxSecretError['code']): string {
		switch (code) {
			case 'encryption_key_malformed':
				return 'ENCRYPTION_KEY is set but is not a base64-encoded 32-byte key; provider credentials cannot be stored. Generate one with `openssl rand -base64 32`.';
			case 'encryption_key_default':
				return 'ENCRYPTION_KEY is a value published in the Gauzy repository; provider credentials cannot be stored safely.';
			case 'no_secret':
				return 'Set ENCRYPTION_KEY (a base64-encoded 32-byte key) on the API before adding an email provider account: its credentials are stored encrypted.';
			case 'jwt_secret_default':
				return 'ENCRYPTION_KEY is unset and JWT_SECRET is a value published in the Gauzy repository; set ENCRYPTION_KEY before adding an email provider account.';
			default:
				return `A stored email provider credential cannot be read (${code}).`;
		}
	}
}

const PREFIX = 'ib1';
const HKDF_SALT = Buffer.from('gauzy-inbox', 'utf8');
const HKDF_INFO = 'gauzy-inbox-secret-v1';
const REQUIRED_KEY_BYTES = 32;

const set = (value: string | undefined): value is string => typeof value === 'string' && value.trim() !== '';

/**
 * Encrypts email provider credentials for storage (AES-256-GCM): the scheme of the Ever Works integration's
 * `EverWorksSecretBox`, with its own key derivation, so a value of one can never be read as the other.
 *
 * - The key is `ENCRYPTION_KEY` (a base64 32-byte key). A malformed or published value is refused rather than
 *   replaced. Only when it is unset, a key derived (HKDF-SHA256) from a `JWT_SECRET` that is not a published
 *   default is used; with neither, nothing is stored. Never a random per-process key: a stored credential must
 *   survive a restart.
 * - The ciphertext is bound to its purpose and to its row (`aad`), so a stored value cannot be moved to another
 *   column or another tenant's row and still decrypt.
 * - The stored form records the key source (`ib1:<k|j>:<iv>:<tag>:<ciphertext>`, base64url), so a value stored
 *   under `JWT_SECRET` can still be read after `ENCRYPTION_KEY` is set.
 *
 * Plaintext secrets are never logged and never returned by any route.
 */
export class InboxSecretBox {
	constructor(private readonly env: Env = process.env) {}

	/** Why secrets cannot be stored with the secrets of this process, or `null`. */
	problem(): InboxKeyProblem | null {
		const raw = this.env['ENCRYPTION_KEY'];
		if (set(raw)) {
			if (isKnownDefaultSecret(raw)) return 'encryption_key_default';
			return Buffer.from(raw.trim(), 'base64').length === REQUIRED_KEY_BYTES ? null : 'encryption_key_malformed';
		}
		if (!set(this.env['JWT_SECRET'])) return 'no_secret';
		return isKnownDefaultSecret(this.env['JWT_SECRET'] as string) ? 'jwt_secret_default' : null;
	}

	/** Whether secrets can be stored now. */
	usable(): boolean {
		return this.problem() === null;
	}

	private preferredSource(): InboxKeySource {
		const problem = this.problem();
		if (problem) throw new InboxSecretError(problem);
		return set(this.env['ENCRYPTION_KEY']) ? 'k' : 'j';
	}

	private material(source: InboxKeySource): Buffer | null {
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

	private static aad(purpose: InboxSecretPurpose, rowId: string): Buffer {
		return Buffer.from(`inbox:${purpose}:${rowId}`, 'utf8');
	}

	/** Encrypts `plain` for the given purpose and row. */
	seal(plain: string, purpose: InboxSecretPurpose, rowId: string): string {
		const source = this.preferredSource();
		const key = this.material(source) as Buffer;
		const iv = randomBytes(12);
		const cipher = createCipheriv('aes-256-gcm', key, iv);
		cipher.setAAD(InboxSecretBox.aad(purpose, rowId));
		const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
		const tag = cipher.getAuthTag();
		return [
			PREFIX,
			source,
			iv.toString('base64url'),
			tag.toString('base64url'),
			ciphertext.toString('base64url')
		].join(':');
	}

	/** The source a stored value was encrypted with, or `null` when it is not one of ours. */
	static sourceOf(blob: string | null | undefined): InboxKeySource | null {
		const parts = typeof blob === 'string' ? blob.split(':') : [];
		return parts.length === 5 && parts[0] === PREFIX && (parts[1] === 'k' || parts[1] === 'j') ? parts[1] : null;
	}

	/** Decrypts a stored value. Throws {@link InboxSecretError} (fails closed) when it cannot. */
	open(blob: string, purpose: InboxSecretPurpose, rowId: string): string {
		const source = InboxSecretBox.sourceOf(blob);
		if (!source) throw new InboxSecretError('malformed');
		const [, , ivText, tagText, ciphertextText] = blob.split(':');
		const key = this.material(source);
		if (!key) throw new InboxSecretError('material_missing');
		try {
			// A full 16-byte tag only: a truncated tag would make a forgery cheaper.
			const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivText as string, 'base64url'), {
				authTagLength: 16
			});
			decipher.setAAD(InboxSecretBox.aad(purpose, rowId));
			decipher.setAuthTag(Buffer.from(tagText as string, 'base64url'));
			return Buffer.concat([
				decipher.update(Buffer.from(ciphertextText as string, 'base64url')),
				decipher.final()
			]).toString('utf8');
		} catch {
			throw new InboxSecretError('unreadable');
		}
	}
}
