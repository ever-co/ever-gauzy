// The handlers are exercised with their collaborators stubbed; importing the real services drags in the
// whole core entity graph (pre-existing circular import). Same technique as user.service.account-status.spec.ts.
jest.mock('../auth/auth.service', () => ({ AuthService: class AuthService {} }));
jest.mock('../user-organization/user-organization.services', () => ({
	UserOrganizationService: class UserOrganizationService {}
}));
jest.mock('../employee/employee.service', () => ({ EmployeeService: class EmployeeService {} }));
jest.mock('../candidate/candidate.service', () => ({ CandidateService: class CandidateService {} }));
jest.mock('../email-send/email.service', () => ({ EmailService: class EmailService {} }));
jest.mock('../role/role.service', () => ({ RoleService: class RoleService {} }));
jest.mock('./user.service', () => ({ UserService: class UserService {} }));
jest.mock('../role/repository/type-orm-role.repository', () => ({
	TypeOrmRoleRepository: class TypeOrmRoleRepository {}
}));
jest.mock('../role/repository/mikro-orm-role.repository', () => ({
	MikroOrmRoleRepository: class MikroOrmRoleRepository {}
}));
jest.mock('../core/utils', () => ({
	getORMType: () => 'typeorm',
	MultiORMEnum: { TypeORM: 'typeorm', MikroORM: 'mikro-orm' }
}));

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PermissionsEnum, RolesEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { EmployeeCreateHandler } from '../employee/commands/handlers/employee.create.handler';
import { EmployeeCreateCommand } from '../employee/commands/employee.create.command';
import { CandidateCreateHandler } from '../candidate/commands/handlers/candidate.create.handler';
import { CandidateCreateCommand } from '../candidate/commands/candidate.create.command';
import { AuthRegisterHandler } from '../auth/commands/handlers/auth.register.handler';
import { AuthRegisterCommand } from '../auth/commands/auth.register.command';
import { UserCreateCommand } from './commands/user.create.command';

/**
 * GHSA-x4mv-fhwj-g3rp siblings: every other role-assignment site reads the role in all its forms and
 * persists only the role that was decided/checked.
 */
const TENANT = 'tenant-1';
const EMPLOYEE_ROLE = { id: 'role-employee', name: RolesEnum.EMPLOYEE, tenantId: TENANT };
const CANDIDATE_ROLE = { id: 'role-candidate', name: RolesEnum.CANDIDATE, tenantId: TENANT };
const SA = 'role-super-admin';

afterEach(() => jest.restoreAllMocks());

/** The user payload a handler sent to `UserCreateCommand`. */
function userPayloadOf(commandBus: { execute: jest.Mock }): any {
	const call = commandBus.execute.mock.calls.find(([command]) => command instanceof UserCreateCommand);
	return call?.[0].input;
}

describe('EmployeeCreateHandler / CandidateCreateHandler pin the trusted role', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
	});

	it('CONTROL: the pre-fix spread kept a body user.roleId next to the trusted role', () => {
		const body = { email: 'x@example.com', roleId: SA };
		const preFix: any = { ...body, role: EMPLOYEE_ROLE };
		expect(preFix.roleId).toBe(SA);
		expect(preFix.role.id).toBe(EMPLOYEE_ROLE.id);
	});

	it.each([
		['a body roleId', { roleId: SA }],
		['a bare-string body role', { role: SA }]
	])('employee create drops %s', async (_label, fields) => {
		const commandBus = {
			execute: jest.fn(async (command: any) => ({ id: 'user-1', ...command.input }))
		};
		const handler = new EmployeeCreateHandler(
			commandBus as any,
			{ create: jest.fn(async (input: any) => ({ id: 'employee-1', ...input })) } as any,
			{ addUserToOrganization: jest.fn() } as any,
			{ getPasswordHash: jest.fn(async () => 'digest') } as any,
			{ welcomeUser: jest.fn() } as any,
			{ findOneByWhereOptions: jest.fn(async () => EMPLOYEE_ROLE) } as any,
			{
				findOneByOptions: jest.fn(async () => {
					throw new NotFoundException();
				})
			} as any
		);

		await handler.execute(
			new EmployeeCreateCommand({
				organizationId: 'org-1',
				password: 'correct-horse',
				user: { email: 'x@example.com', ...fields }
			} as any)
		);

		const user = userPayloadOf(commandBus);
		expect(user.role).toBe(EMPLOYEE_ROLE);
		expect(user.roleId).toBe(EMPLOYEE_ROLE.id);
	});

	it.each([
		['a body roleId', { roleId: SA }],
		['a bare-string body role', { role: SA }]
	])('candidate create drops %s', async (_label, fields) => {
		const commandBus = {
			execute: jest.fn(async (command: any) => ({ id: 'user-1', ...command.input }))
		};
		const handler = new CandidateCreateHandler(
			commandBus as any,
			{ getPasswordHash: jest.fn(async () => 'digest') } as any,
			{ create: jest.fn(async (input: any) => ({ id: 'candidate-1', ...input })) } as any,
			{ findOneByWhereOptions: jest.fn(async () => CANDIDATE_ROLE) } as any,
			{ addUserToOrganization: jest.fn() } as any,
			{ welcomeUser: jest.fn() } as any
		);

		await handler.execute(
			new CandidateCreateCommand({ password: 'correct-horse', user: { email: 'x@example.com', ...fields } } as any)
		);

		const user = userPayloadOf(commandBus);
		expect(user.role).toBe(CANDIDATE_ROLE);
		expect(user.roleId).toBe(CANDIDATE_ROLE.id);
	});
});

