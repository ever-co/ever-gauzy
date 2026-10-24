// Only the shape of UserService is needed here. Importing it for real pulls in the employee/task
// services and the User entity, which drag the whole core entity graph in and hit the pre-existing
// circular import between `core/entities/internal` and the custom validators. Same technique as
// user.service.role-forms.spec.ts.
jest.mock('./user.entity', () => ({ User: class User {} }));
jest.mock('./repository/type-orm-user.repository', () => ({ TypeOrmUserRepository: class TypeOrmUserRepository {} }));
jest.mock('./repository/mikro-orm-user.repository', () => ({
	MikroOrmUserRepository: class MikroOrmUserRepository {}
}));
jest.mock('../employee/employee.service', () => ({ EmployeeService: class EmployeeService {} }));
jest.mock('../tasks/task.service', () => ({ TaskService: class TaskService {} }));
jest.mock('../activity-log/activity-log.service', () => ({ ActivityLogService: class ActivityLogService {} }));
jest.mock('../password-hash/password-hash.service', () => ({ PasswordHashService: class PasswordHashService {} }));
jest.mock('./../core/crud', () => ({ TenantAwareCrudService: class TenantAwareCrudService {} }));

import { ForbiddenException } from '@nestjs/common';
import { PermissionsEnum, RolesEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { UserService } from './user.service';

/**
 * `lastOrganizationId` is the organization a token without an organization claim falls back to
 * (`RequestContext.currentOrganizationId()`), and the one the next sign-in scopes its token to. `PUT /user/:id`
 * and the `updateUser` field wrote it from the body with no membership check, and `PROFILE_EDIT` (every employee
 * holds it) may edit one's own profile — so a user could point themselves at any organization of their tenant and,
 * with the organization boundary on by default (ever-co/ever-gauzy#11316), work inside it.
 */
describe('UserService.updateProfile — the organization a profile points at must be a membership', () => {
	const TENANT = 'tenant-1';
	const EMP = '44444444-4444-4444-8444-444444444444';
	const SELF = 'user-self';
	const OTHER = 'user-other';
	const MEMBER_ORG = 'org-member';
	const STORED_ORG = 'org-stored';
	const FOREIGN_ORG = 'org-not-a-member';

	/** The active memberships the fake store holds, as `userId:organizationId`. */
	const MEMBERSHIPS = new Set([`${SELF}:${MEMBER_ORG}`, `${OTHER}:${MEMBER_ORG}`]);

	interface Caller {
		userId: string;
		permissions: PermissionsEnum[];
	}
	const employee: Caller = { userId: SELF, permissions: [PermissionsEnum.PROFILE_EDIT] };
	const admin: Caller = { userId: SELF, permissions: [PermissionsEnum.PROFILE_EDIT, PermissionsEnum.ORG_USERS_EDIT] };

	function build(caller: Caller, ormType: 'typeorm' | 'mikro-orm' = 'typeorm') {
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue(caller.userId);
		jest.spyOn(RequestContext, 'currentRoleId').mockReturnValue(EMP);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'hasPermission').mockImplementation((permission: PermissionsEnum) =>
			caller.permissions.includes(permission)
		);

		const isMembership = (where: any) =>
			where.tenantId === TENANT &&
			where.isActive === true &&
			where.isArchived === false &&
			MEMBERSHIPS.has(`${where.userId}:${where.organizationId}`)
				? 1
				: 0;
		const typeOrmCount = jest.fn(async (_entity: string, { where }: any) => isMembership(where));
		const mikroOrmCount = jest.fn(async (_entity: string, where: any) => isMembership(where));

		const service: UserService = Object.create(UserService.prototype);
		const save = jest.fn(async (entity: any) => entity);
		Object.assign(service, {
			ormType,
			typeOrmRepository: { manager: { count: typeOrmCount } },
			mikroOrmRepository: { getEntityManager: () => ({ count: mikroOrmCount }) },
			// The user being written: an employee whose stored preference is STORED_ORG.
			findOneByIdString: jest.fn(async (id: string) => ({
				id,
				tenantId: TENANT,
				role: { id: EMP, name: RolesEnum.EMPLOYEE },
				lastOrganizationId: STORED_ORG,
				defaultOrganizationId: STORED_ORG
			})),
			findOneByWhereOptions: jest.fn(async (where: any) => ({ id: where.id })),
			save
		});
		return { service, save, typeOrmCount, mikroOrmCount };
	}

	afterEach(() => jest.restoreAllMocks());

	it.each([
		['lastOrganizationId', { lastOrganizationId: FOREIGN_ORG }],
		['the lastOrganization relation', { lastOrganization: { id: FOREIGN_ORG } }],
		['defaultOrganizationId', { defaultOrganizationId: FOREIGN_ORG }],
		['the defaultOrganization relation', { defaultOrganization: { id: FOREIGN_ORG } }],
		[
			'a member column beside a foreign relation',
			{ lastOrganizationId: MEMBER_ORG, lastOrganization: { id: FOREIGN_ORG } }
		]
	])(
		'refuses a user pointing their own profile at an organization they do not belong to (%s)',
		async (_label, body) => {
			const { service, save } = build(employee);

			await expect(service.updateProfile(SELF, { ...body } as any)).rejects.toBeInstanceOf(ForbiddenException);
			expect(save).not.toHaveBeenCalled();
		}
	);

	it('refuses a non-string organization id rather than looking it up', async () => {
		const { service, save, typeOrmCount } = build(employee);

		await expect(service.updateProfile(SELF, { lastOrganizationId: { $ne: null } } as any)).rejects.toBeInstanceOf(
			ForbiddenException
		);
		expect(typeOrmCount).not.toHaveBeenCalled();
		expect(save).not.toHaveBeenCalled();
	});

	it('refuses an ORG_USERS_EDIT holder pointing someone else at an organization that user does not belong to', async () => {
		const { service, save, typeOrmCount } = build(admin);

		await expect(service.updateProfile(OTHER, { lastOrganizationId: FOREIGN_ORG } as any)).rejects.toBeInstanceOf(
			ForbiddenException
		);
		expect(save).not.toHaveBeenCalled();
		// The membership checked is the one of the user being written, in their tenant.
		expect(typeOrmCount).toHaveBeenCalledWith('UserOrganization', {
			where: { userId: OTHER, organizationId: FOREIGN_ORG, tenantId: TENANT, isActive: true, isArchived: false }
		});
	});

	it('saves an organization the user is an active member of', async () => {
		const { service, save } = build(employee);

		await service.updateProfile(SELF, { lastOrganizationId: MEMBER_ORG, firstName: 'Ada' } as any);

		expect(save).toHaveBeenCalledWith(
			expect.objectContaining({ lastOrganizationId: MEMBER_ORG, firstName: 'Ada' })
		);
	});

	it('checks the membership through MikroORM too', async () => {
		const { service, save, mikroOrmCount } = build(employee, 'mikro-orm');

		await expect(service.updateProfile(SELF, { lastOrganizationId: FOREIGN_ORG } as any)).rejects.toBeInstanceOf(
			ForbiddenException
		);
		expect(save).not.toHaveBeenCalled();

		await service.updateProfile(SELF, { lastOrganizationId: MEMBER_ORG } as any);
		expect(save).toHaveBeenCalledTimes(1);
		expect(mikroOrmCount).toHaveBeenCalledWith('UserOrganization', {
			userId: SELF,
			organizationId: MEMBER_ORG,
			tenantId: TENANT,
			isActive: true,
			isArchived: false
		});
	});

	it.each([
		['clearing the pointer', { lastOrganizationId: null, defaultOrganizationId: null }],
		['restating the stored value', { lastOrganizationId: STORED_ORG, defaultOrganization: { id: STORED_ORG } }],
		['a profile write that names no organization', { firstName: 'Ada' }]
	])('needs no membership for %s', async (_label, body) => {
		const { service, save, typeOrmCount } = build(employee);

		await service.updateProfile(SELF, { ...body } as any);

		expect(typeOrmCount).not.toHaveBeenCalled();
		expect(save).toHaveBeenCalledTimes(1);
	});

	describe('hasActiveOrganizationMembership', () => {
		it('answers false without a lookup when an argument is missing', async () => {
			const { service, typeOrmCount } = build(employee);

			await expect(service.hasActiveOrganizationMembership(SELF, MEMBER_ORG, undefined)).resolves.toBe(false);
			await expect(service.hasActiveOrganizationMembership(SELF, undefined, TENANT)).resolves.toBe(false);
			expect(typeOrmCount).not.toHaveBeenCalled();
		});

		it('answers from an active, non-archived membership in the tenant', async () => {
			const { service } = build(employee);

			await expect(service.hasActiveOrganizationMembership(SELF, MEMBER_ORG, TENANT)).resolves.toBe(true);
			await expect(service.hasActiveOrganizationMembership(SELF, FOREIGN_ORG, TENANT)).resolves.toBe(false);
			await expect(service.hasActiveOrganizationMembership(SELF, MEMBER_ORG, 'another-tenant')).resolves.toBe(
				false
			);
		});
	});
});
