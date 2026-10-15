import '../core/entities/internal';

import { IUser } from '@gauzy/contracts';
import { TenantAwareCrudService } from '../core/crud';
import { OrganizationProject } from '../core/entities/internal';
import { asTenantUser, createTenantFixture } from '../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { TaskService } from './task.service';

/**
 * Moving a task to another project renumbers it. The number used to be computed against the project the
 * task moved FROM (`const { organizationId, projectId } = task` shadowed the new id), and the follow-up save
 * wrote the input's number back anyway — so a moved task kept a number of its old project in the new one:
 * a gap, a duplicate, or a violation of the per-project unique index. It is now the next number of the
 * project the task moves TO, the prefix follows that project, and an update that does not move the task
 * leaves both alone.
 */
describe('TaskService.update — moving a task to another project', () => {
	const fixture = createTenantFixture({ user: { employeeId: 'caller-employee' } as IUser });
	const stored = {
		id: 'task-1',
		title: 'Task 1',
		tenantId: fixture.tenantId,
		organizationId: fixture.organizationId,
		projectId: 'project-old',
		number: 12,
		prefix: 'OLD',
		members: []
	};

	let restore: () => void;
	let service: TaskService;
	let maxNumberBy: jest.Mock;
	let findProject: jest.Mock;
	let update: jest.SpyInstance;
	let save: jest.SpyInstance;

	beforeEach(() => {
		({ restore } = asTenantUser(fixture));
		maxNumberBy = jest.fn(async ({ projectId }) => (projectId === 'project-new' ? 4 : 99));
		findProject = jest.fn(async (_entity, { where }) =>
			where.id === 'project-new' && where.tenantId === fixture.tenantId ? { id: 'project-new', name: 'Ever Works' } : null
		);
		jest.spyOn(TenantAwareCrudService.prototype, 'findOneByIdString').mockResolvedValue(stored as never);
		update = jest.spyOn(TenantAwareCrudService.prototype, 'update').mockResolvedValue({ affected: 1 } as never);
		save = jest
			.spyOn(TenantAwareCrudService.prototype, 'create')
			.mockImplementation(async (entity) => ({ ...stored, ...entity }) as never);
		service = Object.create(TaskService.prototype);
		Object.assign(service, {
			_entitySubscriptionService: { delete: jest.fn(), deleteForEmployee: jest.fn() },
			_activityLogService: { logActivity: jest.fn() },
			_eventBus: { publish: jest.fn() },
			_employeeNotificationService: { publishNotificationEvent: jest.fn() },
			getMaxTaskNumberByProject: maxNumberBy
		});
		Object.defineProperty(service, 'typeOrmRepository', {
			value: { manager: { findOne: findProject } },
			configurable: true
		});
	});

	afterEach(() => {
		restore();
		jest.restoreAllMocks();
	});

	it('numbers the task in the project it moves to, and the prefix follows it', async () => {
		const updated = await service.update('task-1', { projectId: 'project-new' });

		expect(maxNumberBy).toHaveBeenCalledWith(expect.objectContaining({ projectId: 'project-new' }));
		expect(maxNumberBy).not.toHaveBeenCalledWith(expect.objectContaining({ projectId: 'project-old' }));
		expect(findProject).toHaveBeenCalledWith(OrganizationProject, expect.anything());
		expect(update).toHaveBeenCalledWith('task-1', { projectId: 'project-new', number: 5, prefix: 'Eve' });
		expect(updated).toMatchObject({ projectId: 'project-new', number: 5, prefix: 'Eve' });
	});

	it('ignores a stale number the client sends back with the move', async () => {
		await service.update('task-1', { projectId: 'project-new', number: 12, prefix: 'OLD' } as never);

		expect(save).toHaveBeenCalledWith(expect.objectContaining({ id: 'task-1', projectId: 'project-new', number: 5 }));
		expect(save.mock.calls[0][0].prefix).toBe('Eve');
	});

	it('keeps the prefix when the new project cannot be read in the tenant', async () => {
		findProject.mockResolvedValue(null);

		await service.update('task-1', { projectId: 'project-new' });

		expect(update).toHaveBeenCalledWith('task-1', { projectId: 'project-new', number: 5 });
	});

	it('leaves number and prefix alone when the project does not change', async () => {
		await service.update('task-1', { projectId: 'project-old', title: 'Renamed' });
		await service.update('task-1', { title: 'Renamed again' });

		expect(maxNumberBy).not.toHaveBeenCalled();
		expect(update).not.toHaveBeenCalled();
		expect(save.mock.calls[0][0]).not.toHaveProperty('number');
		expect(save.mock.calls[1][0]).not.toHaveProperty('number');
	});
});
