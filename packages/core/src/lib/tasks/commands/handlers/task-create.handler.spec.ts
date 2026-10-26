import '../../../core/entities/internal';

import { Logger } from '@nestjs/common';
import { ITaskCreateInput } from '@gauzy/contracts';
import { asTenantUser, createTenantFixture } from '../../../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { TaskCreateCommand } from '../task-create.command';
import { TaskCreateHandler } from './task-create.handler';

/**
 * #10724 — a soft-deleted task keeps its number in the `taskNumber` unique index, so a new task is numbered above
 * every task of its project, soft-deleted ones included: `POST /tasks` and `createTask` ask for that number.
 */
describe('TaskCreateHandler — the number of a new task', () => {
	// A caller with no employee record, so the handler does not look one up
	const fixture = createTenantFixture();

	let restore: () => void;
	let taskService: { getMaxTaskNumberByProject: jest.Mock; create: jest.Mock };
	let self: Record<string, unknown>;

	beforeEach(() => {
		({ restore } = asTenantUser(fixture));
		taskService = {
			getMaxTaskNumberByProject: jest.fn().mockResolvedValue(5),
			create: jest.fn(async (task) => ({ id: 'task-1', ...task }))
		};
		self = {
			logger: new Logger('TaskCreateHandlerSpec'),
			_taskService: taskService,
			_organizationProjectService: {
				findOneByIdString: jest.fn().mockResolvedValue({ id: 'project-1', name: 'Gauzy' })
			},
			_cqrsEventBus: { publish: jest.fn() },
			_eventBus: { publish: jest.fn() },
			activityLogService: { logActivity: jest.fn() }
		};
		jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
	});

	afterEach(() => {
		restore();
		jest.restoreAllMocks();
	});

	const create = (input: Partial<ITaskCreateInput>) =>
		TaskCreateHandler.prototype.execute.call(
			self,
			new TaskCreateCommand(
				{ title: 'New task', organizationId: fixture.organizationId, ...input } as ITaskCreateInput,
				false
			)
		);

	it('numbers the task above every task of its project, soft-deleted ones included', async () => {
		await create({ projectId: 'project-1' });

		expect(taskService.getMaxTaskNumberByProject).toHaveBeenCalledWith(
			{ tenantId: fixture.tenantId, organizationId: fixture.organizationId, projectId: 'project-1' },
			{ withDeleted: true }
		);
		expect(taskService.create).toHaveBeenCalledWith(expect.objectContaining({ number: 6, prefix: 'Gau' }));
	});

	it('does the same for a task without a project', async () => {
		await create({});

		expect(taskService.getMaxTaskNumberByProject).toHaveBeenCalledWith(
			{ tenantId: fixture.tenantId, organizationId: fixture.organizationId, projectId: null },
			{ withDeleted: true }
		);
		expect(taskService.create).toHaveBeenCalledWith(expect.objectContaining({ number: 6 }));
	});
});
