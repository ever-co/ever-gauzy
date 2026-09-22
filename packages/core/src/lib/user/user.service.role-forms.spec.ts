// Only the shape of UserService is needed here. Importing it for real pulls in the employee/task
// services and the User entity, which drag the whole core entity graph in and hit the pre-existing
// circular import between `core/entities/internal` and the custom validators. Same technique as
// user.service.account-status.spec.ts.
jest.mock('./user.entity', () => ({ User: class User {} }));
jest.mock('./repository/type-orm-user.repository', () => ({ TypeOrmUserRepository: class TypeOrmUserRepository {} }));
jest.mock('./repository/mikro-orm-user.repository', () => ({
	MikroOrmUserRepository: class MikroOrmUserRepository {}
}));
jest.mock('../employee/employee.service', () => ({ EmployeeService: class EmployeeService {} }));
jest.mock('../tasks/task.service', () => ({ TaskService: class TaskService {} }));
jest.mock('../password-hash/password-hash.service', () => ({ PasswordHashService: class PasswordHashService {} }));
jest.mock('./../core/crud', () => ({ TenantAwareCrudService: class TenantAwareCrudService {} }));

import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PermissionsEnum, RolesEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { UserService } from './user.service';
import { UserCreateHandler } from './commands/handlers/user.create.handler';
import { UserCreateCommand } from './commands/user.create.command';

/**
 * GHSA-x4mv-fhwj-g3rp — role privilege escalation through the alternative forms of the role field.
 *
 * `PUT /user/:id` (PROFILE_EDIT, held by every EMPLOYEE) and `POST /user` (ORG_USERS_EDIT, held by
 * ADMIN) checked the role the body assigns by reading `role?.id` and `roleId`. The DTO validator and
 * the ORMs also accept `role` as a bare id string, so `{ "role": "<SUPER_ADMIN role id>" }` was
 * checked as "no role change" and still reached `save()`.
 */
