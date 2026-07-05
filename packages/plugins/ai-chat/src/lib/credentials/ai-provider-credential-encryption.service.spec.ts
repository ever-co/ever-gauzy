import { Logger } from '@nestjs/common';
import { AiProviderCredentialEncryptionService } from './ai-provider-credential-encryption.service';

describe('AiProviderCredentialEncryptionService', () => {
	let service: AiProviderCredentialEncryptionService;
	let originalEncryptionKey: string | undefined;

	beforeAll(() => {
		// The service reads ENCRYPTION_KEY (base64-encoded 32-byte key) in its
		// constructor — set a fixed, valid key before instantiation.
		originalEncryptionKey = process.env.ENCRYPTION_KEY;
		process.env.ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
		service = new AiProviderCredentialEncryptionService();
	});

	afterAll(() => {
		if (originalEncryptionKey === undefined) {
			delete process.env.ENCRYPTION_KEY;
		} else {
			process.env.ENCRYPTION_KEY = originalEncryptionKey;
		}
	});

	describe('encrypt', () => {
		it('should produce the {ivHex}:{authTagHex}:{cipherHex} format', () => {
			const encrypted = service.encrypt('sk-test-api-key');
			const parts = encrypted.split(':');
			expect(parts).toHaveLength(3);
			// 16-byte IV and 16-byte GCM auth tag → 32 hex chars each
			expect(parts[0]).toMatch(/^[0-9a-f]{32}$/);
			expect(parts[1]).toMatch(/^[0-9a-f]{32}$/);
			expect(parts[2]).toMatch(/^[0-9a-f]+$/);
		});

		it('should use a different random IV per call (same plaintext encrypts differently)', () => {
			const plaintext = 'sk-test-api-key';
			const first = service.encrypt(plaintext);
			const second = service.encrypt(plaintext);

			expect(first).not.toEqual(second);
			const [firstIv] = first.split(':');
			const [secondIv] = second.split(':');
			expect(firstIv).not.toEqual(secondIv);

			// Both ciphertexts must still decrypt to the same original value.
			expect(service.decrypt(first)).toBe(plaintext);
			expect(service.decrypt(second)).toBe(plaintext);
		});
	});

	describe('decrypt', () => {
		it('should round-trip: decrypt(encrypt(x)) === x', () => {
			const plaintext = 'sk-ant-api03-super-secret-key';
			expect(service.decrypt(service.encrypt(plaintext))).toBe(plaintext);
		});

		it('should round-trip unicode and special characters', () => {
			const plaintext = 'clé-secrète-😀-\'":\\-密钥';
			expect(service.decrypt(service.encrypt(plaintext))).toBe(plaintext);
		});

		it('should round-trip an empty string', () => {
			expect(service.decrypt(service.encrypt(''))).toBe('');
		});

		it('should throw on tampered ciphertext (GCM auth failure)', () => {
			const encrypted = service.encrypt('sk-test-api-key');
			const [iv, authTag, cipher] = encrypted.split(':');
			// Flip the first hex nibble of the cipher text.
			const tamperedCipher = (cipher[0] === '0' ? '1' : '0') + cipher.slice(1);
			expect(() => service.decrypt(`${iv}:${authTag}:${tamperedCipher}`)).toThrow();
		});

		it('should throw on a tampered auth tag', () => {
			const encrypted = service.encrypt('sk-test-api-key');
			const [iv, authTag, cipher] = encrypted.split(':');
			const tamperedTag = (authTag[0] === '0' ? '1' : '0') + authTag.slice(1);
			expect(() => service.decrypt(`${iv}:${tamperedTag}:${cipher}`)).toThrow();
		});

		it('should throw when decrypting with a different key', () => {
			const encrypted = service.encrypt('sk-test-api-key');

			const previousKey = process.env.ENCRYPTION_KEY;
			process.env.ENCRYPTION_KEY = Buffer.alloc(32, 9).toString('base64');
			try {
				const otherService = new AiProviderCredentialEncryptionService();
				expect(() => otherService.decrypt(encrypted)).toThrow();
			} finally {
				process.env.ENCRYPTION_KEY = previousKey;
			}
		});
	});

	describe('without ENCRYPTION_KEY (temporary per-process key)', () => {
		it('should still round-trip using a generated session key', () => {
			// Silence the "ENCRYPTION_KEY is not set" warning the constructor emits.
			const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
			const previousKey = process.env.ENCRYPTION_KEY;
			delete process.env.ENCRYPTION_KEY;
			try {
				const ephemeralService = new AiProviderCredentialEncryptionService();
				const plaintext = 'sk-ephemeral-key';
				expect(ephemeralService.decrypt(ephemeralService.encrypt(plaintext))).toBe(plaintext);
			} finally {
				process.env.ENCRYPTION_KEY = previousKey;
				warnSpy.mockRestore();
			}
		});
	});
});
