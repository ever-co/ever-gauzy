import { PermissionsEnum } from '@gauzy/contracts';

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

import { UnauthorizedException } from '@nestjs/common';
import { USER_API_TOKEN_CLAIM } from '../user-api-token/user-api-token-session';
import { AuthenticatedUserCache } from './authenticated-user-cache';
import { JwtStrategy } from './jwt.strategy';

/**
 * What an API token is exchanged for is an ordinary access token, and no guard knows about API tokens. So the strategy
 * must judge one exactly as it judges a sign-in's: the same role, the same permissions, and refused at once when the
 * person is removed.
 */
describe('JwtStrategy: the access token of an API token is an ordinary one', () => {
	const ROLE_PERMISSIONS = [PermissionsEnum.ORG_TASK_VIEW, PermissionsEnum.ORG_TASK_EDIT];

	const signIn = { id: 'user-1', tenantId: 'tenant' };
	const fromApiToken = { ...signIn, [USER_API_TOKEN_CLAIM]: 'api-token-id' };

	function build(account: Record<string, unknown> = {}) {
		const authService = {
			getAuthenticatedUser: jest.fn(async () => ({
				id: 'user-1',
				tenantId: 'tenant',
				roleId: 'role-1',
				isActive: true,
				isArchived: false,
				...account
			}))
		};
		const roleAuthorizationService = {
			attachAuthorizationState: jest.fn(async (user: any) => {
				user.role = { id: 'role-1', name: 'EMPLOYEE', tenantId: 'tenant' };
				user.permissions = ROLE_PERMISSIONS;
				return user;
			})
		};
		return new JwtStrategy(
			authService as any,
			{ findOneByIdString: jest.fn() } as any,
			{ findOneByOptions: jest.fn() } as any,
			roleAuthorizationService as any,
			new AuthenticatedUserCache({ ttlMs: 0, ormType: 'typeorm' })
		);
	}

	it('gives it the same user, role and permissions as a sign-in', async () => {
		const strategy = build();

		const viaSignIn = await strategy.validate(signIn);
		const viaApiToken = await strategy.validate(fromApiToken);

		expect(viaApiToken).toEqual(viaSignIn);
		expect(viaApiToken.permissions).toEqual(ROLE_PERMISSIONS);
	});

	it.each([
		['deactivated', { isActive: false }],
		['archived', { isArchived: true }]
	])('refuses it once the user is %s', async (_how, account) => {
		await expect(build(account).validate(fromApiToken)).rejects.toThrow(UnauthorizedException);
	});
});
