/**
 * Test-only stand-in for the Ever Platform connection plugin's `EVER_ID_TOKEN_VAULT`: AES-256-GCM with a key made
 * for this process. Excluded from the library build.
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { EverIdTokenVaultPort } from '../ports/ever-id-session-tokens.port';

export class TestTokenVault implements EverIdTokenVaultPort {
	private readonly key = randomBytes(32);
	/** `false` stands for an installation without a safe secret. */
	safe = true;

	usable(): boolean {
		return this.safe;
	}

	seal(value: string): string {
		const iv = randomBytes(12);
		const cipher = createCipheriv('aes-256-gcm', this.key, iv);
		const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
		return [
			'vault',
			'v1',
			iv.toString('base64url'),
			cipher.getAuthTag().toString('base64url'),
			ciphertext.toString('base64url')
		].join(':');
	}

	open(blob: string | null | undefined): string | null {
		const parts = typeof blob === 'string' ? blob.split(':') : [];
		if (parts.length !== 5 || parts[0] !== 'vault') {
			return null;
		}
		try {
			const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(parts[2], 'base64url'));
			decipher.setAuthTag(Buffer.from(parts[3], 'base64url'));
			return Buffer.concat([decipher.update(Buffer.from(parts[4], 'base64url')), decipher.final()]).toString(
				'utf8'
			);
		} catch {
			return null;
		}
	}
}
