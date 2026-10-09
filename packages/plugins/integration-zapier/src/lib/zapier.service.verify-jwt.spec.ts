// `@gauzy/core`'s barrel drags in the whole entity graph (pre-existing circular import). This spec
// only needs the token helpers, loaded from their own file, and stand-ins for the DI classes.
jest.mock('@gauzy/core', () => {
	const helpers = jest.requireActual('../../../../core/src/lib/auth/purpose-token');
	class Stub {}
	return {
		isAccessTokenPayload: helpers.isAccessTokenPayload,
		JWT_ALGORITHMS: helpers.JWT_ALGORITHMS,
		IntegrationSettingService: Stub,
		IntegrationService: Stub,
		IntegrationTenantService: Stub,
		IntegrationTenantUpdateOrCreateCommand: Stub,
		RequestContext: Stub,
		DEFAULT_ENTITY_SETTINGS: [],
		PROJECT_TIED_ENTITIES: [],
		parseFindOptionsRelations: () => ({})
	};
});

import { UnauthorizedException } from '@nestjs/common';
import { environment } from '@gauzy/config';
import { sign, verify } from 'jsonwebtoken';
import { ZapierService } from './zapier.service';

/**
 * GHSA-28wv-vrxj-rp4q — `verifyJwtToken` accepted any JWT_SECRET-signed token with a `tenantId`
 * claim as an OAuth access token for the tenant, e.g. an estimate token held by an external
 * customer or a password-reset token.
 */
describe('ZapierService.verifyJwtToken (GHSA-28wv-vrxj-rp4q)', () => {
	const service: ZapierService = Object.create(ZapierService.prototype);

	it('accepts an access token', () => {
		const token = sign({ id: 'u1', tenantId: 't1', tokenType: 'ACCESS_TOKEN_TYPE' }, environment.JWT_SECRET);
		expect(service.verifyJwtToken(token)).toMatchObject({ id: 'u1', tenantId: 't1' });
	});

	it('accepts a legacy access token without a type', () => {
		const token = sign({ id: 'u1', tenantId: 't1', role: 'ADMIN' }, environment.JWT_SECRET);
		expect(service.verifyJwtToken(token)).toMatchObject({ id: 'u1' });
	});

	it.each([
		['an estimate token', { invoiceId: 'i', organizationId: 'o', tenantId: 't1', email: 'x@y.z' }],
		['a typed estimate token', { purpose: 'estimate', invoiceId: 'i', organizationId: 'o', tenantId: 't1' }],
		['a password-reset token', { purpose: 'password-reset', id: 'u1', tenantId: 't1' }],
		['a refresh-typed token', { id: 'u1', tenantId: 't1', tokenType: 'REFRESH_TOKEN_TYPE' }]
	])('rejects %s — CONTROL: the pre-fix structure check accepted it', (_label, claims) => {
		const token = sign(claims, environment.JWT_SECRET);

		// CONTROL: the pre-fix check was only "verifies and has a tenantId".
		const decoded = verify(token, environment.JWT_SECRET);
		expect(typeof decoded === 'object' && 'tenantId' in decoded).toBe(true);

		expect(() => service.verifyJwtToken(token)).toThrow(UnauthorizedException);
	});

	it('rejects an HS512 token signed with the same secret', () => {
		const token = sign({ id: 'u1', tenantId: 't1' }, environment.JWT_SECRET, { algorithm: 'HS512' });
		expect(() => service.verifyJwtToken(token)).toThrow(UnauthorizedException);
	});
});
