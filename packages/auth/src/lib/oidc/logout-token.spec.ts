import type { JWTPayload } from 'jose';
import { FakeOidcHttp, TestSigningKey, generateSigningKey, publishIssuer, signTestToken } from './fixtures/oidc-test-kit';
import { OidcDiscoveryService } from './oidc-discovery.service';
import { OidcJwksService } from './oidc-jwks.service';
import { BACKCHANNEL_LOGOUT_EVENT, OidcLogoutTokenService } from './oidc-logout-token.service';
import { OidcIssuerConfig } from './oidc.types';

// The first use of `jose` (an ES module that ts-jest compiles on load) and key generation can take
// longer than Jest's 5 s default on a busy machine.
jest.setTimeout(60_000);

const ISSUER = 'https://issuer.example.test';

describe('OidcLogoutTokenService', () => {
	let key: TestSigningKey;
	let service: OidcLogoutTokenService;
	let config: OidcIssuerConfig;
	const now = Math.floor(Date.UTC(2026, 9, 1, 12, 0, 0) / 1000);

	beforeAll(async () => {
		key = await generateSigningKey('ES256', 'ec');
	});

	beforeEach(() => {
		const http = new FakeOidcHttp();
		publishIssuer(http, ISSUER, [key]);
		const discovery = new OidcDiscoveryService(http as any);
		service = new OidcLogoutTokenService(new OidcJwksService(discovery, http as any));
		jest.spyOn(service as any, 'nowSeconds').mockReturnValue(now);
		config = { issuer: ISSUER, clientId: 'web-client', redirectUri: 'https://api.example.test/cb', scopes: ['openid'] };
	});

	function claims(overrides: JWTPayload = {}): JWTPayload {
		return {
			iss: ISSUER,
			aud: 'web-client',
			iat: now - 5,
			jti: 'jti-1',
			sid: 'session-1',
			sub: 'subject-1',
			events: { [BACKCHANNEL_LOGOUT_EVENT]: {} },
			...overrides
		};
	}

	async function code(overrides: JWTPayload) {
		return service
			.validate(config, await signTestToken(key, claims(overrides)))
			.then(() => undefined)
			.catch((error) => error.code);
	}

	it('accepts a valid logout token', async () => {
		const token = await service.validate(config, await signTestToken(key, claims()));
		expect(token).toEqual({
			issuer: ISSUER,
			subject: 'subject-1',
			sid: 'session-1',
			jti: 'jti-1',
			iat: now - 5,
			events: [BACKCHANNEL_LOGOUT_EVENT]
		});
	});

	it('refuses a token without the back-channel logout event', async () => {
		expect(await code({ events: undefined })).toBe('token_invalid');
		expect(await code({ events: { 'http://example.test/other': {} } })).toBe('token_invalid');
	});

	it('refuses an event member that is not a JSON object', async () => {
		expect(await code({ events: { [BACKCHANNEL_LOGOUT_EVENT]: null } })).toBe('token_invalid');
		expect(await code({ events: { [BACKCHANNEL_LOGOUT_EVENT]: 'yes' } })).toBe('token_invalid');
		expect(await code({ events: { [BACKCHANNEL_LOGOUT_EVENT]: [] } })).toBe('token_invalid');
		expect(await code({ events: [BACKCHANNEL_LOGOUT_EVENT] })).toBe('token_invalid');
	});

	it('accepts a subject-only token (no session id)', async () => {
		expect(await code({ sid: undefined })).toBeUndefined();
	});

	it('refuses a token that carries a nonce', async () => {
		expect(await code({ nonce: 'n' })).toBe('token_invalid');
	});

	it('refuses a token older than 300 s', async () => {
		expect(await code({ iat: now - 301 })).toBe('expired');
	});

	it('refuses a token that names neither a subject nor a session', async () => {
		expect(await code({ sub: undefined, sid: undefined })).toBe('token_invalid');
	});

	it('refuses a token without jti', async () => {
		expect(await code({ jti: undefined })).toBe('token_invalid');
	});

	it('refuses a token for another client', async () => {
		expect(await code({ aud: 'other-client' })).toBe('audience_rejected');
	});

	describe('with accepted audiences given by the caller', () => {
		async function codeFor(audiences: string[], overrides: JWTPayload) {
			return service
				.validate(config, await signTestToken(key, claims(overrides)), { audiences })
				.then(() => undefined)
				.catch((error) => error.code);
		}

		it('accepts a token for any listed client (a forwarded token of another first-party client)', async () => {
			expect(await codeFor(['web-client', 'teams-web'], { aud: 'teams-web' })).toBeUndefined();
			expect(await codeFor(['web-client', 'teams-web'], { aud: ['teams-web', 'project'] })).toBeUndefined();
			expect(await codeFor(['web-client', 'teams-web'], { aud: 'web-client' })).toBeUndefined();
		});

		it('still refuses a client that is not listed', async () => {
			expect(await codeFor(['web-client', 'teams-web'], { aud: 'other-client' })).toBe('audience_rejected');
			expect(await codeFor(['teams-web'], { aud: 'web-client' })).toBe('audience_rejected');
		});

		it('keeps every other check exactly as strict', async () => {
			const audiences = ['web-client', 'teams-web'];
			expect(await codeFor(audiences, { aud: 'teams-web', iat: now - 301 })).toBe('expired');
			expect(await codeFor(audiences, { aud: 'teams-web', iat: now + 120 })).toBe('token_invalid');
			expect(await codeFor(audiences, { aud: 'teams-web', jti: undefined })).toBe('token_invalid');
			expect(await codeFor(audiences, { aud: 'teams-web', nonce: 'n' })).toBe('token_invalid');
			expect(await codeFor(audiences, { aud: 'teams-web', events: undefined })).toBe('token_invalid');
			expect(await codeFor(audiences, { aud: 'teams-web', sub: undefined, sid: undefined })).toBe('token_invalid');
			expect(await codeFor(audiences, { aud: 'teams-web', iss: 'https://other.example.test' })).toBe('issuer_rejected');
		});

		it('falls back to the client id alone for an empty list', async () => {
			expect(await codeFor([], { aud: 'teams-web' })).toBe('audience_rejected');
			expect(await codeFor([], { aud: 'web-client' })).toBeUndefined();
		});
	});
});
