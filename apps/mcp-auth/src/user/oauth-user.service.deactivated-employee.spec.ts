/**
 * The service imports only entity classes and the password hasher from `@gauzy/core`; stand-ins keep the
 * whole core module (and its entity graph) out of this spec.
 */
jest.mock('@gauzy/core', () => ({
	Employee: class Employee {},
	User: class User {},
	PasswordHashService: class PasswordHashService {}
}));

import { FindOperator } from 'typeorm';
import { McpOAuthService } from '../mcp-oauth/mcp-oauth.service';
import { OAuthUserService } from './oauth-user.service';

/**
 * Owner decision 6 (2026-10-22): mcp-auth refuses sign-in and token refresh for a deactivated user **or
 * employee**. The account lookup behind the login form, the refresh grant and the token checks read only
 * the user row (`isActive`, `isArchived`), so an employee deactivated or archived in their organization
 * kept signing in to the MCP server with an active user row.
 */
describe('OAuthUserService — deactivated employees', () => {
	const USER = { id: 'user-1', email: 'someone@example.com', hash: 'hash', isActive: true, isArchived: false };

	type EmployeeRow = { userId: string; isActive: boolean; isArchived: boolean };

	function build(users: Record<string, any>[], employees: EmployeeRow[]) {
		const matches = (row: Record<string, any>, where: Record<string, any>) =>
			Object.entries(where).every(([key, value]) =>
				value instanceof FindOperator ? (value.value as unknown[]).includes(row[key]) : row[key] === value
			);
		const userRepository = {
			findOne: jest.fn(async ({ where }) => users.find((row) => matches(row, where)) ?? null),
			find: jest.fn(async ({ where }) => users.filter((row) => matches(row, where)))
		};
		const employeeRepository = {
			find: jest.fn(async ({ where }) => employees.filter((row) => matches(row, where)))
		};
		const service: OAuthUserService = Object.create(OAuthUserService.prototype);
		Object.assign(service, {
			logger: { error: jest.fn() },
			typeOrmRepository: userRepository,
			typeOrmEmployeeRepository: employeeRepository,
			passwordHashService: { verify: jest.fn(async (password: string) => password === 'right-password') }
		});
		return { service, userRepository, employeeRepository };
	}

	describe('sign-in and the account re-check', () => {
		it('positive control: a user with no employee record signs in', async () => {
			const { service } = build([USER], []);

			expect(await service.authenticateMcpUser(USER.email, 'right-password')).toMatchObject({ id: USER.id });
			expect(await service.getMcpUserInfo(USER.id)).toMatchObject({ id: USER.id });
		});

		it('positive control: an active employee signs in', async () => {
			const { service } = build([USER], [{ userId: USER.id, isActive: true, isArchived: false }]);

			expect(await service.authenticateMcpUser(USER.email, 'right-password')).toMatchObject({ id: USER.id });
		});

		it('refuses a deactivated employee, at sign-in and at every re-check', async () => {
			const { service } = build([USER], [{ userId: USER.id, isActive: false, isArchived: false }]);

			expect(await service.authenticateMcpUser(USER.email, 'right-password')).toBeNull();
			expect(await service.getMcpUserInfo(USER.id)).toBeNull();
		});

		it('refuses an archived employee', async () => {
			const { service } = build([USER], [{ userId: USER.id, isActive: true, isArchived: true }]);

			expect(await service.getMcpUserInfo(USER.id)).toBeNull();
		});

		it('lets an employee deactivated in one organization but active in another sign in', async () => {
			const { service } = build(
				[USER],
				[
					{ userId: USER.id, isActive: false, isArchived: true },
					{ userId: USER.id, isActive: true, isArchived: false }
				]
			);

			expect(await service.getMcpUserInfo(USER.id)).toMatchObject({ id: USER.id });
		});

		it('still refuses a deactivated user row', async () => {
			const { service } = build([{ ...USER, isActive: false }], []);

			expect(await service.getMcpUserInfo(USER.id)).toBeNull();
		});

		it('still reports a failed lookup as a failure, not as a deactivated account', async () => {
			const { service, employeeRepository } = build([USER], []);
			employeeRepository.find.mockRejectedValue(new Error('database unavailable'));

			await expect(service.getMcpUserInfo(USER.id)).rejects.toThrow('database unavailable');
		});
	});

	it('names, in the token, an organization the user is still active in', () => {
		const service: McpOAuthService = Object.create(McpOAuthService.prototype);
		const user = {
			...USER,
			tenantId: 'tenant-1',
			organizations: [
				{ isActive: false, isArchived: true, organization: { id: 'left-organization' } },
				{ isActive: true, isArchived: false, organization: { id: 'current-organization' } }
			]
		};

		expect((service as any).mapMcpUserToAuthPayload(user)).toMatchObject({
			organizationId: 'current-organization'
		});
	});

	describe('findUsersWhoCannotSignIn', () => {
		it('names the deactivated, archived and missing users and the deactivated employees, and no one else', async () => {
			const users = [
				{ ...USER, id: 'admin' },
				{ ...USER, id: 'employee' },
				{ ...USER, id: 'two-organizations' },
				{ ...USER, id: 'former-employee' },
				{ ...USER, id: 'archived-user', isArchived: true },
				{ ...USER, id: 'deactivated-user', isActive: false }
			];
			const employees = [
				{ userId: 'employee', isActive: true, isArchived: false },
				{ userId: 'two-organizations', isActive: false, isArchived: false },
				{ userId: 'two-organizations', isActive: true, isArchived: false },
				{ userId: 'former-employee', isActive: false, isArchived: true }
			];
			const { service } = build(users, employees);

			const ids = [...users.map(({ id }) => id), 'deleted-user'];
			expect((await service.findUsersWhoCannotSignIn(ids)).sort()).toEqual(
				['archived-user', 'deactivated-user', 'deleted-user', 'former-employee'].sort()
			);
		});

		it('asks nothing for no ids', async () => {
			const { service, userRepository } = build([USER], []);

			expect(await service.findUsersWhoCannotSignIn([])).toEqual([]);
			expect(userRepository.find).not.toHaveBeenCalled();
		});

		it('rejects when the lookup fails, so nothing is revoked on a failed lookup', async () => {
			const { service, userRepository } = build([USER], []);
			userRepository.find.mockRejectedValue(new Error('database unavailable'));

			await expect(service.findUsersWhoCannotSignIn([USER.id])).rejects.toThrow('database unavailable');
		});
	});
});
