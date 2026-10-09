import { OidcError } from './errors';
import { randomTestSecret } from './fixtures/oidc-test-kit';
import {
	OIDC_TRANSACTION_TTL_MS,
	OidcCookieResponse,
	OidcTransactionService,
	constantTimeEquals,
	readCookie
} from './oidc-transaction.service';

// The first use of `jose` (an ES module that ts-jest compiles on load) and key generation can take
// longer than Jest's 5 s default on a busy machine.
jest.setTimeout(60_000);

const COOKIE = { name: 'test_oidc_txn', secure: true };

class FakeResponse implements OidcCookieResponse {
	readonly set = new Map<string, { value: string; options: Record<string, unknown> }>();
	readonly cleared: Array<{ name: string; options: Record<string, unknown> }> = [];

	cookie(name: string, value: string, options: Record<string, unknown>) {
		this.set.set(name, { value, options });
	}

	clearCookie(name: string, options: Record<string, unknown>) {
		this.cleared.push({ name, options });
	}
}

function requestCarrying(value: string) {
	return { headers: { cookie: `other=1; ${COOKIE.name}=${encodeURIComponent(value)}; last=2` } };
}

async function expectStateMismatch(promise: Promise<unknown>) {
	await expect(promise).rejects.toBeInstanceOf(OidcError);
	await promise.catch((error: OidcError) => expect(error.code).toBe('state_mismatch'));
}

describe('OidcTransactionService', () => {
	let service: OidcTransactionService;
	let now: number;

	beforeEach(() => {
		service = new OidcTransactionService({ transactionSecret: randomTestSecret() });
		now = Date.UTC(2026, 9, 1, 12, 0, 0);
		jest.spyOn(service as any, 'now').mockImplementation(() => now);
	});

	async function begin() {
		const response = new FakeResponse();
		const transaction = await service.begin(response, COOKIE, {
			issuer: 'https://issuer.example.test',
			mode: 'signin',
			payload: { redirect: '/' }
		});
		return { transaction, cookie: response.set.get(COOKIE.name) };
	}

	it('writes an HttpOnly, SameSite=Lax, Secure cookie scoped to /api/auth for 10 minutes', async () => {
		const { cookie } = await begin();
		expect(cookie.options).toEqual(
			expect.objectContaining({
				httpOnly: true,
				secure: true,
				sameSite: 'lax',
				path: '/api/auth',
				maxAge: OIDC_TRANSACTION_TTL_MS
			})
		);
		expect(cookie.value.split('.')).toHaveLength(3);
	});

	it('returns the transaction for the matching state and clears the cookie', async () => {
		const { transaction, cookie } = await begin();
		const response = new FakeResponse();
		const completed = await service.complete(requestCarrying(cookie.value), response, COOKIE, transaction.state);

		expect(completed).toEqual(
			expect.objectContaining({
				issuer: 'https://issuer.example.test',
				state: transaction.state,
				nonce: transaction.nonce,
				codeVerifier: transaction.codeVerifier,
				mode: 'signin',
				payload: { redirect: '/' }
			})
		);
		expect(response.cleared.map((entry) => entry.name)).toEqual([COOKIE.name]);
	});

	it('refuses a tampered cookie', async () => {
		const { transaction, cookie } = await begin();
		const [header, payload, signature] = cookie.value.split('.');
		const forged = Buffer.from(payload, 'base64url').toString('utf8').replace('"signin"', '"link"');
		const tampered = [header, Buffer.from(forged).toString('base64url'), signature].join('.');

		await expectStateMismatch(service.complete(requestCarrying(tampered), new FakeResponse(), COOKIE, transaction.state));
	});

	it('refuses a cookie signed with another secret', async () => {
		const { transaction, cookie } = await begin();
		const other = new OidcTransactionService({ transactionSecret: randomTestSecret() });
		jest.spyOn(other as any, 'now').mockImplementation(() => now);

		await expectStateMismatch(other.complete(requestCarrying(cookie.value), new FakeResponse(), COOKIE, transaction.state));
	});

	it('refuses an expired transaction', async () => {
		const { transaction, cookie } = await begin();
		now += OIDC_TRANSACTION_TTL_MS + 1000;

		await expectStateMismatch(service.complete(requestCarrying(cookie.value), new FakeResponse(), COOKIE, transaction.state));
	});

	it('refuses a state that does not match', async () => {
		const { cookie } = await begin();
		await expectStateMismatch(service.complete(requestCarrying(cookie.value), new FakeResponse(), COOKIE, 'another-state'));
	});

	it('refuses a replayed transaction', async () => {
		const { transaction, cookie } = await begin();
		await service.complete(requestCarrying(cookie.value), new FakeResponse(), COOKIE, transaction.state);

		await expectStateMismatch(service.complete(requestCarrying(cookie.value), new FakeResponse(), COOKIE, transaction.state));
	});

	it('refuses a callback without the cookie', async () => {
		const { transaction } = await begin();
		await expectStateMismatch(service.complete({ headers: {} }, new FakeResponse(), COOKIE, transaction.state));
	});

	it('refuses to start without a secret', () => {
		expect(() => new OidcTransactionService({ transactionSecret: '' })).toThrow();
	});
});

describe('cookie helpers', () => {
	it('reads a cookie from the header or from cookie-parser', () => {
		expect(readCookie({ headers: { cookie: 'a=1; b=two%20words' } }, 'b')).toBe('two words');
		expect(readCookie({ headers: {}, cookies: { b: 'parsed' } }, 'b')).toBe('parsed');
		expect(readCookie({ headers: { cookie: 'a=1' } }, 'b')).toBeUndefined();
	});

	it('compares in constant time', () => {
		expect(constantTimeEquals('abc', 'abc')).toBe(true);
		expect(constantTimeEquals('abc', 'abd')).toBe(false);
		expect(constantTimeEquals('abc', 'abcd')).toBe(false);
	});
});
