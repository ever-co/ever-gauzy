import '../core/entities/internal';
import {
	BadRequestException,
	ConflictException,
	ForbiddenException,
	NotFoundException,
	RequestMethod
} from '@nestjs/common';
import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { FindOperator } from 'typeorm';
import { SOFT_DELETABLE_FILTER } from 'mikro-orm-soft-delete';
import { PERMISSIONS_METADATA } from '@gauzy/constants';
import { IUser, PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { CrudService } from '../core/crud/crud.service';
import { TenantAwareCrudService } from '../core/crud';
import { MultiORMEnum } from '../core/utils';
import { asTenantUser, createTenantFixture } from '../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { BaseEntityEventTypeEnum } from '../event-bus/base-entity-event';
import { TaskEvent } from '../event-bus/events';
import { isTaskTrashEnabled, TaskTrashEnabledGuard } from './task-trash-enabled';
import { TaskController } from './task.controller';
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
			_managedEmployeeService: { managesAnyTeam: isManager }
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

		it('refuses a read that names no organization, so it never spans a tenant', async () => {
			signIn([PermissionsEnum.ALL_ORG_EDIT]);

			await expect(service.findTrash({ organizationId: undefined } as never)).rejects.toThrow('state organizationId');
			await service.findTrash({ organization: { id: fixture.organizationId } } as never);

			expect(baseFindAll).toHaveBeenCalledTimes(1);
			expect(read().where.organizationId).toBe(fixture.organizationId);
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

			baseFindAll.mockClear();
			await service.findTrash({ organizationId: fixture.organizationId, search: 'api-42' });
			const byKey = read().where as Record<string, any>[];
			expect(byKey).toHaveLength(2);
			expect(byKey[1]).toMatchObject({ number: 42 });
			expect(byKey[1].prefix).toBeInstanceOf(FindOperator);
			// The prefix is compared in capitals, as the lists show it, whatever case the project's name began with.
			expect(byKey[1].prefix.getSql('prefix')).toBe('UPPER(prefix) = :trashPrefix');
			expect(byKey[1].prefix.objectLiteralParameters).toEqual({ trashPrefix: 'API' });
		});

		it('searches the key without case under MikroORM too', async () => {
			signIn([PermissionsEnum.ORG_TASK_DELETE]);
			jest.spyOn(TaskService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.MikroORM);

			await service.findTrash({ organizationId: fixture.organizationId, search: 'api-42' });

			const byKey = read().where as Record<string, any>[];
			expect(byKey).toHaveLength(2);
			expect(byKey[1]).toMatchObject({ number: 42, organizationId: fixture.organizationId });
			// `$ilike` on PostgreSQL, `$like` (already without case) on MySQL and SQLite; no wildcard added.
			expect(Object.values(byKey[1].prefix)).toEqual(['api']);
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

		it('recognises a manager who may act for every employee (their employee is read off the user)', async () => {
			// currentEmployeeId() answers null for a CHANGE_SELECTED_EMPLOYEE holder.
			signIn([PermissionsEnum.ORG_TASK_EDIT, PermissionsEnum.CHANGE_SELECTED_EMPLOYEE]);
			isManager.mockResolvedValue(true);
			jest.spyOn(CrudService.prototype, 'softRecover').mockResolvedValue({ ...trashed, deletedAt: null } as never);

			await service.softRecover('task-1');

			expect(isManager).toHaveBeenCalledWith('caller-employee', [TEAM]);
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

			// Soft-deleted rows included: MikroORM's soft-delete filter would otherwise keep the statement off the task.
			expect(remove).toHaveBeenCalledWith('task-1', { withDeleted: true });
			expect(TenantAwareCrudService.prototype.findOneByIdString).toHaveBeenCalledWith('task-1', {
				relations: { teams: true },
				withDeleted: true
			});
			expect(published()).toEqual([]);
		});

		it('answers 409 TASK_STILL_REFERENCED when a foreign key refuses the delete, and publishes nothing', async () => {
			signIn([PermissionsEnum.ORG_TASK_DELETE]);
			for (const cause of [
				Object.assign(new Error('violates foreign key constraint'), { code: '23503' }),
				Object.assign(new Error('Cannot delete or update a parent row'), { code: 'ER_ROW_IS_REFERENCED_2' }),
				Object.assign(new Error('FOREIGN KEY constraint failed'), { code: 'SQLITE_CONSTRAINT_FOREIGNKEY' }),
				Object.assign(new Error('delete failed'), { name: 'ForeignKeyConstraintViolationException' })
			]) {
				jest.spyOn(TenantAwareCrudService.prototype, 'delete').mockRejectedValueOnce(
					new NotFoundException('The record was not found', { cause })
				);
				const refusal = await service.deleteTask('task-1').catch((error: unknown) => error);
				expect(refusal).toBeInstanceOf(ConflictException);
				expect((refusal as ConflictException).message).toContain('TASK_STILL_REFERENCED');
				expect((refusal as ConflictException).message).toContain('was not deleted');
			}
			expect(published()).toEqual([]);
		});

		it('passes any other failure through as it was (a 404)', async () => {
			signIn([PermissionsEnum.ORG_TASK_DELETE]);
			const failure = new NotFoundException('The record was not found', { cause: new Error('connection reset') });
			jest.spyOn(TenantAwareCrudService.prototype, 'delete').mockRejectedValueOnce(failure);

			await expect(service.deleteTask('task-1')).rejects.toBe(failure);
		});
	});

	/**
	 * Delete forever, from the trash only. The trash pages called `DELETE /tasks/:id`, which deletes a live task too:
	 * a task someone restored while the page was open was deleted for good. The statement now requires the task to be
	 * in the trash; `task.service.delete-trashed.dual-orm.spec.ts` runs it on both ORMs against a database.
	 */
	describe('deleteTrashedTask (DELETE /tasks/:id/trashed)', () => {
		let typeOrmDelete: jest.Mock;
		let nativeDelete: jest.Mock;

		/** The criteria of the one TypeORM statement. */
		const statement = () => typeOrmDelete.mock.calls[0][0] as Record<string, unknown>;

		beforeEach(() => {
			typeOrmDelete = jest.fn().mockResolvedValue({ raw: [{ driver: 'detail' }], affected: 1 });
			nativeDelete = jest.fn().mockResolvedValue(1);
			Object.assign(service, {
				typeOrmRepository: { delete: typeOrmDelete },
				mikroOrmRepository: { nativeDelete }
			});
			jest.spyOn(TaskService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);
		});

		it('deletes a trashed task in one statement that requires it to be in the trash, reading nothing first', async () => {
			signIn([PermissionsEnum.ORG_TASK_DELETE]);

			await expect(service.deleteTrashedTask('task-1', fixture.organizationId)).resolves.toEqual({
				raw: [],
				affected: 1
			});

			expect(typeOrmDelete).toHaveBeenCalledTimes(1);
			expect(statement()).toMatchObject({
				id: 'task-1',
				tenantId: fixture.tenantId,
				organizationId: fixture.organizationId
			});
			// `deletedAt IS NOT NULL`, in the statement's own WHERE.
			const deletedAt = statement().deletedAt as FindOperator<unknown>;
			expect(deletedAt).toBeInstanceOf(FindOperator);
			expect(deletedAt.type).toBe('not');
			expect((deletedAt.child as FindOperator<unknown>).type).toBe('isNull');
			expect(TenantAwareCrudService.prototype.findOneByIdString).not.toHaveBeenCalled();
			// The task published DELETED when it went to the trash.
			expect(published()).toEqual([]);
		});

		it('answers 404 for a task that is not in the trash (a live one), which the statement leaves', async () => {
			signIn([PermissionsEnum.ALL_ORG_EDIT]);
			typeOrmDelete.mockResolvedValue({ raw: [], affected: 0 });

			const answer = service.deleteTrashedTask('task-1', fixture.organizationId);

			await expect(answer).rejects.toBeInstanceOf(NotFoundException);
			await expect(answer).rejects.toThrow('TASK_NOT_IN_TRASH');
			expect(typeOrmDelete).toHaveBeenCalledTimes(1);
			expect(published()).toEqual([]);
		});

		it('keeps the statement to the caller’s tenant: another tenant’s task matches no row and is a 404', async () => {
			signIn([PermissionsEnum.ORG_TASK_DELETE]);
			typeOrmDelete.mockResolvedValue({ raw: [], affected: 0 });

			await expect(service.deleteTrashedTask('foreign-task', fixture.organizationId)).rejects.toBeInstanceOf(
				NotFoundException
			);

			expect(statement().tenantId).toBe(fixture.tenantId);
		});

		it('answers 404 for another organization, outside the caller’s boundary, without a statement', async () => {
			signIn([PermissionsEnum.ORG_TASK_DELETE]);

			await expect(service.deleteTrashedTask('task-1', 'another-organization')).rejects.toBeInstanceOf(
				NotFoundException
			);

			expect(typeOrmDelete).not.toHaveBeenCalled();
		});

		it('answers 404 without a tenant in context, and 400 without an organization', async () => {
			signIn([PermissionsEnum.ORG_TASK_DELETE]);

			await expect(service.deleteTrashedTask('task-1', undefined)).rejects.toBeInstanceOf(BadRequestException);
			(RequestContext.currentTenantId as jest.Mock).mockReturnValue(null);
			await expect(service.deleteTrashedTask('task-1', fixture.organizationId)).rejects.toBeInstanceOf(
				NotFoundException
			);

			expect(typeOrmDelete).not.toHaveBeenCalled();
		});

		it('lets a manager of one of the task’s teams delete it from the trash, as the restore does', async () => {
			signIn([PermissionsEnum.ORG_TASK_EDIT]);
			isManager.mockResolvedValue(true);

			await service.deleteTrashedTask('task-1', fixture.organizationId);

			expect(isManager).toHaveBeenCalledWith('caller-employee', [TEAM]);
			expect(TenantAwareCrudService.prototype.findOneByIdString).toHaveBeenCalledWith('task-1', {
				relations: { teams: true },
				withDeleted: true
			});
			expect(typeOrmDelete).toHaveBeenCalledTimes(1);
		});

		it('refuses someone who neither holds the delete grants nor manages one of the task’s teams', async () => {
			signIn([PermissionsEnum.ORG_TASK_EDIT]);

			await expect(service.deleteTrashedTask('task-1', fixture.organizationId)).rejects.toBeInstanceOf(
				ForbiddenException
			);

			expect(typeOrmDelete).not.toHaveBeenCalled();
		});

		it('answers 409 when the database refuses the delete because other records still point at the task', async () => {
			signIn([PermissionsEnum.ORG_TASK_DELETE]);
			// TypeORM's QueryFailedError carries the driver's code; MikroORM throws its own exception class.
			const refusals = [
				Object.assign(new Error('update or delete on table "task" violates foreign key constraint'), {
					code: '23503'
				}),
				{ name: 'QueryFailedError', message: 'failed', driverError: { code: 'ER_ROW_IS_REFERENCED_2' } },
				Object.assign(new Error('FOREIGN KEY constraint failed'), {
					name: 'ForeignKeyConstraintViolationException'
				})
			];

			for (const refusal of refusals) {
				typeOrmDelete.mockRejectedValueOnce(refusal);
				const answer = service.deleteTrashedTask('task-1', fixture.organizationId);
				await expect(answer).rejects.toBeInstanceOf(ConflictException);
				await expect(answer).rejects.toThrow('TASK_STILL_REFERENCED');
			}
		});

		it('lets any other failure of the statement through as it is', async () => {
			signIn([PermissionsEnum.ORG_TASK_DELETE]);
			const outage = Object.assign(new Error('connection terminated'), { code: 'ECONNRESET' });
			typeOrmDelete.mockRejectedValueOnce(outage);

			await expect(service.deleteTrashedTask('task-1', fixture.organizationId)).rejects.toBe(outage);
		});

		it('states the same statement on MikroORM, with the soft-delete filter lifted so a trashed row can match', async () => {
			signIn([PermissionsEnum.ORG_TASK_DELETE]);
			jest.spyOn(TaskService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.MikroORM);

			await expect(service.deleteTrashedTask('task-1', fixture.organizationId)).resolves.toEqual({
				raw: [],
				affected: 1
			});

			expect(nativeDelete).toHaveBeenCalledWith(
				{
					id: 'task-1',
					tenantId: fixture.tenantId,
					organizationId: fixture.organizationId,
					deletedAt: { $ne: null }
				},
				{ filters: { [SOFT_DELETABLE_FILTER]: false } }
			);

			nativeDelete.mockResolvedValue(0);
			await expect(service.deleteTrashedTask('task-1', fixture.organizationId)).rejects.toBeInstanceOf(
				NotFoundException
			);
			expect(typeOrmDelete).not.toHaveBeenCalled();
		});
	});
});

