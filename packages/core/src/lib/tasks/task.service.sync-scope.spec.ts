import '../core/entities/internal';

import { IUser, TaskSyncScopeEnum } from '@gauzy/contracts';
import { TenantAwareCrudService } from '../core/crud';
import { asTenantUser, createTenantFixture } from '../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { TaskService } from './task.service';

/**
 * The integrations decide from the UPDATED event's task whether they may sync it (`syncScope`). A partial save
 * returns only what was written, so `TaskService.update` reads the scope back from the row after the save — not
 * from the copy read before it, which a concurrent scope change may have made stale.
 */
describe('TaskService.update — the returned task carries the persisted sync scope', () => {
	const fixture = createTenantFixture({ user: { employeeId: 'caller-employee' } as IUser });
	const stored = { id: 'task-1', title: 'Stored title', organizationId: fixture.organizationId, members: [], syncScope: TaskSyncScopeEnum.ALL };

	let restore: () => void;
	let readBack: jest.Mock;
	let service: TaskService;

	beforeEach(() => {
		({ restore } = asTenantUser(fixture));
		readBack = jest.fn(async () => ({ id: 'task-1', syncScope: TaskSyncScopeEnum.NONE }));
		// The first read is the task before the save; a read that selects the scope is the read-back after it.
		jest.spyOn(TenantAwareCrudService.prototype, 'findOneByIdString').mockImplementation(async (_id, options?: any) =>
			options?.select?.syncScope ? readBack() : (stored as never)
		);
		// The save returns only what was written, as a partial save does
		jest.spyOn(TenantAwareCrudService.prototype, 'create').mockImplementation(async (entity) => ({ ...entity }) as never);
		service = Object.create(TaskService.prototype);
		Object.assign(service, {
			typeOrmOrganizationSprintTaskHistoryRepository: { save: jest.fn() },
			_entitySubscriptionService: { delete: jest.fn() },
			_activityLogService: { logActivity: jest.fn() },
			_eventBus: { publish: jest.fn() },
			_employeeNotificationService: { publishNotificationEvent: jest.fn() }
		});
	});

	afterEach(() => {
		restore();
		jest.restoreAllMocks();
	});

	it('reads the scope back after a partial save (a concurrent change to `none` is not overwritten)', async () => {
		const updated = await service.update('task-1', { estimate: 3 });

		expect(readBack).toHaveBeenCalledTimes(1);
		expect(updated.syncScope).toBe(TaskSyncScopeEnum.NONE);
	});

	it('keeps a scope the update itself wrote, without a read-back', async () => {
		const updated = await service.update('task-1', { syncScope: TaskSyncScopeEnum.EVER_PLATFORM });

		expect(readBack).not.toHaveBeenCalled();
		expect(updated.syncScope).toBe(TaskSyncScopeEnum.EVER_PLATFORM);
	});

	it('reads a row without a scope as null (= all)', async () => {
		readBack.mockResolvedValueOnce({ id: 'task-1', syncScope: null } as never);

		const updated = await service.update('task-1', { estimate: 3 });

		expect(updated.syncScope).toBeNull();
	});

	it('falls back to the scope read before the save when the read-back fails', async () => {
		readBack.mockRejectedValueOnce(new Error('gone'));

		const updated = await service.update('task-1', { estimate: 3 });

		expect(updated.syncScope).toBe(TaskSyncScopeEnum.ALL);
	});
});
