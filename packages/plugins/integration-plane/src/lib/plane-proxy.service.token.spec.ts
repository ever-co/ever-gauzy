// `@gauzy/core`'s barrel drags in the whole entity graph (pre-existing circular import). Only the
// token helpers are needed, loaded from their own file; the other collaborators are stand-ins.
jest.mock('@gauzy/core', () => {
	const helpers = jest.requireActual('../../../../core/src/lib/auth/purpose-token');
	return { isAccessTokenPayload: helpers.isAccessTokenPayload, JWT_ALGORITHMS: helpers.JWT_ALGORITHMS };
});
// The session-cookie codec is pure (zlib only); load the real one from its own file so the spec
// reads cookies exactly as production does without booting the proxy's Nest module graph.
jest.mock('@ever-gauzy/plugin-integration-plane-api', () => {
	const { dirname, join } = jest.requireActual('path');
	const entry = require.resolve('@ever-gauzy/plugin-integration-plane-api');
	return {
		mountPlaneProxy: jest.fn(),
		...jest.requireActual(join(dirname(entry), 'config/utils/session-cookie.utils'))
	};
});
jest.mock('./plane-integration.service', () => ({ PlaneIntegrationService: class PlaneIntegrationService {} }));

import { environment } from '@gauzy/config';
import { sign, verify } from 'jsonwebtoken';
import { encodeSessionToken } from '@ever-gauzy/plugin-integration-plane-api';
import { PlaneProxyService } from './plane-proxy.service';

/**
 * GHSA-28wv-vrxj-rp4q — the Plane proxy trusted the `tenantId` of ANY JWT_SECRET-signed token as a
 * Gauzy session (Bearer header and session cookie alike), so an invoice-share or estimate token
 * held by an outside customer bound the proxy to that tenant.
 */
describe('PlaneProxyService token checks (GHSA-28wv-vrxj-rp4q)', () => {
	const service: any = Object.create(PlaneProxyService.prototype);
	Object.assign(service, { logger: { warn: jest.fn(), debug: jest.fn(), log: jest.fn(), error: jest.fn() } });

	const bearer = (token: string) => ({ headers: { authorization: `Bearer ${token}` } }) as any;
	const cookie = (token: string) => ({ headers: { cookie: `auth-proxy-plane-token-0=${token}` } }) as any;

	const access = sign({ id: 'u1', tenantId: 't1', tokenType: 'ACCESS_TOKEN_TYPE' }, environment.JWT_SECRET);
	const invoiceShare = sign(
		{ purpose: 'invoice-share', id: 'inv', organizationId: 'o', tenantId: 't1' },
		environment.JWT_SECRET
	);
	const estimate = sign(
		{ purpose: 'estimate', invoiceId: 'inv', organizationId: 'o', tenantId: 't1' },
		environment.JWT_SECRET
	);

	it('accepts an access token for its own tenant', () => {
		expect(() => service.validateTenantFromToken(bearer(access), 't1')).not.toThrow();
		expect(service.extractSessionTenantId(cookie(access))).toBe('t1');
	});

	it.each([
		['an invoice share token', invoiceShare],
		['an estimate token', estimate]
	])('rejects %s — CONTROL: it verifies and names the tenant', (_label, token) => {
		// CONTROL: the pre-fix code only verified the signature and read `tenantId`.
		expect((verify(token, environment.JWT_SECRET) as any).tenantId).toBe('t1');

		expect(() => service.validateTenantFromToken(bearer(token), 't1')).toThrow();
		expect(service.extractSessionTenantId(cookie(token))).toBeUndefined();
	});

	it('still refuses an access token for another tenant', () => {
		expect(() => service.validateTenantFromToken(bearer(access), 't2')).toThrow(/Tenant ID mismatch/);
	});
});

/**
 * Since plugin 0.1.7 the session cookie holds the JWT with its payload deflated, so an admin token
 * (380 permissions, ~11.5 KB) fits in one cookie instead of three. The tenant resolver must read
 * that compact form and still accept the legacy raw-JWT chunks of sessions created before it.
 */
describe('PlaneProxyService session cookie formats', () => {
	const service: any = Object.create(PlaneProxyService.prototype);
	Object.assign(service, { logger: { warn: jest.fn(), debug: jest.fn(), log: jest.fn(), error: jest.fn() } });

	const permissions = Array.from({ length: 380 }, (_, i) => `ORG_PERMISSION_${i}_VIEW`);
	const admin = sign(
		{ id: 'u1', tenantId: 't1', tokenType: 'ACCESS_TOKEN_TYPE', permissions },
		environment.JWT_SECRET
	);
	const chunked = (value: string) => ({
		headers: {
			cookie: ['tenant-id=t9', ...(value.match(/.{1,3999}/g) ?? []).map((c, i) => `auth-proxy-plane-token-${i}=${c}`)].join(
				'; '
			)
		}
	}) as any;

	it('reads the compact single-cookie session', () => {
		const compact = encodeSessionToken(admin);
		expect(compact.startsWith('z1.')).toBe(true);
		expect(compact.length).toBeLessThan(3999);
		expect(service.readSessionToken(chunked(compact))).toBe(admin);
		expect(service.extractSessionTenantId(chunked(compact))).toBe('t1');
	});

	it('still reads a legacy multi-chunk raw-JWT session', () => {
		expect(admin.length).toBeGreaterThan(3999);
		expect(service.readSessionToken(chunked(admin))).toBe(admin);
		expect(service.extractSessionTenantId(chunked(admin))).toBe('t1');
	});

	it('treats a tampered compact cookie as no session', () => {
		const compact = encodeSessionToken(admin);
		const [marker, header, , signature] = compact.split('.');
		const forged = `${marker}.${header}.${encodeSessionToken(sign({ id: 'x', tenantId: 't2', tokenType: 'ACCESS_TOKEN_TYPE', permissions }, 'wrong-secret')).split('.')[2]}.${signature}`;
		expect(service.extractSessionTenantId(chunked(forged))).toBeUndefined();
	});
});
