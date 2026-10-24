import '../core/entities/internal';

import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { IUser, PermissionsEnum, RolesEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { TenantAwareCrudService } from '../core/crud';
import { CrudService } from '../core/crud/crud.service';
import { MultiORMEnum } from '../core/utils';
import { InMemoryTenantRepository } from '../core/testing/tenant-isolation/in-memory-tenant-repository';
import { asTenantUser } from '../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { KeyResultUpdateBulkDeleteCommand } from './commands';
import { KeyResultUpdateBulKDeleteHandler } from './commands/handlers/keyresult-update.bulk.delete.handler';
import { KeyResultUpdateController } from './keyresult-update.controller';
import { KeyResultUpdate } from './keyresult-update.entity';
import { KeyResultUpdateService } from './keyresult-update.service';

/**
 * Owner decision 2 (2026-10-22), GHSA-v79w-54p2-wmh5: the key-result progress-update routes state no permission, so
 * any member of the tenant reached them. An update is now changed, withdrawn, restored or removed only by the user who
 * filed it (`createdByUserId` — `owner` names the employee who owns the key result, whoever filed the update), or a
 * tenant administrator; the bulk removal removes the caller's own updates only.
 *
 * The service runs for real against an in-memory store, so the ownership read is the tenant-scoped one the routes
 * get; the base write it hands over to is a spy, so a refused call can be seen not to reach it.
 */
describe('KeyResultUpdateService — only the author or a tenant administrator changes a progress update', () => {
	const TENANT = 'a0000000-0000-4000-8000-000000000001';
	const OTHER_TENANT = 'a0000000-0000-4000-8000-000000000002';
	const ORGANIZATION = 'b0000000-0000-4000-8000-000000000001';
	const KEY_RESULT = 'd0000000-0000-4000-8000-000000000001';
	const UPDATE = 'c0000000-0000-4000-8000-000000000001';
	const OTHERS_UPDATE = 'c0000000-0000-4000-8000-000000000002';
	const FOREIGN_UPDATE = 'c0000000-0000-4000-8000-000000000003';

	const AUTHOR: Partial<IUser> = { id: 'author-user', employeeId: 'author-employee' };
	const OTHER_MEMBER: Partial<IUser> = { id: 'other-user', employeeId: 'other-employee' };
	const ADMIN: Partial<IUser> = { id: 'admin-user' };

	let service: KeyResultUpdateService;
	let writes: Record<'update' | 'delete' | 'softRemove' | 'softRecover', jest.SpyInstance>;
	let deleteMany: jest.SpyInstance;

	/** Signs a user in, the way a request does: tenant, employee, permissions, and the role they hold now. */
	const signIn = (user: Partial<IUser>, role: RolesEnum, permissions: PermissionsEnum[] = []) => {
		// `lastOrganizationId` is the organization of the token, which the CRUD base's organization boundary keeps a
		// non-admin inside (ever-co/ever-gauzy#11316)
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

	// `PUT /key-result-updates/:id` and `updateKeyResultUpdate` write through `create()` with the id in the payload.
	const calls = {
		update: () => service.create({ id: UPDATE, progress: 50 } as never),
		delete: () => service.delete(UPDATE),
		softRemove: () => service.softRemove(UPDATE),
		softRecover: () => service.softRecover(UPDATE)
	};
	const operations = Object.keys(calls) as Array<keyof typeof calls>;

	beforeEach(() => {
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);

		const repository = new InMemoryTenantRepository<KeyResultUpdate>(
			new Set(['id', 'tenantId', 'organizationId', 'keyResultId'])
		);
		const row = {
			tenantId: TENANT,
			organizationId: ORGANIZATION,
			keyResultId: KEY_RESULT,
			owner: 'owner-employee'
		};
		repository.seed({ ...row, id: UPDATE, createdByUserId: AUTHOR.id } as KeyResultUpdate);
		repository.seed({ ...row, id: OTHERS_UPDATE, createdByUserId: OTHER_MEMBER.id } as KeyResultUpdate);
		repository.seed({
			id: FOREIGN_UPDATE,
			tenantId: OTHER_TENANT,
			organizationId: 'b0000000-0000-4000-8000-000000000002',
			keyResultId: KEY_RESULT,
			createdByUserId: 'foreign-user'
		} as KeyResultUpdate);

		// The key result and goal services are reached only when a new update is filed, which this spec does not do
		// (keyresult-update.service.apply-progress.spec.ts covers it)
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		service = new KeyResultUpdateService(repository as any, {} as any, {} as any, {} as any);

		writes = {
			update: jest
				.spyOn(TenantAwareCrudService.prototype, 'create')
				.mockImplementation(async (entity) => ({ ...entity }) as never),
			delete: jest.spyOn(TenantAwareCrudService.prototype, 'delete').mockResolvedValue({ affected: 1 } as never),
			softRemove: jest.spyOn(TenantAwareCrudService.prototype, 'softRemove').mockResolvedValue({} as never),
			softRecover: jest.spyOn(TenantAwareCrudService.prototype, 'softRecover').mockResolvedValue({} as never)
		};
		deleteMany = jest
			.spyOn(TenantAwareCrudService.prototype, 'deleteMany')
			.mockImplementation(async (ids) => ({ affected: ids.length, raw: [] }) as never);
	});

	afterEach(() => jest.restoreAllMocks());

	it.each(operations)('lets the author %s their own update', async (operation) => {
		signIn(AUTHOR, RolesEnum.EMPLOYEE);

		await expect(calls[operation]()).resolves.toBeDefined();
		expect(writes[operation]).toHaveBeenCalledTimes(1);
	});

	it.each(operations)('refuses to %s it for another member, and writes nothing', async (operation) => {
		signIn(OTHER_MEMBER, RolesEnum.MANAGER, [PermissionsEnum.CHANGE_SELECTED_EMPLOYEE]);

		await expect(calls[operation]()).rejects.toBeInstanceOf(ForbiddenException);
		expect(writes[operation]).not.toHaveBeenCalled();
	});

	it.each(operations)('lets a tenant administrator %s anyone’s update', async (operation) => {
		signIn(ADMIN, RolesEnum.ADMIN, [PermissionsEnum.CHANGE_SELECTED_EMPLOYEE]);

		await expect(calls[operation]()).resolves.toBeDefined();
		expect(writes[operation]).toHaveBeenCalledTimes(1);
	});

	it('answers an id of another tenant with 404 instead of writing a row under it', async () => {
		signIn(AUTHOR, RolesEnum.EMPLOYEE);

		await expect(service.create({ id: FOREIGN_UPDATE, progress: 50 } as never)).rejects.toBeInstanceOf(
			NotFoundException
		);
		expect(writes.update).not.toHaveBeenCalled();
	});

	it('keeps an author from saying through an edit that someone else filed the update', async () => {
		signIn(AUTHOR, RolesEnum.EMPLOYEE);

		await service.create({ id: UPDATE, progress: 50, createdByUserId: OTHER_MEMBER.id } as never);

		expect(writes.update).toHaveBeenCalledWith({ id: UPDATE, progress: 50 });
	});

	describe('the bulk removal of a key result’s updates', () => {
		const removeAll = () =>
			new KeyResultUpdateBulKDeleteHandler(service).execute(new KeyResultUpdateBulkDeleteCommand(KEY_RESULT));

		it('removes only the caller’s own updates, in the caller’s tenant', async () => {
			signIn(AUTHOR, RolesEnum.EMPLOYEE);

			await removeAll();

			expect(deleteMany).toHaveBeenCalledWith([UPDATE]);
		});

		it('removes every update of the key result in the tenant for a tenant administrator', async () => {
			signIn(ADMIN, RolesEnum.ADMIN, [PermissionsEnum.CHANGE_SELECTED_EMPLOYEE]);

			await removeAll();

			expect(deleteMany.mock.calls[0][0].sort()).toEqual([UPDATE, OTHERS_UPDATE].sort());
		});
	});

	describe('PUT /key-result-updates/:id', () => {
		it('answers a refused change with its 403, not with 202 and an empty body', async () => {
			signIn(OTHER_MEMBER, RolesEnum.MANAGER, [PermissionsEnum.CHANGE_SELECTED_EMPLOYEE]);
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const controller = new KeyResultUpdateController({} as any, service);

			await expect(controller.update(UPDATE, { progress: 50 } as never)).rejects.toBeInstanceOf(
				ForbiddenException
			);
			expect(writes.update).not.toHaveBeenCalled();
		});
	});
});
