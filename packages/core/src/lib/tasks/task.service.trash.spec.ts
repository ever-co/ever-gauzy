import '../core/entities/internal';
import { ForbiddenException } from '@nestjs/common';
import { FindOperator } from 'typeorm';
import { IUser, PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { CrudService } from '../core/crud/crud.service';
import { TenantAwareCrudService } from '../core/crud';
import { MultiORMEnum } from '../core/utils';
import { asTenantUser, createTenantFixture } from '../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { BaseEntityEventTypeEnum } from '../event-bus/base-entity-event';
import { TaskEvent } from '../event-bus/events';
import { isTaskTrashEnabled, TaskTrashEnabledGuard } from './task-trash-enabled';
import { TaskService } from './task.service';

/**
 * The task trash (comments-and-trash P6-P9): a list of the soft-deleted tasks, and the soft delete and restore under
 * the grants a delete takes. Before, no route listed a deleted task, and the inherited soft-delete and restore ran
 * under `ALL_ORG_EDIT` alone while a hard delete admitted `ORG_TASK_DELETE` holders and team managers.
 */
describe('TaskService — the trash', () => {
	const fixture = createTenantFixture({ user: { employeeId: 'caller-employee' } as IUser });
	const TEAM = '3f2e1d0c-9b8a-4766-8554-433221100fed';
	const PROJECT = '4a3b2c1d-0e9f-4877-8665-544332211000';
	const trashed = {
		id: 'task-1',
		title: 'Ship the trash',
		tenantId: fixture.tenantId,
		organizationId: fixture.organizationId,
		projectId: PROJECT,
		deletedAt: new Date('2026-11-10T08:00:00Z'),
		teams: [{ id: TEAM, organizationId: fixture.organizationId }]
	};

	let restore: () => void;
	let publish: jest.Mock;
	let isManager: jest.Mock;
	let service: TaskService;
	let baseFindAll: jest.SpyInstance;

	const published = (): TaskEvent[] => publish.mock.calls.map(([event]) => event);

	const signIn = (permissions: PermissionsEnum[]) => {
		({ restore } = asTenantUser(fixture, { permissions }));
		jest.spyOn(RequestContext, 'hasAnyPermission').mockImplementation((wanted: PermissionsEnum[]) =>
			wanted.some((permission) => permissions.includes(permission))
		);
	};

	/** The options the trash read handed the CRUD base. */
	const read = () => baseFindAll.mock.calls[0][0] as Record<string, any>;

	beforeEach(() => {
		publish = jest.fn();
		isManager = jest.fn().mockResolvedValue(false);
		service = Object.create(TaskService.prototype);
		Object.assign(service, {
			_domainEventBus: { publish },
			_managedEmployeeService: { isManagerOfTeamsOrProjects: isManager },
			ormType: MultiORMEnum.TypeORM
		});
		jest.spyOn(TenantAwareCrudService.prototype, 'findOneByIdString').mockResolvedValue(trashed as never);
		baseFindAll = jest
			.spyOn(TenantAwareCrudService.prototype, 'findAll')
			.mockResolvedValue({ items: [trashed], total: 1 } as never);
	});

	afterEach(() => {
		restore?.();
		jest.restoreAllMocks();
	});

	describe('findTrash (GET /tasks/trash)', () => {
		it('lists the organization’s soft-deleted tasks for a holder of the delete grants, newest deletion first', async () => {
			signIn([PermissionsEnum.ORG_TASK_DELETE]);

			await expect(service.findTrash({ organizationId: fixture.organizationId })).resolves.toEqual({
				items: [trashed],
				total: 1
			});

			const options = read();
			expect(options.withDeleted).toBe(true);
			expect(options.where.organizationId).toBe(fixture.organizationId);
			expect(options.where.deletedAt).toBeInstanceOf(FindOperator);
			expect(options.where.deletedAt.type).toBe('not');
			expect(options.where).not.toHaveProperty('teams');
			expect(options.order).toEqual({ deletedAt: 'DESC', id: 'ASC' });
			expect(options.relations).toEqual({ project: true, teams: true, members: { user: true }, deletedByUser: true });
			expect(options).toMatchObject({ skip: 0, take: 100 });
			expect(isManager).not.toHaveBeenCalled();
		});

		it('keeps the list to a team and a project when they are stated', async () => {
			signIn([PermissionsEnum.ALL_ORG_EDIT]);

			await service.findTrash({ organizationId: fixture.organizationId, organizationTeamId: TEAM, projectId: PROJECT });

			expect(read().where).toMatchObject({ projectId: PROJECT, teams: { id: TEAM } });
		});

		it('lists a team’s trash for a manager of that team', async () => {
			signIn([PermissionsEnum.ORG_TASK_EDIT]);
			isManager.mockResolvedValue(true);

			await service.findTrash({ organizationId: fixture.organizationId, organizationTeamId: TEAM });

			expect(isManager).toHaveBeenCalledWith('caller-employee', [TEAM]);
			expect(read().where).toMatchObject({ teams: { id: TEAM } });
		});

		it('refuses a caller without the delete grants who names no team, or a team they do not manage', async () => {
			signIn([PermissionsEnum.ORG_TASK_EDIT]);

			await expect(service.findTrash({ organizationId: fixture.organizationId })).rejects.toBeInstanceOf(
				ForbiddenException
			);
			await expect(
				service.findTrash({ organizationId: fixture.organizationId, organizationTeamId: TEAM })
			).rejects.toBeInstanceOf(ForbiddenException);
			expect(baseFindAll).not.toHaveBeenCalled();
		});

		it('searches the title, and the number when the text is one', async () => {
			signIn([PermissionsEnum.ORG_TASK_DELETE]);

			await service.findTrash({ organizationId: fixture.organizationId, search: ' trash ' });
			expect(read().where.title).toBeInstanceOf(FindOperator);
			expect(read().where.title.type).toBe('raw');

			baseFindAll.mockClear();
			await service.findTrash({ organizationId: fixture.organizationId, search: '#42' });
			const where = read().where as Record<string, any>[];
			expect(Array.isArray(where)).toBe(true);
			expect(where).toHaveLength(2);
			expect(where[1]).toMatchObject({ number: 42, organizationId: fixture.organizationId });
		});

		it('keeps the page inside 1..100 and the offset at zero or more', async () => {
			signIn([PermissionsEnum.ORG_TASK_DELETE]);

			await service.findTrash({ organizationId: fixture.organizationId, take: 500, skip: -3 });

			expect(read()).toMatchObject({ take: 100, skip: 0 });
		});
	});

	describe('softRemove (DELETE /tasks/:id/soft) and softRecover (PUT /tasks/:id/recover)', () => {
		it('lets a team manager move a task of their team to the trash and back', async () => {
			signIn([PermissionsEnum.ORG_TASK_EDIT]);
			isManager.mockResolvedValue(true);
			const live = { ...trashed, deletedAt: null };
			jest.spyOn(CrudService.prototype, 'softRemove').mockResolvedValue(trashed as never);
			jest.spyOn(CrudService.prototype, 'softRecover').mockResolvedValue(live as never);

			await expect(service.softRemove('task-1')).resolves.toBe(trashed);
			await expect(service.softRecover('task-1')).resolves.toBe(live);

			expect(isManager).toHaveBeenCalledWith('caller-employee', [TEAM]);
			// The restore reads the task among the deleted ones.
			expect(TenantAwareCrudService.prototype.findOneByIdString).toHaveBeenCalledWith('task-1', {
				relations: { teams: true },
				withDeleted: true
			});
			expect(published().map((event) => event.type)).toEqual([
				BaseEntityEventTypeEnum.DELETED,
				BaseEntityEventTypeEnum.UPDATED
			]);
		});

		it('refuses someone who neither holds the delete grants nor manages one of the task’s teams', async () => {
			signIn([PermissionsEnum.ORG_TASK_EDIT]);
			const remove = jest.spyOn(CrudService.prototype, 'softRemove');
			const recover = jest.spyOn(CrudService.prototype, 'softRecover');

			await expect(service.softRemove('task-1')).rejects.toBeInstanceOf(ForbiddenException);
			await expect(service.softRecover('task-1')).rejects.toBeInstanceOf(ForbiddenException);

			expect(remove).not.toHaveBeenCalled();
			expect(recover).not.toHaveBeenCalled();
			expect(published()).toEqual([]);
		});

		it('lets an ORG_TASK_DELETE holder restore any task of the organization, and announces it as an update', async () => {
			signIn([PermissionsEnum.ORG_TASK_DELETE]);
			jest.spyOn(CrudService.prototype, 'softRecover').mockResolvedValue({ ...trashed, deletedAt: null } as never);

			await service.softRecover('task-1');

			expect(isManager).not.toHaveBeenCalled();
			const [event] = published();
			expect(event.type).toBe(BaseEntityEventTypeEnum.UPDATED);
			expect(event.input).toMatchObject({ organizationId: fixture.organizationId, projectId: PROJECT });
		});
	});

	describe('deleteTask (DELETE /tasks/:id) on a trashed task', () => {
		it('deletes it for good, for a team manager too, without announcing a second deletion', async () => {
			signIn([PermissionsEnum.ORG_TASK_EDIT]);
			isManager.mockResolvedValue(true);
			const remove = jest
				.spyOn(TenantAwareCrudService.prototype, 'delete')
				.mockResolvedValue({ affected: 1, raw: [] });

			await expect(service.deleteTask('task-1')).resolves.toEqual({ affected: 1, raw: [] });

			expect(remove).toHaveBeenCalledWith('task-1');
			expect(TenantAwareCrudService.prototype.findOneByIdString).toHaveBeenCalledWith('task-1', {
				relations: { teams: true },
				withDeleted: true
			});
			expect(published()).toEqual([]);
		});
	});
});

describe('GAUZY_TASK_TRASH_ENABLED', () => {
	it('is on only for the exact string true', () => {
		const warn = jest.fn();
		expect(isTaskTrashEnabled({ GAUZY_TASK_TRASH_ENABLED: 'true' }, warn)).toBe(true);
		expect(isTaskTrashEnabled({}, warn)).toBe(false);
		expect(isTaskTrashEnabled({ GAUZY_TASK_TRASH_ENABLED: '' }, warn)).toBe(false);
		expect(isTaskTrashEnabled({ GAUZY_TASK_TRASH_ENABLED: 'false' }, warn)).toBe(false);
		expect(warn).not.toHaveBeenCalled();
		expect(isTaskTrashEnabled({ GAUZY_TASK_TRASH_ENABLED: 'yes' }, warn)).toBe(false);
		expect(warn).toHaveBeenCalledTimes(1);
	});

	it('answers 404 through the guard while off, and lets the route run when on', () => {
		const previous = process.env.GAUZY_TASK_TRASH_ENABLED;
		try {
			delete process.env.GAUZY_TASK_TRASH_ENABLED;
			expect(() => new TaskTrashEnabledGuard().canActivate()).toThrow('TASK_TRASH_DISABLED');
			process.env.GAUZY_TASK_TRASH_ENABLED = 'true';
			expect(new TaskTrashEnabledGuard().canActivate()).toBe(true);
		} finally {
			if (previous === undefined) {
				delete process.env.GAUZY_TASK_TRASH_ENABLED;
			} else {
				process.env.GAUZY_TASK_TRASH_ENABLED = previous;
			}
		}
	});
});
