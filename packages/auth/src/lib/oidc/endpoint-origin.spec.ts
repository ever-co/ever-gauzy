import { FakeOidcHttp, discoveryDocumentFor, randomTestSecret } from './fixtures/oidc-test-kit';
import { OidcClientService } from './oidc-client.service';
import {
	OIDC_DISCOVERY_MAX_STALE_MS,
	OIDC_DISCOVERY_TTL_MS,
	OidcDiscoveryService,
	isSameOrigin,
	stripTrailingSlashes
} from './oidc-discovery.service';
import { OidcJwksService } from './oidc-jwks.service';
import { OidcTransactionService } from './oidc-transaction.service';

// The first use of `jose` (an ES module that ts-jest compiles on load) and key generation can take
// longer than Jest's 5 s default on a busy machine.
jest.setTimeout(60_000);

const ISSUER = 'https://issuer.example.test';
const DISCOVERY_URL = `${ISSUER}/.well-known/openid-configuration`;

describe('OidcDiscoveryService', () => {
	let http: FakeOidcHttp;
	let discovery: OidcDiscoveryService;
	let now: number;

	beforeEach(() => {
		http = new FakeOidcHttp();
		discovery = new OidcDiscoveryService(http as any);
		now = Date.UTC(2026, 9, 1, 12, 0, 0);
		jest.spyOn(discovery as any, 'now').mockImplementation(() => now);
	});

	it('refuses a document whose token endpoint is on another origin, and never calls it', async () => {
		const document = { ...discoveryDocumentFor(ISSUER), token_endpoint: 'https://attacker.example.test/token' };
		http.on(DISCOVERY_URL, { status: 200, data: document });

		await expect(discovery.get(ISSUER)).rejects.toMatchObject({ code: 'discovery_failed' });

		// The code exchange cannot even start: the only request ever made is the discovery one.
		const jwks = new OidcJwksService(discovery, http as any);
		const client = new OidcClientService(discovery, jwks, http as any);
		const transactions = new OidcTransactionService({ transactionSecret: randomTestSecret() });
		const txn = await transactions.begin({ cookie: () => undefined, clearCookie: () => undefined }, { name: 'c', secure: true }, {
			issuer: ISSUER,
			mode: 'signin'
		});
		await expect(
			client.exchangeCode({ issuer: ISSUER, clientId: 'a', redirectUri: 'https://api.example.test/cb', scopes: ['openid'] }, 'code', txn)
		).rejects.toMatchObject({ code: 'discovery_failed' });

		expect(http.requests.every((request) => request.url === DISCOVERY_URL)).toBe(true);
		expect(http.calls('https://attacker.example.test/token')).toHaveLength(0);
	});

	it('refuses a document for another issuer', async () => {
		http.on(DISCOVERY_URL, { status: 200, data: discoveryDocumentFor('https://other.example.test') });
		await expect(discovery.get(ISSUER)).rejects.toMatchObject({ code: 'discovery_failed' });
	});

	it('refuses a key set URL on another origin', async () => {
		http.on(DISCOVERY_URL, { status: 200, data: { ...discoveryDocumentFor(ISSUER), jwks_uri: 'https://cdn.example.test/keys' } });
		await expect(discovery.get(ISSUER)).rejects.toMatchObject({ code: 'discovery_failed' });
	});

	it('caches for 24 h and serves a stale document for up to 7 days when the issuer is down', async () => {
		http.on(DISCOVERY_URL, { status: 200, data: discoveryDocumentFor(ISSUER) });
		await discovery.get(ISSUER);
		now += OIDC_DISCOVERY_TTL_MS - 1000;
		await discovery.get(ISSUER);
		expect(http.calls(DISCOVERY_URL)).toHaveLength(1);

		http.fail(DISCOVERY_URL);
		now += 2000;
		await expect(discovery.get(ISSUER)).resolves.toMatchObject({ issuer: ISSUER });
		expect(http.calls(DISCOVERY_URL)).toHaveLength(2);

		now += OIDC_DISCOVERY_MAX_STALE_MS;
		await expect(discovery.get(ISSUER)).rejects.toMatchObject({ code: 'discovery_failed' });
	});

	it('fails for a non-200 answer', async () => {
		http.on(DISCOVERY_URL, { status: 500, data: {} });
		await expect(discovery.get(ISSUER)).rejects.toMatchObject({ code: 'discovery_failed' });
	});
});

describe('URL helpers', () => {
	it('compares origins', () => {
		expect(isSameOrigin('https://issuer.example.test/oauth/v2/token', ISSUER)).toBe(true);
		expect(isSameOrigin('https://issuer.example.test:8443/token', ISSUER)).toBe(false);
		expect(isSameOrigin('http://issuer.example.test/token', ISSUER)).toBe(false);
		expect(isSameOrigin('not a url', ISSUER)).toBe(false);
		expect(isSameOrigin(undefined, ISSUER)).toBe(false);
	});

	it('strips trailing slashes', () => {
		expect(stripTrailingSlashes('https://issuer.example.test///')).toBe('https://issuer.example.test');
		expect(stripTrailingSlashes('https://issuer.example.test')).toBe('https://issuer.example.test');
	});
});
