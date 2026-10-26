import { createPublicKey, verify } from 'node:crypto';
import {
	EverInstanceKeyError,
	generateEd25519KeyPair,
	keyIdOf,
	keyWarning,
	preferredKeySource,
	publicKeyOfPrivate,
	signBytes,
	storedKeySource,
	unwrapKey,
	wrapKey
} from './ever-instance-key';

const ENV_K = { ENCRYPTION_KEY: 'a-strong-encryption-key-for-tests', JWT_SECRET: 'a-strong-jwt-secret-for-tests' };
const ENV_J = { JWT_SECRET: 'a-strong-jwt-secret-for-tests' };

function verifyWith(publicKey: string, bytes: Buffer, signature: Buffer): boolean {
	const key = createPublicKey({ key: { kty: 'OKP', crv: 'Ed25519', x: publicKey }, format: 'jwk' });
	return verify(null, bytes, key, signature);
}

describe('statistics key at rest', () => {
	it('signs and the signature verifies with the public key only', () => {
		const { publicKey, privateKeyDer } = generateEd25519KeyPair();
		expect(publicKey).toMatch(/^[A-Za-z0-9_-]{43}$/);
		const bytes = Buffer.from('{"schema":"ever.stats.v1"}');
		const signature = signBytes(privateKeyDer, bytes);
		expect(signature).toHaveLength(64);
		expect(verifyWith(publicKey, bytes, signature)).toBe(true);
		expect(verifyWith(publicKey, Buffer.from('{"schema":"ever.stats.v2"}'), signature)).toBe(false);
		expect(publicKeyOfPrivate(privateKeyDer)).toBe(publicKey);
	});

	it('round-trips a wrapped key and records the secret it used', () => {
		const { privateKeyDer } = generateEd25519KeyPair();
		const withK = wrapKey(privateKeyDer, 'stats', ENV_K);
		const withJ = wrapKey(privateKeyDer, 'stats', ENV_J);
		expect(storedKeySource(withK)).toBe('k');
		expect(storedKeySource(withJ)).toBe('j');
		expect(storedKeySource(wrapKey(privateKeyDer, 'stats', {}))).toBe('n');
		expect(unwrapKey(withK, 'stats', ENV_K).equals(privateKeyDer)).toBe(true);
		expect(unwrapKey(withJ, 'stats', ENV_J).equals(privateKeyDer)).toBe(true);
		expect(withK).toMatch(/^v1:k:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$/);
		expect(withK).not.toContain(privateKeyDer.toString('base64url'));
	});

	it('gives a different blob for each secret and for each write', () => {
		const { privateKeyDer } = generateEd25519KeyPair();
		const a = wrapKey(privateKeyDer, 'stats', ENV_J);
		const b = wrapKey(privateKeyDer, 'stats', { JWT_SECRET: 'another-secret' });
		const c = wrapKey(privateKeyDer, 'stats', ENV_J);
		expect(new Set([a, b, c]).size).toBe(3);
	});

	it('fails closed with the wrong secret, a missing secret, the wrong purpose or a damaged blob', () => {
		const { privateKeyDer } = generateEd25519KeyPair();
		const blob = wrapKey(privateKeyDer, 'stats', ENV_J);
		const code = (fn: () => unknown) => {
			try {
				fn();
			} catch (error) {
				expect(error).toBeInstanceOf(EverInstanceKeyError);
				return (error as EverInstanceKeyError).code;
			}
			return 'no error';
		};
		expect(code(() => unwrapKey(blob, 'stats', { JWT_SECRET: 'wrong' }))).toBe('unreadable');
		expect(code(() => unwrapKey(blob, 'stats', {}))).toBe('material_missing');
		expect(code(() => unwrapKey(blob, 'connect', ENV_J))).toBe('unreadable');
		expect(code(() => unwrapKey(blob.slice(0, -2) + (blob.endsWith('AA') ? 'BB' : 'AA'), 'stats', ENV_J))).toBe('unreadable');
		expect(code(() => unwrapKey('not-a-key', 'stats', ENV_J))).toBe('malformed');
	});

	it('never puts a secret or key material in the error', () => {
		const { privateKeyDer } = generateEd25519KeyPair();
		const blob = wrapKey(privateKeyDer, 'stats', ENV_J);
		try {
			unwrapKey(blob, 'stats', { JWT_SECRET: 'the-wrong-secret' });
			fail('expected an error');
		} catch (error) {
			const text = `${(error as Error).message} ${JSON.stringify(error)}`;
			expect(text).not.toContain('the-wrong-secret');
			expect(text).not.toContain(ENV_J.JWT_SECRET);
			expect(text).not.toContain(blob);
		}
	});

	it('derives the key id from the public key as Ever Platform does (test vector)', () => {
		// RFC 8032 test 1 public key; its id is base64url(sha256(pub)[0:8]).
		const publicKey = Buffer.from('d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a', 'hex').toString('base64url');
		expect(keyIdOf(publicKey)).toBe('If4x36FUomE');
		expect(keyIdOf(publicKey)).toMatch(/^[A-Za-z0-9_-]{11}$/);
		expect(() => keyIdOf('short')).toThrow(TypeError);
	});

	it('prefers ENCRYPTION_KEY, then JWT_SECRET, and warns until ENCRYPTION_KEY is set', () => {
		expect(preferredKeySource(ENV_K)).toBe('k');
		expect(preferredKeySource(ENV_J)).toBe('j');
		expect(preferredKeySource({})).toBe('n');
		expect(keyWarning(ENV_K)).toBeNull();
		expect(keyWarning(ENV_J)).toBe('encryption_key_unset');
		expect(keyWarning({ JWT_SECRET: 'secretKey' })).toBe('jwt_secret_default');
		expect(keyWarning({})).toBe('no_secret');
	});

	it('warns from how the key IS stored, not from the environment alone', () => {
		// A key stored under the fixed value stays unprotected even after JWT_SECRET appears.
		expect(keyWarning(ENV_J, 'n')).toBe('no_secret');
		expect(keyWarning(ENV_K, 'n')).toBe('no_secret');
		expect(keyWarning(ENV_K, 'j')).toBe('encryption_key_unset');
		expect(keyWarning({ JWT_SECRET: 'secretKey', ENCRYPTION_KEY: 'k' }, 'j')).toBe('jwt_secret_default');
		expect(keyWarning({}, 'k')).toBeNull();
		expect(keyWarning(ENV_J, null)).toBe('encryption_key_unset');
	});
});
