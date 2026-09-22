import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { generateEncryptionKey } from '@gauzy/utils';

/** AES-256 requires exactly a 32-byte key. */
const REQUIRED_KEY_BYTES = 32;

/**
 * Encryption algorithm — identical to the core `EncryptionService`
 * (`packages/core/src/lib/common/encryption/encryption.service.ts`).
 */
export const AI_CREDENTIAL_ENCRYPTION_ALGORITHM = 'aes-256-gcm';

/**
 * AiProviderCredentialEncryptionService
 *
 * Encrypts/decrypts BYOK provider API keys at rest. This mirrors the core
 * `EncryptionService` mechanism exactly (AES-256-GCM, random 16-byte IV,
 * output format `{ivHex}:{authTagHex}:{cipherHex}`), keyed by the
 * **`ENCRYPTION_KEY`** environment variable — a base64-encoded 32-byte key
 * (generate one with `generateEncryptionKey()` from `@gauzy/utils`).
 *
 * The core service is not part of the `@gauzy/core` public API, so the same
 * mechanism is replicated here rather than inventing a new one. Both read the
 * same `ENCRYPTION_KEY` secret, so values remain interoperable.
 *
 * When `ENCRYPTION_KEY` is not set, a temporary per-process key is generated
 * (same behavior as the core service) — stored credentials will NOT survive a
 * restart in that case, so always set `ENCRYPTION_KEY` in production.
 */
@Injectable()
export class AiProviderCredentialEncryptionService {
	private readonly logger = new Logger(AiProviderCredentialEncryptionService.name);
	private readonly algorithm = AI_CREDENTIAL_ENCRYPTION_ALGORITHM;
	private readonly key: Buffer;

	/**
	 * Set when `ENCRYPTION_KEY` is present but not a valid base64-encoded
	 * 32-byte key. We deliberately do NOT fall back to a temporary key in
	 * that case — silently encrypting with a different key than the operator
	 * configured would hide the misconfiguration and strand the data. Every
	 * encrypt/decrypt instead fails with this message (surfaced to the UI).
	 */
	private readonly keyError: string | null = null;

	constructor() {
		if (process.env.ENCRYPTION_KEY) {
			this.key = Buffer.from(process.env.ENCRYPTION_KEY, 'base64');
			if (this.key.length !== REQUIRED_KEY_BYTES) {
				this.keyError =
					`ENCRYPTION_KEY is invalid: it must be a base64-encoded ${REQUIRED_KEY_BYTES}-byte key ` +
					`(decoded ${this.key.length} bytes). Generate one with generateEncryptionKey() from ` +
					`@gauzy/utils or \`openssl rand -base64 32\`.`;
				this.logger.error(this.keyError);
			}
		} else {
			this.logger.warn(
				'ENCRYPTION_KEY is not set. Generating a temporary key for this session. ' +
					'Stored AI provider credentials will not be readable after a restart!'
			);
			// Generate a random key for this session
			this.key = Buffer.from(generateEncryptionKey(32), 'base64');
		}
	}

	/** Throws a clear, user-visible error when the configured key is unusable. */
	private assertUsableKey(): void {
		if (this.keyError) {
			throw new ServiceUnavailableException(this.keyError);
		}
	}

	/**
	 * Encrypts a plaintext secret using AES-256-GCM.
	 *
	 * A random initialization vector (IV) is generated per call; the cipher
	 * text is combined with the IV and the authentication tag to guarantee
	 * both confidentiality and integrity.
	 *
	 * @param {string} text - The plaintext secret to encrypt.
	 * @returns {string} The encrypted data in the format `{ivHex}:{authTagHex}:{cipherHex}`.
	 */
	encrypt(text: string): string {
		this.assertUsableKey();
		const iv = randomBytes(16); // Generate a random initialization vector
		const cipher = createCipheriv(this.algorithm, this.key, iv); // Create cipher instance

		let encrypted = cipher.update(text, 'utf8', 'hex'); // Encrypt the plaintext
		encrypted += cipher.final('hex'); // Finalize encryption

		const authTag = cipher.getAuthTag(); // Get the authentication tag

		return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`; // Return combined encrypted result
	}

	/**
	 * Decrypts a value produced by {@link encrypt} back into plaintext.
	 *
	 * @param {string} text - The encrypted string in the format `{ivHex}:{authTagHex}:{cipherHex}`.
	 * @returns {string} The decrypted plaintext secret.
	 *
	 * @throws {Error} If decryption fails due to a wrong key, corrupted data, or tampering.
	 */
	decrypt(text: string): string {
		this.assertUsableKey();
		const [ivHex, authTagHex, encryptedText] = text.split(':'); // Split encrypted data into components

		const iv = Buffer.from(ivHex, 'hex'); // Convert IV from hex to buffer
		const authTag = Buffer.from(authTagHex, 'hex'); // Convert auth tag from hex to buffer

		const decipher = createDecipheriv(this.algorithm, this.key, iv); // Create decipher instance
		decipher.setAuthTag(authTag); // Set the authentication tag for integrity verification

		let decrypted = decipher.update(encryptedText, 'hex', 'utf8'); // Decrypt the cipher text
		decrypted += decipher.final('utf8'); // Finalize decryption

		return decrypted; // Return the plaintext result
	}
}
