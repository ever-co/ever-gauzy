import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';
import { isKnownDefaultSecret } from '@gauzy/contracts';

type Env = Record<string, string | undefined>;

/** Why signing secrets cannot be stored, or what went wrong reading one. Never carries key material or a secret. */
export type ChatWebhookSecretProblem = 'encryption_key_malformed' | 'encryption_key_default' | 'no_secret' | 'jwt_secret_default' | 'unreadable';

export class ChatWebhookSecretError extends Error {
	constructor(readonly code: ChatWebhookSecretProblem) {
		super(ChatWebhookSecretError.describe(code));
		this.name = 'ChatWebhookSecretError';
	}

	private static describe(code: ChatWebhookSecretProblem): string {
		switch (code) {
			case 'encryption_key_malformed':
				return 'ENCRYPTION_KEY is set but is not a base64-encoded 32-byte key; webhook signing secrets cannot be stored.';
			case 'encryption_key_default':
				return 'ENCRYPTION_KEY is a value published in the Gauzy repository; webhook signing secrets cannot be stored safely.';
			case 'no_secret':
				return 'Set ENCRYPTION_KEY (a base64-encoded 32-byte key) on the API before giving a webhook an interaction URL: its signing secret is stored encrypted.';
			case 'jwt_secret_default':
				return 'ENCRYPTION_KEY is unset and JWT_SECRET is a value published in the Gauzy repository; set ENCRYPTION_KEY before giving a webhook an interaction URL.';
			default:
				return 'The signing secret of this webhook cannot be read; rotate it.';
		}
	}
}

const PREFIX = 'cw1';
const HKDF_SALT = Buffer.from('gauzy-chat-webhook', 'utf8');
const HKDF_INFO = Buffer.from('gauzy-chat-webhook-signing-v1', 'utf8');
const KEY_BYTES = 32;

const set = (value: string | undefined): value is string => typeof value === 'string' && value.trim() !== '';

/**
 * Seals the signing secrets of chat webhooks for storage (AES-256-GCM). The platform signs every interaction
 * callback with the secret, so it must read it back: it is encrypted rather than hashed, and a copy of the database
 * alone cannot sign.
 *
 * - The key is derived (HKDF-SHA256) from `ENCRYPTION_KEY` (a base64 32-byte key); a malformed or published value is
 *   refused. Only when it is unset, from a `JWT_SECRET` that is not a published default. Never a random per-process
 *   key: a stored secret must survive a restart.
 * - The ciphertext is bound to its webhook row (`aad`), so it cannot be moved to another row and still open.
 * - The stored form names its key source (`cw1:<k|j>:<iv>:<tag>:<ciphertext>`, base64url), so a secret sealed under
 *   `JWT_SECRET` still opens after `ENCRYPTION_KEY` is set.
 */
export class ChatWebhookSecretBox {
	constructor(private readonly env: Env = process.env) {}

	/** Why secrets cannot be sealed with this process's keys, or null. */
	problem(): Exclude<ChatWebhookSecretProblem, 'unreadable'> | null {
		const raw = this.env['ENCRYPTION_KEY'];
		if (set(raw)) {
			if (isKnownDefaultSecret(raw)) return 'encryption_key_default';
			return Buffer.from(raw.trim(), 'base64').length === KEY_BYTES ? null : 'encryption_key_malformed';
		}
		if (!set(this.env['JWT_SECRET'])) return 'no_secret';
		return isKnownDefaultSecret(this.env['JWT_SECRET'] as string) ? 'jwt_secret_default' : null;
	}

	usable(): boolean {
		return this.problem() === null;
	}

	/** Seals a secret for one webhook row. @throws ChatWebhookSecretError when no key is usable. */
	seal(plain: string, webhookId: string): string {
		const problem = this.problem();
		if (problem) throw new ChatWebhookSecretError(problem);
		const source = set(this.env['ENCRYPTION_KEY']) ? 'k' : 'j';
		const key = this.material(source) as Buffer;
		const iv = randomBytes(12);
		const cipher = createCipheriv('aes-256-gcm', key, iv);
		cipher.setAAD(ChatWebhookSecretBox.aad(webhookId));
		const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
		return [PREFIX, source, iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), ciphertext.toString('base64url')].join(':');
	}

	/** Opens a sealed secret of a webhook row. @throws ChatWebhookSecretError (`unreadable`). */
	open(sealed: string, webhookId: string): string {
		const parts = String(sealed ?? '').split(':');
		if (parts.length !== 5 || parts[0] !== PREFIX || (parts[1] !== 'k' && parts[1] !== 'j')) {
			throw new ChatWebhookSecretError('unreadable');
		}
		const key = this.material(parts[1]);
		if (!key) throw new ChatWebhookSecretError('unreadable');
		try {
			const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(parts[2], 'base64url'));
			decipher.setAAD(ChatWebhookSecretBox.aad(webhookId));
			decipher.setAuthTag(Buffer.from(parts[3], 'base64url'));
			return Buffer.concat([decipher.update(Buffer.from(parts[4], 'base64url')), decipher.final()]).toString('utf8');
		} catch {
			throw new ChatWebhookSecretError('unreadable');
		}
	}

	private material(source: 'k' | 'j'): Buffer | null {
		const raw = source === 'k' ? this.env['ENCRYPTION_KEY'] : this.env['JWT_SECRET'];
		if (!set(raw) || isKnownDefaultSecret(raw)) return null;
		const input = source === 'k' ? Buffer.from(raw.trim(), 'base64') : Buffer.from(raw, 'utf8');
		if (source === 'k' && input.length !== KEY_BYTES) return null;
		return Buffer.from(hkdfSync('sha256', input, HKDF_SALT, HKDF_INFO, KEY_BYTES));
	}

	private static aad(webhookId: string): Buffer {
		return Buffer.from(`chat-webhook:signing:${webhookId}`, 'utf8');
	}
}
