import {
	FakeOidcHttp,
	TestSigningKey,
	generateSigningKey,
	publishIssuer,
	randomTestSecret,
	signTestToken
} from './fixtures/oidc-test-kit';
import { OidcClientService, basicClientCredential } from './oidc-client.service';
import { OidcDiscoveryService } from './oidc-discovery.service';
import { OidcJwksService } from './oidc-jwks.service';
import { OidcTransactionService } from './oidc-transaction.service';
import { OidcIssuerConfig, OidcTransaction } from './oidc.types';
import { createCodeChallenge } from './pkce';

// The first use of `jose` (an ES module that ts-jest compiles on load) and key generation can take
// longer than Jest's 5 s default on a busy machine.
jest.setTimeout(60_000);

const ISSUER = 'https://issuer.example.test';

describe('OidcClientService authorization code flow', () => {
	let key: TestSigningKey;
	let http: FakeOidcHttp;
	let client: OidcClientService;
	let config: OidcIssuerConfig;
	let transaction: OidcTransaction;
	let tokenEndpoint: string;
	let clientSecret: string;

	beforeAll(async () => {
		key = await generateSigningKey('RS256', 'rsa');
	});

	beforeEach(async () => {
		http = new FakeOidcHttp();
		tokenEndpoint = publishIssuer(http, ISSUER, [key]).token_endpoint;
		const discovery = new OidcDiscoveryService(http as any);
		client = new OidcClientService(discovery, new OidcJwksService(discovery, http as any), http as any);
		clientSecret = randomTestSecret();
		config = {
			issuer: ISSUER,
			clientId: 'web client',
			clientSecret,
			redirectUri: 'https://api.example.test/api/auth/test/callback',
			scopes: ['openid', 'profile', 'email']
		};
		const transactions = new OidcTransactionService({ transactionSecret: randomTestSecret() });
		transaction = await transactions.begin({ cookie: () => undefined, clearCookie: () => undefined }, { name: 'c', secure: true }, {
			issuer: ISSUER,
			mode: 'signin'
		});
	});

	it('builds an authorize URL with PKCE S256, state and nonce, and no login hint unless asked', async () => {
		const url = new URL(await client.buildAuthorizeUrl(config, transaction));
		expect(`${url.origin}${url.pathname}`).toBe(`${ISSUER}/oauth/v2/authorize`);
		expect(Object.fromEntries(url.searchParams)).toEqual({
			response_type: 'code',
			client_id: 'web client',
			redirect_uri: config.redirectUri,
			scope: 'openid profile email',
			state: transaction.state,
			nonce: transaction.nonce,
			code_challenge: createCodeChallenge(transaction.codeVerifier),
			code_challenge_method: 'S256'
		});

		const withOptions = new URL(await client.buildAuthorizeUrl(config, transaction, { prompt: 'login', maxAge: 300 }));
		expect(withOptions.searchParams.get('prompt')).toBe('login');
		expect(withOptions.searchParams.get('max_age')).toBe('300');
		expect(withOptions.searchParams.has('login_hint')).toBe(false);
	});

	it('exchanges the code with client_secret_basic and the PKCE verifier, then validates the ID token', async () => {
		const now = Math.floor(Date.now() / 1000);
		const idToken = await signTestToken(key, {
			iss: ISSUER,
			sub: 'subject-1',
			aud: 'web client',
			iat: now,
			exp: now + 300,
			nonce: transaction.nonce,
			email: 'person@example.test',
			email_verified: true
		});
		http.on(tokenEndpoint, { status: 200, data: { id_token: idToken, access_token: 'opaque', token_type: 'Bearer' } });

		const result = await client.exchangeCode(config, 'the-code', transaction);

		expect(result.idToken.subject).toBe('subject-1');
		const [request] = http.calls(tokenEndpoint);
		expect(request.method).toBe('POST');
		expect(request.form).toEqual({
			grant_type: 'authorization_code',
			code: 'the-code',
			redirect_uri: config.redirectUri,
			code_verifier: transaction.codeVerifier
		});
		expect(request.headers['Authorization']).toBe(basicClientCredential('web client', clientSecret));
	});

	it('sends the client id in the form for a public client', async () => {
		http.on(tokenEndpoint, { status: 400, data: { error: 'invalid_grant' } });
		await expect(client.exchangeCode({ ...config, clientSecret: undefined }, 'the-code', transaction)).rejects.toMatchObject({
			code: 'exchange_failed'
		});
		const [request] = http.calls(tokenEndpoint);
		expect(request.form['client_id']).toBe('web client');
		expect(request.headers['Authorization']).toBeUndefined();
	});

	it('refuses an ID token minted for another transaction', async () => {
		const now = Math.floor(Date.now() / 1000);
		const idToken = await signTestToken(key, {
			iss: ISSUER,
			sub: 'subject-1',
			aud: 'web client',
			iat: now,
			exp: now + 300,
			nonce: 'someone-elses-nonce'
		});
		http.on(tokenEndpoint, { status: 200, data: { id_token: idToken } });
		await expect(client.exchangeCode(config, 'the-code', transaction)).rejects.toMatchObject({ code: 'nonce_mismatch' });
	});

	it('form-encodes the client credential (RFC 6749 section 2.3.1)', () => {
		expect(basicClientCredential('a b', 'c:d')).toBe(`Basic ${Buffer.from('a+b:c%3Ad').toString('base64')}`);
	});
});

describe('OidcClientService.verifyAccessToken', () => {
	let key: TestSigningKey;
	let client: OidcClientService;
	const config: OidcIssuerConfig = { issuer: ISSUER, clientId: 'api', redirectUri: 'https://x.test/cb', scopes: ['openid'] };

	beforeAll(async () => {
		key = await generateSigningKey('ES256', 'ec');
	});

	beforeEach(() => {
		const http = new FakeOidcHttp();
		publishIssuer(http, ISSUER, [key]);
		const discovery = new OidcDiscoveryService(http as any);
		client = new OidcClientService(discovery, new OidcJwksService(discovery, http as any), http as any);
	});

	async function token(claims: Record<string, unknown>) {
		const now = Math.floor(Date.now() / 1000);
		return signTestToken(key, { iss: ISSUER, sub: 's', iat: now, exp: now + 300, ...claims });
	}

	it('accepts an allow-listed client and refuses any other', async () => {
		await expect(client.verifyAccessToken(config, await token({ aud: ['project', 'teams-web'], client_id: 'teams-web' }), ['teams-web'])).resolves.toBeDefined();
		await expect(
			client.verifyAccessToken(config, await token({ aud: ['project', 'teams-web'], client_id: 'inst-123' }), ['teams-web'])
		).rejects.toMatchObject({ code: 'audience_rejected' });
		await expect(client.verifyAccessToken(config, await token({ aud: ['project'], azp: 'inst-123' }), ['teams-web'])).rejects.toMatchObject({
			code: 'audience_rejected'
		});
	});

	it('never lets a client claim stand in for the audience (a token for another resource)', async () => {
		await expect(
			client.verifyAccessToken(config, await token({ aud: ['other-resource'], azp: 'teams-web', client_id: 'teams-web' }), ['teams-web'])
		).rejects.toMatchObject({ code: 'audience_rejected' });
	});
});
