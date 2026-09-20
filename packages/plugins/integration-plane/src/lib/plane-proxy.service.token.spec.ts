// `@gauzy/core`'s barrel drags in the whole entity graph (pre-existing circular import). Only the
// token helpers are needed, loaded from their own file; the other collaborators are stand-ins.
jest.mock('@gauzy/core', () => {
	const helpers = jest.requireActual('../../../../core/src/lib/auth/purpose-token');
	return { isAccessTokenPayload: helpers.isAccessTokenPayload, JWT_ALGORITHMS: helpers.JWT_ALGORITHMS };
});
jest.mock('@ever-gauzy/plugin-integration-plane-api', () => ({ mountPlaneProxy: jest.fn() }));
jest.mock('./plane-integration.service', () => ({ PlaneIntegrationService: class PlaneIntegrationService {} }));

import { environment } from '@gauzy/config';
import { sign, verify } from 'jsonwebtoken';
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
