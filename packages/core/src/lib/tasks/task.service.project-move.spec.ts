import '../core/entities/internal';

import { IUser } from '@gauzy/contracts';
import { TenantAwareCrudService } from '../core/crud';
import { OrganizationProject, TaskFormerReference } from '../core/entities/internal';
import { asTenantUser, createTenantFixture } from '../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { TaskService } from './task.service';
import { stubTaskUpdateManager } from './testing/task-update-manager.stub';

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
	let formerReferences: jest.Mock;

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
		const { manager, saves } = stubTaskUpdateManager({ findOne: findProject });
		formerReferences = saves(TaskFormerReference);
		Object.defineProperty(service, 'typeOrmRepository', { value: { manager }, configurable: true });
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

	it('keeps the reference the task held in the project it left, in the transaction of the save', async () => {
		await service.update('task-1', { projectId: 'project-new' });

		expect(formerReferences).toHaveBeenCalledTimes(1);
		expect(formerReferences).toHaveBeenCalledWith({
			taskId: 'task-1',
			projectId: 'project-old',
			number: 12,
			prefix: 'OLD',
			organizationId: fixture.organizationId,
			tenantId: fixture.tenantId
		});
		// The reference is written first: without a transaction (MikroORM), a failed save then leaves a harmless
		// reference to the number the task still holds, instead of a moved task without its old reference.
		const [saveOrder] = save.mock.invocationCallOrder;
		const [referenceOrder] = formerReferences.mock.invocationCallOrder;
		expect(referenceOrder).toBeLessThan(saveOrder);
	});

	it('keeps the reference the task holds when the transaction writes, not the one read before it', async () => {
		// Another move committed between the read of the task and this transaction: the task is MID-3 now
		const { manager, saves, lockedRead } = stubTaskUpdateManager(
			{ findOne: findProject },
			{ id: 'task-1', projectId: 'project-mid', number: 3, prefix: 'MID', organizationId: fixture.organizationId }
		);
		Object.defineProperty(service, 'typeOrmRepository', { value: { manager }, configurable: true });

		await service.update('task-1', { projectId: 'project-new' });

		expect(lockedRead.where).toHaveBeenCalledWith({ id: 'task-1' });
		expect(saves(TaskFormerReference)).toHaveBeenCalledWith(
			expect.objectContaining({ taskId: 'task-1', projectId: 'project-mid', number: 3, prefix: 'MID' })
		);
	});

	it('keeps no reference when the task is already where the update moves it', async () => {
		const { manager, saves } = stubTaskUpdateManager(
			{ findOne: findProject },
			{ id: 'task-1', projectId: 'project-new', number: 5, prefix: 'Eve', organizationId: fixture.organizationId }
		);
		Object.defineProperty(service, 'typeOrmRepository', { value: { manager }, configurable: true });

		await service.update('task-1', {
			projectId: 'project-new',
			number: 12,
			prefix: 'OLD',
			project: { id: 'project-old' }
		} as never);

		expect(saves(TaskFormerReference)).not.toHaveBeenCalled();
		// It keeps the number and prefix it holds there, not the stale ones of a body read before that move, and the
		// body's stale relation does not point the save back at the project it left
		expect(save).toHaveBeenCalledWith(expect.objectContaining({ projectId: 'project-new', number: 5, prefix: 'Eve' }));
		expect(save.mock.calls[0][0].project).toEqual({ id: 'project-new' });
		expect(maxNumberBy).not.toHaveBeenCalled();
	});

	it('moves a task back to the project the body names when an overlapping update moved it away meanwhile', async () => {
		// Read in project-old; by the time this transaction holds the row, another update moved it to MID-3
		const findProjectOrOld = jest.fn(async (entity, { where }) =>
			entity === OrganizationProject && where.id === 'project-old' ? { id: 'project-old', name: 'Old project' } : findProject(entity, { where })
		);
		const { manager, saves } = stubTaskUpdateManager(
			{ findOne: findProjectOrOld },
			{ id: 'task-1', projectId: 'project-mid', number: 3, prefix: 'MID', organizationId: fixture.organizationId }
		);
		Object.defineProperty(service, 'typeOrmRepository', { value: { manager }, configurable: true });

		await service.update('task-1', { projectId: 'project-old', title: 'Renamed', number: 3 } as never);

		expect(findProjectOrOld).toHaveBeenCalledWith(OrganizationProject, expect.objectContaining({ where: expect.objectContaining({ id: 'project-old' }) }));
		expect(save).toHaveBeenCalledWith(expect.objectContaining({ projectId: 'project-old', number: 100, prefix: 'Old' }));
		expect(saves(TaskFormerReference)).toHaveBeenCalledWith(expect.objectContaining({ projectId: 'project-mid', number: 3, prefix: 'MID' }));
	});

	it('fails the move, writing nothing, when the read of a former number fails in the transaction', async () => {
		// On Postgres a failed statement aborts the transaction: the update fails rather than go on as if none existed
		const findOrFail = jest.fn(async (entity, options) => {
			if (entity === TaskFormerReference) throw new Error('canceling statement due to statement timeout');
			return findProject(entity, options);
		});
		const { manager, saves } = stubTaskUpdateManager({ findOne: findOrFail });
		Object.defineProperty(service, 'typeOrmRepository', { value: { manager }, configurable: true });
		jest.spyOn(console, 'error').mockImplementation(() => undefined);

		await expect(service.update('task-1', { projectId: 'project-new' })).rejects.toThrow(/statement timeout/);
		expect(save).not.toHaveBeenCalled();
		expect(saves(TaskFormerReference)).not.toHaveBeenCalled();
	});

	it('fails the move with the read error, writing nothing, when the next number cannot be read in the transaction', async () => {
		const { manager, saves } = stubTaskUpdateManager({ findOne: findProject });
		Object.defineProperty(service, 'typeOrmRepository', { value: { manager }, configurable: true });
		maxNumberBy.mockRejectedValue(new Error('current transaction is aborted, commands ignored until end of transaction block'));
		jest.spyOn(console, 'error').mockImplementation(() => undefined);

		const failure = await service.update('task-1', { projectId: 'project-new' }).catch((error: unknown) => error);

		expect((failure as { getResponse: () => { message: string } }).getResponse().message).toMatch(/current transaction is aborted/);
		expect(save).not.toHaveBeenCalled();
		expect(saves(TaskFormerReference)).not.toHaveBeenCalled();
	});

	describe("the former numbers a project's next number skips", () => {
		const failingReadOn = (inTransaction: boolean) => {
			const reader = Object.create(TaskService.prototype) as TaskService;
			Object.defineProperty(reader, 'typeOrmRepository', {
				value: {
					manager: {
						queryRunner: { isTransactionActive: inTransaction },
						createQueryBuilder: () => {
							throw new Error('canceling statement due to lock timeout');
						}
					}
				},
				configurable: true
			});
			// The live tasks' highest number, read by the other half of the method
			jest.spyOn(reader as never, 'getMaxNumberOfProjectTasks' as never).mockResolvedValue(7 as never);
			return reader;
		};
		const options = { tenantId: fixture.tenantId, organizationId: fixture.organizationId, projectId: 'project-old' };

		it('fail the read inside a transaction (a move): Postgres has aborted it', async () => {
			await expect(failingReadOn(true).getMaxTaskNumberByProject(options, { withDeleted: true })).rejects.toThrow(/lock timeout/);
		});

		it('count as none outside one (a task being created), logged', async () => {
			const logged = jest.spyOn(console, 'error').mockImplementation(() => undefined);

			await expect(failingReadOn(false).getMaxTaskNumberByProject(options, { withDeleted: true })).resolves.toBe(7);
			expect(logged).toHaveBeenCalled();
		});
	});

	it('keeps the reference of a task taken out of its project, which keeps its number', async () => {
		await service.update('task-1', { projectId: null, project: null } as never);

		expect(save).toHaveBeenCalledWith(expect.objectContaining({ projectId: null, project: null }));
		expect(save.mock.calls[0][0]).not.toHaveProperty('number');
		expect(formerReferences).toHaveBeenCalledWith(expect.objectContaining({ projectId: 'project-old', number: 12 }));
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
		// (In the transaction the reference written before it is undone with it.)
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
		expect(findProject).toHaveBeenCalledWith(
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
		expect(formerReferences).not.toHaveBeenCalled();
		expect(save.mock.calls[0][0]).not.toHaveProperty('number');
		expect(save.mock.calls[1][0]).not.toHaveProperty('number');
	});
});