describe('TaskController — DELETE /tasks/:id/trashed', () => {
	const route = TaskController.prototype.deleteTrashed;

	it('is served on its own path, under the grants of the trash and restore routes, behind the trash switch', () => {
		expect(Reflect.getMetadata(PATH_METADATA, route)).toBe('/:id/trashed');
		expect(Reflect.getMetadata(METHOD_METADATA, route)).toBe(RequestMethod.DELETE);
		expect(Reflect.getMetadata(GUARDS_METADATA, route)).toEqual([TaskTrashEnabledGuard]);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, route)).toEqual(
			Reflect.getMetadata(PERMISSIONS_METADATA, TaskController.prototype.softRecover)
		);
		expect(Reflect.getMetadata(PERMISSIONS_METADATA, route)).toEqual([
			PermissionsEnum.ALL_ORG_EDIT,
			PermissionsEnum.ORG_TASK_DELETE,
			PermissionsEnum.ORG_TASK_EDIT
		]);
	});

	it('hands the service the organization the query names, by id or by object', async () => {
		const deleteTrashedTask = jest.fn().mockResolvedValue({ raw: [], affected: 1 });
		const controller = Object.create(TaskController.prototype);
		Object.assign(controller, { taskService: { deleteTrashedTask } });

		await controller.deleteTrashed('task-1', { organizationId: 'organization-1' } as never);
		await controller.deleteTrashed('task-2', { organization: { id: 'organization-2' } } as never);

		expect(deleteTrashedTask.mock.calls).toEqual([
			['task-1', 'organization-1'],
			['task-2', 'organization-2']
		]);
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