describe('AuthRegisterHandler reads every role form', () => {
	function build() {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue('admin-1');
		jest.spyOn(RequestContext, 'hasPermission').mockImplementation(
			(permission: PermissionsEnum) => permission !== PermissionsEnum.SUPER_ADMIN_EDIT
		);
		const roles: Record<string, any> = {
			[EMPLOYEE_ROLE.id]: EMPLOYEE_ROLE,
			[SA]: { id: SA, name: RolesEnum.SUPER_ADMIN, tenantId: TENANT }
		};
		const authService = { register: jest.fn(async (input: any) => input.user) };
		const handler = new AuthRegisterHandler(
			authService as any,
			{ findOneByIdString: jest.fn(async () => ({ role: EMPLOYEE_ROLE })) } as any,
			{
				findOneByOrFail: jest.fn(async ({ id }: any) => {
					if (!roles[id]) throw new Error('EntityNotFound');
					return roles[id];
				})
			} as any,
			{ findOneOrFail: jest.fn() } as any
		);
		return { handler, authService };
	}

	it('CONTROL: the pre-fix extraction read a harmless roleId and missed a string role beside it', () => {
		const user: any = { roleId: EMPLOYEE_ROLE.id, role: SA };
		expect([user.roleId, user.role?.id].filter((id) => !!id)).toEqual([EMPLOYEE_ROLE.id]);
	});

	it('refuses a harmless roleId paired with a different (string) role', async () => {
		const { handler, authService } = build();

		await expect(
			handler.execute(
				new AuthRegisterCommand({
					user: { email: 'x@example.com', roleId: EMPLOYEE_ROLE.id, role: SA },
					password: 'correct-horse',
					confirmPassword: 'correct-horse'
				} as any, 'en' as any)
			)
		).rejects.toBeInstanceOf(BadRequestException);
		expect(authService.register).not.toHaveBeenCalled();
	});

	it('still registers the role object the admin UI sends, with roleId pinned to it', async () => {
		const { handler, authService } = build();

		await handler.execute(
			new AuthRegisterCommand({
				user: { email: 'x@example.com', role: EMPLOYEE_ROLE },
				password: 'correct-horse',
				confirmPassword: 'correct-horse'
			} as any, 'en' as any)
		);

		const [input] = authService.register.mock.calls[0];
		expect(input.user.role).toBe(EMPLOYEE_ROLE);
		expect(input.user.roleId).toBe(EMPLOYEE_ROLE.id);
	});

	it('still lets a plain self-registration (no role) through', async () => {
		const { handler, authService } = build();

		await handler.execute(
			new AuthRegisterCommand({
				user: { email: 'x@example.com' },
				password: 'correct-horse',
				confirmPassword: 'correct-horse'
			} as any, 'en' as any)
		);

		expect(authService.register).toHaveBeenCalled();
	});
});
