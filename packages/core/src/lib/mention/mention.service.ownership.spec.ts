import '../core/entities/internal';

import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { IUser, PermissionsEnum, RolesEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { TenantAwareCrudService } from '../core/crud';
import { CrudService } from '../core/crud/crud.service';
import { MultiORMEnum } from '../core/utils';
import { InMemoryTenantRepository } from '../core/testing/tenant-isolation/in-memory-tenant-repository';
import { asTenantUser } from '../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { Mention } from './mention.entity';
import { MentionService } from './mention.service';

/**
 * Owner decision 2 (2026-10-22), GHSA-v79w-54p2-wmh5: the mention routes state no permission, so any member of the
 * tenant reached them. A mention is now changed, withdrawn, restored or removed only by its author — the user who
 * created it, or the employee it names as its author — or a tenant administrator.
 *
 * The service runs for real against an in-memory store, so the ownership read is the tenant-scoped one the routes
 * get; the base write it hands over to is a spy, so a refused call can be seen not to reach it.
 */
describe('MentionService — only the author or a tenant administrator changes a mention', () => {
	const TENANT = 'a0000000-0000-4000-8000-000000000001';
	const OTHER_TENANT = 'a0000000-0000-4000-8000-000000000002';
	const ORGANIZATION = 'b0000000-0000-4000-8000-000000000001';
	const MENTION = 'c0000000-0000-4000-8000-000000000001';
	const FOREIGN_MENTION = 'c0000000-0000-4000-8000-000000000002';

	const AUTHOR: Partial<IUser> = { id: 'author-user', employeeId: 'author-employee' };
	const OTHER_MEMBER: Partial<IUser> = { id: 'other-user', employeeId: 'other-employee' };
	const NO_EMPLOYEE: Partial<IUser> = { id: 'viewer-user' };
	const ADMIN: Partial<IUser> = { id: 'admin-user' };

	let service: MentionService;
	let writes: Record<'update' | 'delete' | 'softRemove' | 'softRecover', jest.SpyInstance>;

	/** Signs a user in, the way a request does: tenant, employee, permissions, and the role they hold now. */
	const signIn = (user: Partial<IUser>, role: RolesEnum, permissions: PermissionsEnum[] = []) => {
		asTenantUser(
			{ tenantId: TENANT, organizationId: ORGANIZATION, user: { ...user, tenantId: TENANT } as IUser },
			{ permissions }
		);
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue(user.id);
		jest.spyOn(RequestContext, 'currentRoleName').mockReturnValue(role);
	};

	const calls = {
		update: () => service.update(MENTION, { actorType: 1 } as never),
		delete: () => service.delete(MENTION),
		softRemove: () => service.softRemove(MENTION),
		softRecover: () => service.softRecover(MENTION)
	};
	const operations = Object.keys(calls) as Array<keyof typeof calls>;

	beforeEach(() => {
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);

		const repository = new InMemoryTenantRepository<Mention>(
			new Set(['id', 'tenantId', 'organizationId', 'employeeId'])
		);
		repository.seed({
			id: MENTION,
			tenantId: TENANT,
			organizationId: ORGANIZATION,
			employeeId: AUTHOR.employeeId,
			createdByUserId: AUTHOR.id
		} as Mention);
		repository.seed({
			id: FOREIGN_MENTION,
			tenantId: OTHER_TENANT,
			organizationId: 'b0000000-0000-4000-8000-000000000002',
			employeeId: 'foreign-employee',
			createdByUserId: 'foreign-user'
		} as Mention);

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		service = new MentionService(repository as any, {} as any, {} as any, {} as any);

		writes = {
			update: jest.spyOn(TenantAwareCrudService.prototype, 'update').mockResolvedValue({ affected: 1 } as never),
			delete: jest.spyOn(TenantAwareCrudService.prototype, 'delete').mockResolvedValue({ affected: 1 } as never),
			softRemove: jest.spyOn(TenantAwareCrudService.prototype, 'softRemove').mockResolvedValue({} as never),
			softRecover: jest.spyOn(TenantAwareCrudService.prototype, 'softRecover').mockResolvedValue({} as never)
		};
	});

	afterEach(() => jest.restoreAllMocks());

	it.each(operations)('lets the author %s their own mention', async (operation) => {
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

	it.each(operations)('lets a tenant administrator %s anyone’s mention', async (operation) => {
		signIn(ADMIN, RolesEnum.ADMIN, [PermissionsEnum.CHANGE_SELECTED_EMPLOYEE]);

		await expect(calls[operation]()).resolves.toBeDefined();
		expect(writes[operation]).toHaveBeenCalledTimes(1);
	});

	it('still answers a mention of another tenant with 404, not 403', async () => {
		signIn(NO_EMPLOYEE, RolesEnum.VIEWER);

		await expect(service.softRemove(FOREIGN_MENTION)).rejects.toBeInstanceOf(NotFoundException);
		expect(writes.softRemove).not.toHaveBeenCalled();
	});

	it('keeps an author from saying through an edit that someone else wrote the mention', async () => {
		signIn(AUTHOR, RolesEnum.EMPLOYEE, [PermissionsEnum.CHANGE_SELECTED_EMPLOYEE]);

		await service.update(MENTION, {
			actorType: 1,
			employeeId: 'other-employee',
			createdByUserId: 'other-user'
		} as never);

		expect(writes.update).toHaveBeenCalledWith(MENTION, { actorType: 1 });
	});
});
