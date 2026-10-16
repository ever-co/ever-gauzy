import '../../../core/entities/internal';

import { ITaskCreateInput } from '@gauzy/contracts';
import { asTenantUser, createTenantFixture } from '../../../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { AutomationTaskSyncHandler } from './automation-task.sync.handler';

/**
 * #10724 — a soft-deleted task keeps its number in the `taskNumber` unique index, so a task the GitHub sync creates
 * is numbered above every task of its project, soft-deleted ones included.
 */
describe('AutomationTaskSyncHandler.createTask — the number of a synced task', () => {
	const fixture = createTenantFixture({ user: { employeeId: 'employee-1' } as never });

	let restore: () => void;
	let taskService: { getMaxTaskNumberByProject: jest.Mock };
	let saved: jest.Mock;
	let self: Record<string, unknown>;

	beforeEach(() => {
		({ restore } = asTenantUser(fixture));
		taskService = { getMaxTaskNumberByProject: jest.fn().mockResolvedValue(5) };
		saved = jest.fn(async (task) => ({ id: 'task-1', ...task }));
		self = {
			_taskService: taskService,
			typeOrmTaskRepository: { create: jest.fn((task) => task), save: saved },
			_eventBus: { publish: jest.fn() },
			activityLogService: { logActivity: jest.fn() }
		};
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
	});

	afterEach(() => {
		restore();
		jest.restoreAllMocks();
	});

	it('numbers the task above every task of the project, soft-deleted ones included', async () => {
		const options = { projectId: 'project-1', organizationId: fixture.organizationId, tenantId: fixture.tenantId };

		await AutomationTaskSyncHandler.prototype.createTask.call(self, options, {
			title: 'Synced issue',
			members: []
		} as ITaskCreateInput);

		expect(taskService.getMaxTaskNumberByProject).toHaveBeenCalledWith(options, { withDeleted: true });
		expect(saved).toHaveBeenCalledWith(expect.objectContaining({ number: 6 }));
	});
});