describe('UserService role forms (GHSA-x4mv-fhwj-g3rp)', () => {
	const TENANT = 'tenant-1';
	const EMP = '44444444-4444-4444-8444-444444444444';
	const ADMIN = '66666666-6666-4666-8666-666666666666';
	const SA = '55555555-5555-4555-8555-555555555555';
	const ROLE_NAMES: Record<string, RolesEnum> = { [EMP]: RolesEnum.EMPLOYEE, [ADMIN]: RolesEnum.ADMIN, [SA]: RolesEnum.SUPER_ADMIN };

	const SELF = 'user-self';
	const OTHER = 'user-other';

	interface Caller {
		userId: string;
		roleId: string;
		permissions: PermissionsEnum[];
	}
	const employee: Caller = { userId: SELF, roleId: EMP, permissions: [PermissionsEnum.PROFILE_EDIT] };
	const admin: Caller = {
		userId: SELF,
		roleId: ADMIN,
		permissions: [PermissionsEnum.PROFILE_EDIT, PermissionsEnum.ORG_USERS_EDIT]
	};

	function build(caller: Caller) {
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue(caller.userId);
		jest.spyOn(RequestContext, 'currentRoleId').mockReturnValue(caller.roleId);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'hasPermission').mockImplementation((permission: PermissionsEnum) =>
			caller.permissions.includes(permission)
		);

		// `resolveRoleName` really runs: it reads the role from the (fake) repository, tenant-scoped.
		const manager = {
			findOne: jest.fn(async (_entity: string, { where }: any) =>
				where.tenantId === TENANT && ROLE_NAMES[where.id] ? { id: where.id, name: ROLE_NAMES[where.id] } : null
			)
		};
		const service: UserService = Object.create(UserService.prototype);
		const save = jest.fn(async (entity: any) => entity);
		const create = jest.fn(async (entity: any) => entity);
		Object.assign(service, {
			ormType: 'typeorm',
			typeOrmRepository: { manager },
			// The target of the update currently holds EMPLOYEE (or, for OTHER, the role asked below).
			findOneByIdString: jest.fn(async (id: string) => ({ id, role: { id: EMP, name: RolesEnum.EMPLOYEE } })),
			findOneByWhereOptions: jest.fn(async (where: any) => ({ id: where.id })),
			save,
			create
		});
		return { service, save, create };
	}

	afterEach(() => jest.restoreAllMocks());

	/** The pre-fix self check, verbatim: `[entity.role?.id, entity.roleId].filter(isNotEmpty)`. */
	const preFixSelfCheckPasses = (body: any, currentRoleId: string) =>
		![body.role?.id, body.roleId]
			.filter((id) => id !== undefined && id !== null && id !== '')
			.some((id) => String(id) !== String(currentRoleId));

	describe('updateProfile — self', () => {
		it('CONTROL: the pre-fix self check let a bare-string SUPER_ADMIN role through', () => {
			expect(preFixSelfCheckPasses({ role: SA }, EMP)).toBe(true);
			expect(preFixSelfCheckPasses({ roleId: EMP, role: SA }, EMP)).toBe(true);
		});

		it.each([
			['a bare-string role', { role: SA }],
			['a role object', { role: { id: SA } }],
			['a flat roleId', { roleId: SA }]
		])('refuses an employee escalating itself through %s', async (_label, body) => {
			const { service, save } = build(employee);

			await expect(service.updateProfile(SELF, { ...body } as any)).rejects.toBeInstanceOf(ForbiddenException);
			expect(save).not.toHaveBeenCalled();
		});

		it.each([
			['a role key that references nothing', { role: { id: '' }, roleId: SA }],
			['a number', { role: 42 }],
			['a role / roleId pair that disagrees', { roleId: EMP, role: SA }]
		])('answers 400 for %s, before anything is saved', async (_label, body) => {
			const { service, save } = build(employee);

			await expect(service.updateProfile(SELF, { ...body } as any)).rejects.toBeInstanceOf(BadRequestException);
			expect(save).not.toHaveBeenCalled();
		});

		it('never lets a null role clear the caller role', async () => {
			const { service, save } = build(employee);

			await service.updateProfile(SELF, { role: null, roleId: null, firstName: 'Ada' } as any);

			const saved = save.mock.calls[0][0];
			expect('role' in saved).toBe(false);
			expect('roleId' in saved).toBe(false);
			expect(saved.firstName).toBe('Ada');
		});

		it.each([
			['a bare-string role', { role: EMP }],
			['the full role object the profile form sends', { role: { id: EMP, name: RolesEnum.EMPLOYEE } }],
			['no role at all', {}]
		])('still saves a profile carrying %s (own role unchanged)', async (_label, body) => {
			const { service, save } = build(employee);

			await service.updateProfile(SELF, { ...body, firstName: 'Ada' } as any);

			const saved = save.mock.calls[0][0];
			expect(saved.firstName).toBe('Ada');
			if ('role' in body) {
				// The value that was checked is the value persisted: a string became `{ id }`, and the FK
				// column is pinned to the same id.
				expect(saved.role.id).toBe(EMP);
				expect(saved.roleId).toBe(EMP);
			}
		});
	});

	describe('updateProfile — someone else', () => {
		it('CONTROL: the pre-fix other-user check had no candidate to check for a bare-string role', () => {
			const candidates = [({ role: SA } as any).role?.id, ({ role: SA } as any).roleId].filter(Boolean);
			expect(candidates).toEqual([]);
		});

		it.each([
			['a bare-string role', { role: SA }],
			['a role object', { role: { id: SA } }],
			['a flat roleId', { roleId: SA }]
		])('refuses an ADMIN (no SUPER_ADMIN_EDIT) granting SUPER_ADMIN through %s', async (_label, body) => {
			const { service, save } = build(admin);

			await expect(service.updateProfile(OTHER, { ...body } as any)).rejects.toBeInstanceOf(ForbiddenException);
			expect(save).not.toHaveBeenCalled();
		});

		it('still lets an ADMIN assign an ordinary role, and persists exactly that id', async () => {
			const { service, save } = build(admin);

			await service.updateProfile(OTHER, { role: ADMIN } as any);

			expect(save.mock.calls[0][0]).toEqual(expect.objectContaining({ id: OTHER, role: { id: ADMIN }, roleId: ADMIN }));
		});
	});

	describe('assertCanAssignRoles', () => {
		it('checks a bare-string role', async () => {
			const { service } = build(admin);
			await expect(service.assertCanAssignRoles({ role: SA })).rejects.toBeInstanceOf(ForbiddenException);
		});

		it('refuses a present role key with no usable id instead of checking nothing', async () => {
			const { service } = build(admin);
			await expect(service.assertCanAssignRoles({ role: {} })).rejects.toBeInstanceOf(BadRequestException);
			await expect(service.assertCanAssignRoles({ roleId: '' })).rejects.toBeInstanceOf(BadRequestException);
		});

		it('lets a payload without a role through (nothing is assigned)', async () => {
			const { service } = build(admin);
			await expect(service.assertCanAssignRoles({})).resolves.toBeUndefined();
		});
	});

	describe('UserCreateHandler (POST /user)', () => {
		it.each([
			['a bare-string role', { role: SA }],
			['a role object', { role: { id: SA } }],
			['a flat roleId', { roleId: SA }]
		])('refuses an ADMIN creating a SUPER_ADMIN through %s', async (_label, body) => {
			const { service, create } = build(admin);
			const handler = new UserCreateHandler(service);

			await expect(handler.execute(new UserCreateCommand({ email: 'x@example.com', ...body } as any))).rejects.toBeInstanceOf(
				ForbiddenException
			);
			expect(create).not.toHaveBeenCalled();
		});

		it('refuses a role / roleId pair that disagrees', async () => {
			const { service, create } = build(admin);
			const handler = new UserCreateHandler(service);

			await expect(
				handler.execute(new UserCreateCommand({ email: 'x@example.com', roleId: EMP, role: SA } as any))
			).rejects.toBeInstanceOf(BadRequestException);
			expect(create).not.toHaveBeenCalled();
		});

		it('keeps the role object the UI sends (callers read role.name) and pins roleId to it', async () => {
			const { service, create } = build(admin);
			const handler = new UserCreateHandler(service);
			const role = { id: EMP, name: RolesEnum.EMPLOYEE };

			await handler.execute(new UserCreateCommand({ email: 'x@example.com', role } as any));

			expect(create).toHaveBeenCalledWith(expect.objectContaining({ role, roleId: EMP }));
		});
	});
});
