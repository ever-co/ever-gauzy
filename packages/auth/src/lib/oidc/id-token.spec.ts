import type { JWTPayload } from 'jose';
import { OidcErrorCode } from './errors';
import {
	FakeOidcHttp,
	TestSigningKey,
	generateSigningKey,
	generateSymmetricKey,
	publishIssuer,
	signTestToken
} from './fixtures/oidc-test-kit';
import { OidcClientService } from './oidc-client.service';
import { OidcDiscoveryService } from './oidc-discovery.service';
import { OidcJwksService } from './oidc-jwks.service';
import { OidcIssuerConfig } from './oidc.types';

// The first use of `jose` (an ES module that ts-jest compiles on load) and key generation can take
// longer than Jest's 5 s default on a busy machine.
jest.setTimeout(60_000);

const ISSUER = 'https://issuer.example.test';
const CLIENT_ID = 'web-client';

describe('OidcClientService.validateIdToken', () => {
	let rsa: TestSigningKey;
	let ed: TestSigningKey;
	let ec: TestSigningKey;
	let client: OidcClientService;
	let config: OidcIssuerConfig;
	const now = Math.floor(Date.UTC(2026, 9, 1, 12, 0, 0) / 1000);

	beforeAll(async () => {
		rsa = await generateSigningKey('RS256', 'rsa');
		ed = await generateSigningKey('EdDSA', 'ed');
		ec = await generateSigningKey('ES256', 'ec');
	});

	beforeEach(() => {
		const http = new FakeOidcHttp();
		publishIssuer(http, ISSUER, [rsa, ed, ec]);
		const discovery = new OidcDiscoveryService(http as any);
		const jwks = new OidcJwksService(discovery, http as any);
		client = new OidcClientService(discovery, jwks, http as any);
		jest.spyOn(client as any, 'nowSeconds').mockReturnValue(now);
		config = {
			issuer: ISSUER,
			clientId: CLIENT_ID,
			redirectUri: 'https://api.example.test/callback',
			scopes: ['openid', 'email'],
			audienceAllowList: ['mobile-client']
		};
	});

	function claims(overrides: JWTPayload = {}): JWTPayload {
		return {
			iss: ISSUER,
			sub: 'subject-1',
			aud: CLIENT_ID,
			iat: now - 10,
			exp: now + 600,
			nonce: 'nonce-1',
			email: 'person@example.test',
			email_verified: true,
			name: 'Test Person',
			auth_time: now - 20,
			sid: 'session-1',
			...overrides
		};
	}

	async function rejectionCode(token: string, nonce = 'nonce-1'): Promise<OidcErrorCode | undefined> {
		try {
			await client.validateIdToken(config, token, { nonce });
			return undefined;
		} catch (error) {
			return (error as { code?: OidcErrorCode }).code;
		}
	}

	it.each([
		['RS256', () => rsa],
		['EdDSA', () => ed],
		['ES256', () => ec]
	])('accepts a valid %s token and normalises it', async (_alg, key) => {
		const token = await signTestToken(key(), claims());
		const result = await client.validateIdToken(config, token, { nonce: 'nonce-1' });
		expect(result).toEqual(
			expect.objectContaining({
				issuer: ISSUER,
				subject: 'subject-1',
				audience: [CLIENT_ID],
				email: 'person@example.test',
				emailVerified: true,
				name: 'Test Person',
				authTime: now - 20,
				sid: 'session-1'
			})
		);
	});

	it('refuses a foreign issuer', async () => {
		expect(await rejectionCode(await signTestToken(rsa, claims({ iss: 'https://other.example.test' })))).toBe('issuer_rejected');
	});

	it('refuses a foreign audience', async () => {
		expect(await rejectionCode(await signTestToken(rsa, claims({ aud: 'someone-else' })))).toBe('audience_rejected');
	});

	it('accepts an allow-listed audience', async () => {
		expect(await rejectionCode(await signTestToken(rsa, claims({ aud: 'mobile-client' })))).toBeUndefined();
	});

	it('requires azp when the token has several audiences', async () => {
		expect(await rejectionCode(await signTestToken(rsa, claims({ aud: [CLIENT_ID, 'other'] })))).toBe('audience_rejected');
		expect(await rejectionCode(await signTestToken(rsa, claims({ aud: [CLIENT_ID, 'other'], azp: CLIENT_ID })))).toBeUndefined();
		expect(await rejectionCode(await signTestToken(rsa, claims({ aud: [CLIENT_ID, 'other'], azp: 'other' })))).toBe(
			'audience_rejected'
		);
	});

	it('refuses an HS256-signed token', async () => {
		const token = await signTestToken(generateSymmetricKey('rsa'), claims());
		expect(await rejectionCode(token)).toBe('token_invalid');
	});

	it('refuses an expired token', async () => {
		expect(await rejectionCode(await signTestToken(rsa, claims({ exp: now - 120 })))).toBe('expired');
	});

	it('refuses a token issued more than 300 s in the future', async () => {
		expect(await rejectionCode(await signTestToken(rsa, claims({ iat: now + 301, exp: now + 900 })))).toBe('token_invalid');
		expect(await rejectionCode(await signTestToken(rsa, claims({ iat: now + 290, exp: now + 900 })))).toBeUndefined();
	});

	it('refuses a nonce that does not match', async () => {
		expect(await rejectionCode(await signTestToken(rsa, claims()), 'nonce-2')).toBe('nonce_mismatch');
	});

	it('reads a missing email_verified as false', async () => {
		const token = await signTestToken(rsa, claims({ email_verified: undefined }));
		const result = await client.validateIdToken(config, token, { nonce: 'nonce-1' });
		expect(result.emailVerified).toBe(false);

		const textTrue = await signTestToken(rsa, claims({ email_verified: 'true' }));
		expect((await client.validateIdToken(config, textTrue, { nonce: 'nonce-1' })).emailVerified).toBe(false);
	});

	it('refuses a token signed by an unknown key', async () => {
		const stranger = await generateSigningKey('RS256', 'rsa');
		expect(await rejectionCode(await signTestToken(stranger, claims()))).toBe('token_invalid');
	});
});
