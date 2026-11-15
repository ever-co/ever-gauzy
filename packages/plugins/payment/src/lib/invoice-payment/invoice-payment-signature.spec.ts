import {
	PAYMENT_SIGNATURE_HEADER,
	PAYMENT_TIMESTAMP_HEADER,
	isSignedBy,
	signatureOf,
	signedHeaders,
	signingKeySourceOf,
	signingSecretOf
} from './invoice-payment-signature';

/**
 * The signature of the messages between the API and an organization's payment connector (ever-co/ever-gauzy#11856):
 * a forged notification is refused, and the secret is derived from the API's key, never stored.
 */
const ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
const JWT_SECRET = 'a-jwt-secret-of-this-deployment-only';
const PROVIDER = '5b3c1a2e-3f4d-4b6a-9c8d-7e6f5a4b3c2d';
const NOW = new Date('2026-11-15T12:00:00Z');

describe('signingKeySourceOf', () => {
	it('derives from ENCRYPTION_KEY when it is a 32-byte key', () => {
		expect(signingKeySourceOf({ ENCRYPTION_KEY, JWT_SECRET })).toBe('k');
	});

	it('refuses a malformed ENCRYPTION_KEY rather than falling back to JWT_SECRET', () => {
		expect(signingKeySourceOf({ ENCRYPTION_KEY: 'short', JWT_SECRET })).toBeNull();
	});

	it('derives from JWT_SECRET when ENCRYPTION_KEY is unset', () => {
		expect(signingKeySourceOf({ JWT_SECRET })).toBe('j');
	});

	it('has no key without either', () => {
		expect(signingKeySourceOf({})).toBeNull();
	});
});

describe('signingSecretOf', () => {
	const env = { ENCRYPTION_KEY, JWT_SECRET };

	it('gives the same secret for the same provider, version and key', () => {
		expect(signingSecretOf(PROVIDER, 1, 'k', env)).toBe(signingSecretOf(PROVIDER, 1, 'k', env));
		expect(signingSecretOf(PROVIDER, 1, 'k', env)).toMatch(/^gzips_[A-Za-z0-9_-]{43}$/);
	});

	it('gives another secret for another provider, another version or another key', () => {
		const secret = signingSecretOf(PROVIDER, 1, 'k', env);
		expect(signingSecretOf('another-provider', 1, 'k', env)).not.toBe(secret);
		expect(signingSecretOf(PROVIDER, 2, 'k', env)).not.toBe(secret);
		expect(signingSecretOf(PROVIDER, 1, 'j', env)).not.toBe(secret);
	});

	it('keeps a JWT_SECRET-derived secret once ENCRYPTION_KEY is set later', () => {
		expect(signingSecretOf(PROVIDER, 1, 'j', { JWT_SECRET })).toBe(signingSecretOf(PROVIDER, 1, 'j', env));
	});

	it('answers null when the process no longer holds the key, or for no version', () => {
		expect(signingSecretOf(PROVIDER, 1, 'k', { JWT_SECRET })).toBeNull();
		expect(signingSecretOf(PROVIDER, 0, 'k', env)).toBeNull();
	});
});

describe('isSignedBy', () => {
	const secret = signingSecretOf(PROVIDER, 1, 'k', { ENCRYPTION_KEY }) as string;
	const body = JSON.stringify({ id: 'evt_1', type: 'payment.succeeded' });

	it('accepts a message signed with the secret, within the tolerance', () => {
		const headers = signedHeaders(secret, body, new Date(NOW.getTime() - 60_000));
		expect(isSignedBy(secret, headers, Buffer.from(body), NOW)).toBe(true);
	});

	it('refuses a message signed with another secret (a forged notification)', () => {
		const headers = signedHeaders('gzips_forged', body, NOW);
		expect(isSignedBy(secret, headers, Buffer.from(body), NOW)).toBe(false);
	});

	it('refuses a body changed after it was signed', () => {
		const headers = signedHeaders(secret, body, NOW);
		const tampered = Buffer.from(body.replace('evt_1', 'evt_2'));
		expect(isSignedBy(secret, headers, tampered, NOW)).toBe(false);
	});

	it('refuses a message signed more than five minutes ago (a captured one replayed)', () => {
		const headers = signedHeaders(secret, body, new Date(NOW.getTime() - 301_000));
		expect(isSignedBy(secret, headers, Buffer.from(body), NOW)).toBe(false);
	});

	it.each([
		['no signature', { [PAYMENT_TIMESTAMP_HEADER]: '1763208000' }],
		['no timestamp', { [PAYMENT_SIGNATURE_HEADER]: 'ab' }],
		['a timestamp that is not a number', { [PAYMENT_TIMESTAMP_HEADER]: 'soon', [PAYMENT_SIGNATURE_HEADER]: 'ab' }]
	])('refuses a message with %s, without throwing', (_label, headers) => {
		expect(isSignedBy(secret, headers, Buffer.from(body), NOW)).toBe(false);
	});

	it('refuses a message without a body', () => {
		const headers = signedHeaders(secret, body, NOW);
		expect(isSignedBy(secret, headers, undefined, NOW)).toBe(false);
	});

	it('reads a signature written in capitals', () => {
		const timestamp = String(Math.floor(NOW.getTime() / 1000));
		const headers = {
			[PAYMENT_TIMESTAMP_HEADER]: timestamp,
			[PAYMENT_SIGNATURE_HEADER]: signatureOf(secret, timestamp, body).toUpperCase()
		};
		expect(isSignedBy(secret, headers, Buffer.from(body), NOW)).toBe(true);
	});
});
