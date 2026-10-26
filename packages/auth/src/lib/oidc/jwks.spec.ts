import { OidcError } from './errors';
import { FakeOidcHttp, TestSigningKey, generateSigningKey, publishIssuer } from './fixtures/oidc-test-kit';
import { OidcDiscoveryService } from './oidc-discovery.service';
import {
	OIDC_JWKS_MAX_STALE_MS,
	OIDC_JWKS_REFETCH_COOLDOWN_MS,
	OIDC_JWKS_TTL_MS,
	OidcJwksService,
	isKeyCompatible,
	selectKey
} from './oidc-jwks.service';

// The first use of `jose` (an ES module that ts-jest compiles on load) and key generation can take
// longer than Jest's 5 s default on a busy machine.
jest.setTimeout(60_000);

const ISSUER = 'https://issuer.example.test';

describe('OidcJwksService', () => {
	let http: FakeOidcHttp;
	let jwks: OidcJwksService;
	let now: number;
	let rsa: TestSigningKey;
	let rotated: TestSigningKey;
	let jwksUri: string;

	beforeAll(async () => {
		rsa = await generateSigningKey('RS256', 'rsa-1');
		rotated = await generateSigningKey('ES256', 'ec-2');
	});

	beforeEach(() => {
		http = new FakeOidcHttp();
		jwksUri = publishIssuer(http, ISSUER, [rsa]).jwks_uri;
		const discovery = new OidcDiscoveryService(http as any);
		jwks = new OidcJwksService(discovery, http as any);
		now = Date.UTC(2026, 9, 1, 12, 0, 0);
		jest.spyOn(jwks as any, 'now').mockImplementation(() => now);
		jest.spyOn(discovery as any, 'now').mockImplementation(() => now);
	});

	it('returns the key named by kid and caches the set for 600 s', async () => {
		await expect(jwks.getKey(ISSUER, { alg: 'RS256', kid: 'rsa-1' })).resolves.toBeDefined();
		now += OIDC_JWKS_TTL_MS - 1000;
		await jwks.getKey(ISSUER, { alg: 'RS256', kid: 'rsa-1' });
		expect(http.calls(jwksUri)).toHaveLength(1);

		now += 2000;
		await jwks.getKey(ISSUER, { alg: 'RS256', kid: 'rsa-1' });
		expect(http.calls(jwksUri)).toHaveLength(2);
	});

	it('refetches once for an unknown kid, then refuses further unknown kids for 30 s without a request', async () => {
		await jwks.getKey(ISSUER, { alg: 'RS256', kid: 'rsa-1' });
		expect(http.calls(jwksUri)).toHaveLength(1);

		// The issuer rotates in a new key; the first token signed with it triggers one refetch.
		publishIssuer(http, ISSUER, [rsa, rotated]);
		now += 1000;
		await expect(jwks.getKey(ISSUER, { alg: 'ES256', kid: 'ec-2' })).resolves.toBeDefined();
		expect(http.calls(jwksUri)).toHaveLength(2);

		// A second unknown kid inside the cooldown is refused without asking the issuer again.
		now += 1000;
		await expect(jwks.getKey(ISSUER, { alg: 'RS256', kid: 'unknown' })).rejects.toMatchObject({ code: 'token_invalid' });
		expect(http.calls(jwksUri)).toHaveLength(2);

		// After the cooldown, an unknown kid may trigger one more refetch.
		now += OIDC_JWKS_REFETCH_COOLDOWN_MS;
		await expect(jwks.getKey(ISSUER, { alg: 'RS256', kid: 'unknown' })).rejects.toMatchObject({ code: 'token_invalid' });
		expect(http.calls(jwksUri)).toHaveLength(3);
	});

	it('serves a stale set while the issuer is unreachable, up to 6 hours', async () => {
		await jwks.getKey(ISSUER, { alg: 'RS256', kid: 'rsa-1' });
		http.fail(jwksUri);

		now += OIDC_JWKS_MAX_STALE_MS - 60_000;
		await expect(jwks.getKey(ISSUER, { alg: 'RS256', kid: 'rsa-1' })).resolves.toBeDefined();

		now += 120_000;
		const error = await jwks.getKey(ISSUER, { alg: 'RS256', kid: 'rsa-1' }).catch((e) => e);
		expect(error).toBeInstanceOf(OidcError);
		expect(error.code).toBe('jwks_unavailable');
	});

	it('refuses symmetric and unsigned algorithms before any request', async () => {
		for (const alg of ['HS256', 'none', 'RS512']) {
			await expect(jwks.getKey(ISSUER, { alg, kid: 'rsa-1' })).rejects.toMatchObject({ code: 'token_invalid' });
		}
		expect(http.requests).toHaveLength(0);
	});
});

describe('key selection', () => {
	it('pins the key type to the algorithm', () => {
		expect(isKeyCompatible({ kty: 'RSA' }, 'RS256')).toBe(true);
		expect(isKeyCompatible({ kty: 'RSA' }, 'ES256')).toBe(false);
		expect(isKeyCompatible({ kty: 'EC', crv: 'P-384' }, 'ES256')).toBe(false);
		expect(isKeyCompatible({ kty: 'OKP', crv: 'Ed25519' }, 'EdDSA')).toBe(true);
		expect(isKeyCompatible({ kty: 'RSA', use: 'enc' }, 'RS256')).toBe(false);
		expect(isKeyCompatible({ kty: 'RSA', alg: 'RS512' }, 'RS256')).toBe(false);
		expect(isKeyCompatible({ kty: 'oct' }, 'RS256')).toBe(false);
	});

	it('picks by kid, and without a kid only when exactly one key fits', () => {
		const keys = [
			{ kty: 'RSA', kid: 'a' },
			{ kty: 'RSA', kid: 'b' }
		];
		expect(selectKey(keys, { alg: 'RS256', kid: 'b' })).toBe(keys[1]);
		expect(selectKey(keys, { alg: 'RS256' })).toBeUndefined();
		expect(selectKey([keys[0]], { alg: 'RS256' })).toBe(keys[0]);
		expect(selectKey(keys, { alg: 'HS256', kid: 'a' })).toBeUndefined();
	});
});
