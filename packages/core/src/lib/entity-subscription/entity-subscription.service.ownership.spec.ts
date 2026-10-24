import '../core/entities/internal';

import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { BaseEntityEnum, IUser, PermissionsEnum, RolesEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { TenantAwareCrudService } from '../core/crud';
import { CrudService } from '../core/crud/crud.service';
import { MultiORMEnum } from '../core/utils';
import { InMemoryTenantRepository } from '../core/testing/tenant-isolation/in-memory-tenant-repository';
import { asTenantUser } from '../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { EntitySubscription } from './entity-subscription.entity';
import { EntitySubscriptionService } from './entity-subscription.service';

/**
 * Owner decision 2 (2026-10-22), GHSA-v79w-54p2-wmh5: the entity-subscription routes state no permission, so any
 * member of the tenant reached them. A subscription is now changed, withdrawn, restored or unsubscribed only by the
 * employee it belongs to, or a tenant administrator. Its author, for this rule, is the subscriber (`employeeId`):
 * the subscription a mention creates is filed by the author of the mention (`createdByUserId`) for the employee
 * mentioned, and is the mentioned employee's.
 *
 * The service runs for real against an in-memory store, so the ownership read is the tenant-scoped one the routes
 * get; the base write it hands over to is a spy, so a refused call can be seen not to reach it.
 */
describe('EntitySubscriptionService — only the subscriber or a tenant administrator changes a subscription', () => {
	const TENANT = 'a0000000-0000-4000-8000-000000000001';
	const OTHER_TENANT = 'a0000000-0000-4000-8000-000000000002';
	const ORGANIZATION = 'b0000000-0000-4000-8000-000000000001';
	const SUBSCRIPTION = 'c0000000-0000-4000-8000-000000000001';
	const FOREIGN_SUBSCRIPTION = 'c0000000-0000-4000-8000-000000000002';

	const SUBSCRIBER: Partial<IUser> = { id: 'subscriber-user', employeeId: 'subscriber-employee' };
	// Filed the subscription (by mentioning the subscriber), and is not its owner.
	const MENTIONER: Partial<IUser> = { id: 'mentioner-user', employeeId: 'mentioner-employee' };
	const NO_EMPLOYEE: Partial<IUser> = { id: 'viewer-user' };
	const ADMIN: Partial<IUser> = { id: 'admin-user', employeeId: 'admin-employee' };

	let service: EntitySubscriptionService;
	let writes: Record<'update' | 'unsubscribe' | 'softRemove' | 'softRecover', jest.SpyInstance>;

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

	const target = { entity: BaseEntityEnum.Task, entityId: 'task-1', organizationId: ORGANIZATION };
	const calls = {
		update: () => service.update(SUBSCRIPTION, { actorType: 1 } as never),
		unsubscribe: () => service.unsubscribe(SUBSCRIPTION, { ...target }),
		softRemove: () => service.softRemove(SUBSCRIPTION),
		softRecover: () => service.softRecover(SUBSCRIPTION)
	};
	const operations = Object.keys(calls) as Array<keyof typeof calls>;

	beforeEach(() => {
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);

		const repository = new InMemoryTenantRepository<EntitySubscription>(
			new Set(['id', 'tenantId', 'organizationId', 'employeeId'])
		);
		repository.seed({
			id: SUBSCRIPTION,
			tenantId: TENANT,
			...target,
			employeeId: SUBSCRIBER.employeeId,
			createdByUserId: MENTIONER.id
		} as EntitySubscription);
		repository.seed({
			id: FOREIGN_SUBSCRIPTION,
			tenantId: OTHER_TENANT,
			organizationId: 'b0000000-0000-4000-8000-000000000002',
			employeeId: 'foreign-employee',
			createdByUserId: 'foreign-user'
		} as EntitySubscription);

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		service = new EntitySubscriptionService(repository as any, {} as any);

		writes = {
			update: jest.spyOn(TenantAwareCrudService.prototype, 'update').mockResolvedValue({ affected: 1 } as never),
			// `unsubscribe` removes through the base `delete`.
			unsubscribe: jest
				.spyOn(TenantAwareCrudService.prototype, 'delete')
				.mockResolvedValue({ affected: 1 } as never),
			softRemove: jest.spyOn(TenantAwareCrudService.prototype, 'softRemove').mockResolvedValue({} as never),
			softRecover: jest.spyOn(TenantAwareCrudService.prototype, 'softRecover').mockResolvedValue({} as never)
		};
	});

	afterEach(() => jest.restoreAllMocks());

	it.each(operations)('lets the subscriber %s their own subscription', async (operation) => {
		signIn(SUBSCRIBER, RolesEnum.EMPLOYEE);

		await expect(calls[operation]()).resolves.toBeDefined();
		expect(writes[operation]).toHaveBeenCalledTimes(1);
	});

	it.each(operations)(
		'refuses to %s it for the member who filed it for someone else, and writes nothing',
		async (operation) => {
			// A holder of CHANGE_SELECTED_EMPLOYEE is not held to their own employee's rows by the CRUD base.
			signIn(MENTIONER, RolesEnum.MANAGER, [PermissionsEnum.CHANGE_SELECTED_EMPLOYEE]);

			await expect(calls[operation]()).rejects.toBeInstanceOf(ForbiddenException);
			expect(writes[operation]).not.toHaveBeenCalled();
		}
	);

	it.each(operations)(
		'refuses to %s it for a member with no employee record, and writes nothing',
		async (operation) => {
			// The CRUD base keeps such a caller tenant-wide, and `unsubscribe` had no employee of theirs to pin.
			signIn(NO_EMPLOYEE, RolesEnum.VIEWER);

			await expect(calls[operation]()).rejects.toBeInstanceOf(ForbiddenException);
			expect(writes[operation]).not.toHaveBeenCalled();
		}
	);

	it.each(operations)('lets a tenant administrator %s anyone’s subscription', async (operation) => {
		signIn(ADMIN, RolesEnum.ADMIN, [PermissionsEnum.CHANGE_SELECTED_EMPLOYEE]);

		await expect(calls[operation]()).resolves.toBeDefined();
		expect(writes[operation]).toHaveBeenCalledTimes(1);
	});

	it('unsubscribes the subscriber, not the administrator, when a tenant administrator removes it', async () => {
		// The criterion used to pin the caller's own employee, so an administrator who has one removed nothing.
		signIn(ADMIN, RolesEnum.ADMIN, [PermissionsEnum.CHANGE_SELECTED_EMPLOYEE]);

		await service.unsubscribe(SUBSCRIPTION, { ...target });

		const [, options] = writes.unsubscribe.mock.calls[0];
		expect(options.where).not.toHaveProperty('employeeId');
		expect(options.where).toMatchObject({ ...target, tenantId: TENANT });
	});

	it('still answers a subscription of another tenant with 404, not 403', async () => {
		signIn(NO_EMPLOYEE, RolesEnum.VIEWER);

		await expect(service.unsubscribe(FOREIGN_SUBSCRIPTION, { ...target })).rejects.toBeInstanceOf(
			NotFoundException
		);
		expect(writes.unsubscribe).not.toHaveBeenCalled();
	});

	it('keeps a subscriber from handing the subscription to another employee through an edit', async () => {
		signIn(SUBSCRIBER, RolesEnum.EMPLOYEE, [PermissionsEnum.CHANGE_SELECTED_EMPLOYEE]);

		await service.update(SUBSCRIPTION, { actorType: 1, employeeId: 'other-employee' } as never);

		expect(writes.update).toHaveBeenCalledWith(SUBSCRIPTION, { actorType: 1 });
	});
});
