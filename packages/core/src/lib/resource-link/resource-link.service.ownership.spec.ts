import '../core/entities/internal';

import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { BaseEntityEnum, IUser, PermissionsEnum, RolesEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { TenantAwareCrudService } from '../core/crud';
import { CrudService } from '../core/crud/crud.service';
import { MultiORMEnum } from '../core/utils';
import { InMemoryTenantRepository } from '../core/testing/tenant-isolation/in-memory-tenant-repository';
import { asTenantUser } from '../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { ResourceLink } from './resource-link.entity';
import { ResourceLinkService } from './resource-link.service';

/**
 * Owner decision 2 (2026-10-22), GHSA-v79w-54p2-wmh5: the resource-link routes state no permission, so any member of
 * the tenant reached them. A link is now changed, withdrawn, restored or removed only by its author — the user who
 * created it, or the employee it names as its author — or a tenant administrator, and its author is the caller,
 * never an employee the body names.
 *
 * The service runs for real against an in-memory store, so the ownership read is the tenant-scoped one the routes
 * get; the base write it hands over to is a spy, so a refused call can be seen not to reach it.
 */
describe('ResourceLinkService — only the author or a tenant administrator changes a link', () => {
	const TENANT = 'a0000000-0000-4000-8000-000000000001';
	const OTHER_TENANT = 'a0000000-0000-4000-8000-000000000002';
	const ORGANIZATION = 'b0000000-0000-4000-8000-000000000001';
	const LINK = 'c0000000-0000-4000-8000-000000000001';
	const FOREIGN_LINK = 'c0000000-0000-4000-8000-000000000002';

	const AUTHOR: Partial<IUser> = { id: 'author-user', employeeId: 'author-employee' };
	const OTHER_MEMBER: Partial<IUser> = { id: 'other-user', employeeId: 'other-employee' };
	const NO_EMPLOYEE: Partial<IUser> = { id: 'viewer-user' };
	const ADMIN: Partial<IUser> = { id: 'admin-user' };

	let service: ResourceLinkService;
	let employees: { findOneByIdString: jest.Mock };
	let writes: Record<'update' | 'delete' | 'softRemove' | 'softRecover', jest.SpyInstance>;

	/**
	 * Signs a user in, the way a request does: tenant, the organization of their token (`lastOrganizationId`, which the
	 * CRUD base's organization boundary keeps a non-admin inside), employee, permissions, and the role they hold now.
	 */
	const signIn = (user: Partial<IUser>, role: RolesEnum, permissions: PermissionsEnum[] = []) => {
		asTenantUser(
			{
				tenantId: TENANT,
				organizationId: ORGANIZATION,
				user: { ...user, tenantId: TENANT, lastOrganizationId: ORGANIZATION } as IUser
			},
			{ permissions }
		);
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue(user.id);
		jest.spyOn(RequestContext, 'currentRoleName').mockReturnValue(role);
	};

	const calls = {
		update: () => service.update(LINK, { title: 'Renamed' }),
		delete: () => service.delete(LINK),
		softRemove: () => service.softRemove(LINK),
		softRecover: () => service.softRecover(LINK)
	};
	const operations = Object.keys(calls) as Array<keyof typeof calls>;

	beforeEach(() => {
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);

		const repository = new InMemoryTenantRepository<ResourceLink>(
			new Set(['id', 'tenantId', 'organizationId', 'employeeId'])
		);
		repository.seed({
			id: LINK,
			tenantId: TENANT,
			organizationId: ORGANIZATION,
			title: 'Spec',
			entity: BaseEntityEnum.Task,
			employeeId: AUTHOR.employeeId,
			createdByUserId: AUTHOR.id
		} as ResourceLink);
		repository.seed({
			id: FOREIGN_LINK,
			tenantId: OTHER_TENANT,
			organizationId: 'b0000000-0000-4000-8000-000000000002',
			employeeId: 'foreign-employee',
			createdByUserId: 'foreign-user'
		} as ResourceLink);

		employees = { findOneByIdString: jest.fn().mockResolvedValue({ id: 'some-employee' }) };
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		service = new ResourceLinkService(
			repository as any,
			{} as any,
			employees as any,
			{ logActivity: jest.fn() } as any
		);

		// `update` writes through `create()` (save keeps the relations), so the spy for it is `create`.
		writes = {
			update: jest
				.spyOn(TenantAwareCrudService.prototype, 'create')
				.mockImplementation(async (entity) => ({ ...entity }) as never),
			delete: jest.spyOn(TenantAwareCrudService.prototype, 'delete').mockResolvedValue({ affected: 1 } as never),
			softRemove: jest.spyOn(TenantAwareCrudService.prototype, 'softRemove').mockResolvedValue({} as never),
			softRecover: jest.spyOn(TenantAwareCrudService.prototype, 'softRecover').mockResolvedValue({} as never)
		};
	});

	afterEach(() => jest.restoreAllMocks());

	it.each(operations)('lets the author %s their own link', async (operation) => {
		signIn(AUTHOR, RolesEnum.EMPLOYEE);

		await expect(calls[operation]()).resolves.toBeDefined();
		expect(writes[operation]).toHaveBeenCalledTimes(1);
	});

	it.each(operations)(
		'refuses to %s it for another member who may act for selected employees, and writes nothing',
		async (operation) => {
			// A holder of CHANGE_SELECTED_EMPLOYEE is not held to their own employee's rows by the CRUD base.
			signIn(OTHER_MEMBER, RolesEnum.MANAGER, [PermissionsEnum.CHANGE_SELECTED_EMPLOYEE]);

			await expect(calls[operation]()).rejects.toBeInstanceOf(ForbiddenException);
			expect(writes[operation]).not.toHaveBeenCalled();
		}
	);

	it.each(operations)(
		'refuses to %s it for a member with no employee record, and writes nothing',
		async (operation) => {
			// The CRUD base keeps such a caller tenant-wide.
			signIn(NO_EMPLOYEE, RolesEnum.VIEWER);

			await expect(calls[operation]()).rejects.toBeInstanceOf(ForbiddenException);
			expect(writes[operation]).not.toHaveBeenCalled();
		}
	);

	it.each(operations)('lets a tenant administrator %s anyone’s link', async (operation) => {
		signIn(ADMIN, RolesEnum.ADMIN, [PermissionsEnum.CHANGE_SELECTED_EMPLOYEE]);

		await expect(calls[operation]()).resolves.toBeDefined();
		expect(writes[operation]).toHaveBeenCalledTimes(1);
	});

	it('still answers a link of another tenant with 404, not 403', async () => {
		signIn(NO_EMPLOYEE, RolesEnum.VIEWER);

		await expect(service.softRemove(FOREIGN_LINK)).rejects.toBeInstanceOf(NotFoundException);
		expect(writes.softRemove).not.toHaveBeenCalled();
	});

	it('keeps an author from saying through an edit that someone else wrote the link', async () => {
		signIn(AUTHOR, RolesEnum.EMPLOYEE, [PermissionsEnum.CHANGE_SELECTED_EMPLOYEE]);

		await service.update(LINK, {
			title: 'Renamed',
			employeeId: 'other-employee',
			createdByUserId: 'other-user'
		} as never);

		expect(writes.update).toHaveBeenCalledWith({ title: 'Renamed', id: LINK });
	});

	it('files a new link under the caller, never under an employee the body names', async () => {
		// A caller with no employee record of their own used to file the link as written by the employee it named.
		signIn(NO_EMPLOYEE, RolesEnum.VIEWER);

		await service.create({
			title: 'Spec',
			url: 'https://example.com',
			entity: BaseEntityEnum.Task,
			entityId: 'task-1',
			employeeId: 'victim-employee'
		} as never);

		expect(writes.update.mock.calls[0][0]).toMatchObject({ employeeId: undefined, tenantId: TENANT });
		expect(employees.findOneByIdString).not.toHaveBeenCalled();
	});
});
