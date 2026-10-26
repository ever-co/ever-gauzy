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
			where.id === 'project-new' &&
			where.tenantId === fixture.tenantId &&
			where.organizationId === fixture.organizationId
				? { id: 'project-new', name: 'Ever Works' }
				: null
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

		expect(maxNumberBy).toHaveBeenCalledWith(expect.objectContaining({ projectId: 'project-new' }), {
			withDeleted: true
		});
		expect(maxNumberBy.mock.calls.map(([options]) => options.projectId)).toEqual(['project-new']);
		expect(findProject).toHaveBeenCalledWith(OrganizationProject, expect.anything());
		expect(save).toHaveBeenCalledWith(
			expect.objectContaining({ id: 'task-1', projectId: 'project-new', number: 5, prefix: 'Eve' })
		);
		expect(updated).toMatchObject({ projectId: 'project-new', number: 5, prefix: 'Eve' });
	});

	it('numbers the task above the soft-deleted tasks of the project it moves to', async () => {
		// #10724 — the target's highest number, 9, belongs to a soft-deleted task, which keeps it in the
		// `taskNumber` unique index: the live tasks alone (up to 4) would hand out a taken number.
		maxNumberBy.mockImplementation(async ({ projectId }, flags?: { withDeleted?: boolean }) =>
			projectId === 'project-new' ? (flags?.withDeleted ? 9 : 4) : 99
		);

		await service.update('task-1', { projectId: 'project-new' });

		expect(save).toHaveBeenCalledWith(expect.objectContaining({ projectId: 'project-new', number: 10 }));
	});

	it('writes the move in the one save of the update: a failed save leaves the task where it was', async () => {
		save.mockRejectedValueOnce(new Error('a member of another tenant'));

		await expect(service.update('task-1', { projectId: 'project-new' })).rejects.toThrow();

		// No separate write moved or renumbered the task before the save that failed.
		expect(update).not.toHaveBeenCalled();
	});

	it('ignores a stale number and prefix the client sends back with the move', async () => {
		await service.update('task-1', { projectId: 'project-new', number: 12, prefix: 'OLD' } as never);

		expect(save).toHaveBeenCalledWith(
			expect.objectContaining({ id: 'task-1', projectId: 'project-new', number: 5, prefix: 'Eve' })
		);
	});

	it('points a project relation in the input at the project the task moves to', async () => {
		await service.update('task-1', { projectId: 'project-new', project: { id: 'project-old' } } as never);

		expect(save.mock.calls[0][0].project).toEqual({ id: 'project-new' });
	});

	it('refuses a move to a project that is not one of the tenant or organization', async () => {
		findProject.mockResolvedValue(null);

		await expect(service.update('task-1', { projectId: 'project-foreign' })).rejects.toThrow(
			/not one of the task's organization/
		);
		expect(save).not.toHaveBeenCalled();
		expect(update).not.toHaveBeenCalled();
	});

	it("refuses a move to a project of another organization, and counts numbers in the task's organization", async () => {
		await expect(
			service.update('task-1', { projectId: 'project-new', organizationId: 'org-other' } as never)
		).rejects.toThrow(/not one of the task's organization/);
		expect(save).not.toHaveBeenCalled();

		await service.update('task-1', { projectId: 'project-new' });
		expect(findProject).toHaveBeenLastCalledWith(
			OrganizationProject,
			expect.objectContaining({ where: expect.objectContaining({ organizationId: fixture.organizationId }) })
		);
		expect(maxNumberBy).toHaveBeenCalledWith(expect.objectContaining({ organizationId: fixture.organizationId }), {
			withDeleted: true
		});
	});

	it('fails closed when the project cannot be checked: nothing is written', async () => {
		findProject.mockRejectedValue(new Error('connection reset'));
		jest.spyOn(console, 'error').mockImplementation(() => undefined);

		await expect(service.update('task-1', { projectId: 'project-new', prefix: 'XYZ' } as never)).rejects.toThrow();
		expect(save).not.toHaveBeenCalled();
	});

	it('fails closed without an organization to check the project in', async () => {
		jest.spyOn(TenantAwareCrudService.prototype, 'findOneByIdString').mockResolvedValue({
			...stored,
			organizationId: undefined
		} as never);

		await expect(service.update('task-1', { projectId: 'project-new' } as never)).rejects.toThrow(
			/not one of the task's organization/
		);
		expect(findProject).not.toHaveBeenCalled();
		expect(save).not.toHaveBeenCalled();
	});

	it("uses the destination's prefix, never the input's", async () => {
		await service.update('task-1', { projectId: 'project-new', prefix: 'XYZ' } as never);

		expect(save).toHaveBeenCalledWith(
			expect.objectContaining({ projectId: 'project-new', number: 5, prefix: 'Eve' })
		);
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
