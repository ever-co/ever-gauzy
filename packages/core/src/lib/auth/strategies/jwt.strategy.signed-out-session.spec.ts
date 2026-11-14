// The strategy only needs these for DI metadata; loading the real modules drags in the whole core
// entity graph, which cannot be required in isolation (pre-existing circular import).
jest.mock('../auth.service', () => ({ AuthService: class AuthService {} }));
jest.mock('../../employee/employee.service', () => ({ EmployeeService: class EmployeeService {} }));
jest.mock('../../user-organization/user-organization.services', () => ({
	UserOrganizationService: class UserOrganizationService {}
}));
jest.mock('../../role/role-authorization.service', () => ({
	RoleAuthorizationService: class RoleAuthorizationService {}
}));
jest.mock('../../access-token/access-token.service', () => ({ AccessTokenService: class AccessTokenService {} }));

import { UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AccessTokenService } from '../../access-token/access-token.service';
import { EmployeeService } from '../../employee/employee.service';
import { RoleAuthorizationService } from '../../role/role-authorization.service';
import { TokenStatus } from '../../token/interfaces/token.interface';
import { UserOrganizationService } from '../../user-organization/user-organization.services';
import { AuthService } from '../auth.service';
import { USER_SESSION_SIGNED_OUT_REASON } from '../user-session/user-session-revocation';
import { AuthenticatedUserCache, AuthenticatedUserCacheProvider } from './authenticated-user-cache';
import { ACCESS_TOKEN_USE_RESOLUTION_MS, JwtStrategy } from './jwt.strategy';

/**
 * A session its user signed out from another session ends at its next request (ever-co/ever-gauzy#11921): the strategy
 * reads the access token's stored record by the id its payload carries, and refuses it once it was revoked by a session
 * sign-out. Every other token is judged as before, a logged-out one included.
 */
describe('JwtStrategy: a signed-out session', () => {
	const payload = { id: 'user-1', tenantId: 'tenant', tokenId: 'access-token-1', tokenType: 'ACCESS_TOKEN_TYPE' };

	function build(stored: Record<string, unknown> | null) {
		const authService = {
			getAuthenticatedUser: jest.fn(async () => ({
				id: 'user-1',
				tenantId: 'tenant',
				roleId: 'role-1',
				isActive: true,
				isArchived: false
			}))
		};
		const roleAuthorizationService = {
			attachAuthorizationState: jest.fn(async (user: any) => {
				user.role = { id: 'role-1', name: 'EMPLOYEE', tenantId: 'tenant' };
				user.permissions = [];
				return user;
			})
		};
		const accessTokenService = {
			findById: jest.fn(async () => stored),
			touch: jest.fn(async () => undefined)
		};
		const strategy = new JwtStrategy(
			authService as any,
			{ findOneByIdString: jest.fn() } as any,
			{ findOneByOptions: jest.fn() } as any,
			roleAuthorizationService as any,
			new AuthenticatedUserCache({ ttlMs: 0, ormType: 'typeorm' }),
			accessTokenService as any
		);
		return { strategy, accessTokenService };
	}

	const activeToken = (lastUsedAt: Date | null) => ({
		id: 'access-token-1',
		status: TokenStatus.ACTIVE,
		revokedReason: null,
		lastUsedAt
	});

	it('refuses a token whose session its user signed out', async () => {
		const { strategy, accessTokenService } = build({
			id: 'access-token-1',
			status: TokenStatus.REVOKED,
			revokedReason: USER_SESSION_SIGNED_OUT_REASON,
			lastUsedAt: null
		});

		await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
		expect(accessTokenService.findById).toHaveBeenCalledWith('access-token-1');
	});

	it.each([
		['logged out', 'User initiated logout'],
		['revoked by the inactivity clean-up', 'Inactivity timeout']
	])('accepts a token %s, as before', async (_how, revokedReason) => {
		const { strategy } = build({
			id: 'access-token-1',
			status: TokenStatus.REVOKED,
			revokedReason,
			lastUsedAt: null
		});

		await expect(strategy.validate(payload)).resolves.toMatchObject({ id: 'user-1' });
	});

	it('judges a token without a stored id as before, without reading the store', async () => {
		const { strategy, accessTokenService } = build(null);
		const legacy = { id: payload.id, tenantId: payload.tenantId, tokenType: payload.tokenType };

		await expect(strategy.validate(legacy)).resolves.toMatchObject({ id: 'user-1' });
		expect(accessTokenService.findById).not.toHaveBeenCalled();
	});

	it('judges a token the store does not hold as before', async () => {
		const { strategy } = build(null);

		await expect(strategy.validate(payload)).resolves.toMatchObject({ id: 'user-1' });
	});

	it('records the use of a token not used for a while', async () => {
		const { strategy, accessTokenService } = build(
			activeToken(new Date(Date.now() - ACCESS_TOKEN_USE_RESOLUTION_MS - 1000))
		);

		await strategy.validate(payload);

		expect(accessTokenService.touch).toHaveBeenCalledWith('access-token-1');
	});

	it('does not record the use of a token used moments ago', async () => {
		const { strategy, accessTokenService } = build(activeToken(new Date(Date.now() - 1000)));

		await strategy.validate(payload);

		expect(accessTokenService.touch).not.toHaveBeenCalled();
	});

	it('is given the access token store by Nest when the module provides it, as AuthModule does', async () => {
		const accessTokenService = { findById: jest.fn(), touch: jest.fn() } as unknown as AccessTokenService;
		const moduleRef = await Test.createTestingModule({
			providers: [
				AuthenticatedUserCacheProvider,
				JwtStrategy,
				{ provide: AuthService, useValue: {} },
				{ provide: EmployeeService, useValue: {} },
				{ provide: UserOrganizationService, useValue: {} },
				{ provide: RoleAuthorizationService, useValue: {} },
				{ provide: AccessTokenService, useValue: accessTokenService }
			]
		}).compile();

		expect((moduleRef.get(JwtStrategy) as any)._accessTokenService).toBe(accessTokenService);
	});
});
