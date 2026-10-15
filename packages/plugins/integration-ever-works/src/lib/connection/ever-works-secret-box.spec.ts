import { randomBytes } from 'node:crypto';
import { EverWorksSecretBox, EverWorksSecretError } from './ever-works-secret-box';

const KEY = randomBytes(32).toString('base64');
const CONNECTION = '0f4b2c6d-8e1a-4b3c-9d5e-6f7a8b9c0d12';
const OTHER = '1f4b2c6d-8e1a-4b3c-9d5e-6f7a8b9c0d12';

describe('EverWorksSecretBox', () => {
	it('round-trips a key under ENCRYPTION_KEY and never stores the plaintext', () => {
		const box = new EverWorksSecretBox({ ENCRYPTION_KEY: KEY });
		const sealed = box.seal('ew_int_secretvalue1234567890', 'api_key', CONNECTION);
		expect(sealed.startsWith('ew1:k:')).toBe(true);
		expect(sealed).not.toContain('secretvalue');
		expect(box.open(sealed, 'api_key', CONNECTION)).toBe('ew_int_secretvalue1234567890');
	});

	it('uses a fresh IV per value', () => {
		const box = new EverWorksSecretBox({ ENCRYPTION_KEY: KEY });
		expect(box.seal('same', 'api_key', CONNECTION)).not.toBe(box.seal('same', 'api_key', CONNECTION));
	});

	it('binds a value to its purpose and connection (a moved ciphertext does not decrypt)', () => {
		const box = new EverWorksSecretBox({ ENCRYPTION_KEY: KEY });
		const sealed = box.seal('secret', 'api_key', CONNECTION);
		expect(() => box.open(sealed, 'webhook_secret', CONNECTION)).toThrow(EverWorksSecretError);
		expect(() => box.open(sealed, 'api_key', OTHER)).toThrow(EverWorksSecretError);
	});

	it('fails closed on a tampered or truncated value', () => {
		const box = new EverWorksSecretBox({ ENCRYPTION_KEY: KEY });
		const sealed = box.seal('secret', 'api_key', CONNECTION);
		const parts = sealed.split(':');
		const flipped = [...parts];
		flipped[4] = Buffer.from(Buffer.from(parts[4], 'base64url').map((b, i) => (i === 0 ? b ^ 1 : b))).toString('base64url');
		expect(() => box.open(flipped.join(':'), 'api_key', CONNECTION)).toThrow(/unreadable/);
		const shortTag = [...parts];
		shortTag[3] = Buffer.from(parts[3], 'base64url').subarray(0, 4).toString('base64url');
		expect(() => box.open(shortTag.join(':'), 'api_key', CONNECTION)).toThrow(EverWorksSecretError);
		expect(() => box.open('not-a-sealed-value', 'api_key', CONNECTION)).toThrow(/malformed/);
	});

	it('cannot read a value with another key', () => {
		const sealed = new EverWorksSecretBox({ ENCRYPTION_KEY: KEY }).seal('secret', 'api_key', CONNECTION);
		const other = new EverWorksSecretBox({ ENCRYPTION_KEY: randomBytes(32).toString('base64') });
		expect(() => other.open(sealed, 'api_key', CONNECTION)).toThrow(/unreadable/);
	});

	it.each([
		['malformed ENCRYPTION_KEY (not 32 bytes)', { ENCRYPTION_KEY: 'too-short' }, 'encryption_key_malformed'],
		['published ENCRYPTION_KEY', { ENCRYPTION_KEY: 'secretKey' }, 'encryption_key_default'],
		['no secret at all', {}, 'no_secret'],
		['only a published JWT_SECRET', { JWT_SECRET: 'secretKey' }, 'jwt_secret_default']
	])('refuses to store anything with %s', (_name, env, problem) => {
		const box = new EverWorksSecretBox(env);
		expect(box.problem()).toBe(problem);
		expect(box.usable()).toBe(false);
		expect(() => box.seal('secret', 'api_key', CONNECTION)).toThrow(EverWorksSecretError);
	});

	it('falls back to a strong JWT_SECRET only while ENCRYPTION_KEY is unset, and can still read it afterwards', () => {
		const jwt = { JWT_SECRET: 'a-strong-unique-jwt-secret-of-this-installation' };
		const sealed = new EverWorksSecretBox(jwt).seal('secret', 'api_key', CONNECTION);
		expect(EverWorksSecretBox.sourceOf(sealed)).toBe('j');
		const later = new EverWorksSecretBox({ ...jwt, ENCRYPTION_KEY: KEY });
		expect(later.open(sealed, 'api_key', CONNECTION)).toBe('secret');
		expect(later.needsReseal(sealed)).toBe(true);
		expect(later.needsReseal(later.seal('secret', 'api_key', CONNECTION))).toBe(false);
	});

	it('never puts key material or the value in its error messages', () => {
		const box = new EverWorksSecretBox({ ENCRYPTION_KEY: 'not-base64-32-bytes' });
		try {
			box.seal('plain-secret', 'api_key', CONNECTION);
		} catch (error) {
			expect(String((error as Error).message)).not.toContain('plain-secret');
			expect(String((error as Error).message)).not.toContain('not-base64-32-bytes');
		}
	});
});
