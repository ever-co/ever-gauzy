import '../../../core/entities/internal';

import { ITaskCreateInput, ITaskUpdateInput } from '@gauzy/contracts';
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

/**
 * The description of a synced task is the GitHub issue body, which anyone who can open or edit an issue on the
 * repository writes. This handler saves through the repository, past `TaskService.create()`/`update()`, so it stored
 * that HTML as it came; it now goes through the same allowlist.
 */
describe('AutomationTaskSyncHandler — the description of a synced issue', () => {
	const fixture = createTenantFixture({ user: { employeeId: 'employee-1' } as never });
	const ISSUE_BODY = '<p>Steps</p><img src="x" onerror="alert(document.cookie)"><script>alert(1)</script>';

	let restore: () => void;
	let self: Record<string, unknown>;
	let repository: { create: jest.Mock; save: jest.Mock; merge: jest.Mock };

	beforeEach(() => {
		({ restore } = asTenantUser(fixture));
		repository = {
			create: jest.fn((task) => task),
			save: jest.fn(async (task) => ({ id: 'task-1', ...task })),
			merge: jest.fn((target, source) => Object.assign(target, source))
		};
		self = {
			_taskService: {
				getMaxTaskNumberByProject: jest.fn().mockResolvedValue(0),
				findOneByIdString: jest.fn(async () => ({ id: 'task-1', description: '<p>Before</p>', members: [] }))
			},
			typeOrmTaskRepository: repository,
			_eventBus: { publish: jest.fn() },
			_entitySubscriptionService: { delete: jest.fn() },
			activityLogService: { logActivity: jest.fn() }
		};
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
	});

	afterEach(() => {
		restore();
		jest.restoreAllMocks();
	});

	const expectSafe = (description: string) => {
		expect(description).toContain('<p>Steps</p>');
		expect(description).not.toMatch(/<script|onerror|alert/i);
	};

	it('is sanitized when the issue creates a task', async () => {
		const options = { projectId: 'project-1', organizationId: fixture.organizationId, tenantId: fixture.tenantId };

		await AutomationTaskSyncHandler.prototype.createTask.call(self, options, {
			title: 'Synced issue',
			description: ISSUE_BODY,
			members: []
		} as ITaskCreateInput);

		expectSafe(repository.save.mock.calls[0][0].description);
	});

	it('is sanitized when an edited issue updates its task', async () => {
		await AutomationTaskSyncHandler.prototype.updateTask.call(self, 'task-1', {
			title: 'Synced issue',
			description: ISSUE_BODY,
			members: []
		} as ITaskUpdateInput);

		expectSafe(repository.save.mock.calls[0][0].description);
	});
});
