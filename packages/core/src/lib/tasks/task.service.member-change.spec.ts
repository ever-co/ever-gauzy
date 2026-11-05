import '../core/entities/internal';

import { randomUUID } from 'node:crypto';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import {
	BaseEntityEnum,
	EntitySubscriptionTypeEnum,
	ID,
	IUser,
	PermissionsEnum,
	RolesEnum,
	TaskSyncScopeEnum
} from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { CrudService } from '../core/crud/crud.service';
import { TenantAwareCrudService } from '../core/crud';
import { MultiORMEnum } from '../core/utils';
import { InMemoryTenantRepository } from '../core/testing/tenant-isolation/in-memory-tenant-repository';
import {
	asTenantUser,
	createTenantFixture,
	ITenantFixture
} from '../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { ManagedEmployeeService } from '../employee/managed-employee.service';
import { BaseEntityEventTypeEnum } from '../event-bus/base-entity-event';
import { TaskEvent } from '../event-bus/events/task.event';
import { TaskService } from './task.service';

type Row = Record<string, unknown> & { id?: ID };

interface ILinkWrite {
	op: 'insert' | 'delete';
	target: string;
	taskId: ID;
	employeeId: ID;
}

type MemberChange = 'addMember' | 'removeMember';

/**
 * `PUT` and `DELETE /tasks/:id/members/:employeeId` assign one employee to one task, or take them off it. The full
 * update writes the whole member list, so a client that sent it back to change one member undid any assignment made
 * since it read the task. These routes write the one member link and nothing else on the task.
 *
 * The rule: anyone may assign or unassign themselves; a manager of the task's team (the team's MANAGER role or the
 * manager flag) and an organization admin may also assign or unassign anyone.
 */
describe('TaskService.addMember / removeMember — one member of one task, nothing else written', () => {
	const caller = randomUUID();
	const teammate = randomUUID();
	const team = randomUUID();
	const fixture = createTenantFixture({ user: { employeeId: caller } as IUser });

	let tasks: InMemoryTenantRepository<Row>;
	let memberships: InMemoryTenantRepository<Row>;
	let employees: InMemoryTenantRepository<Row>;
	let linkWrites: ILinkWrite[];
	let onLinkWrite: () => void;
	let entitySubscriptionService: { delete: jest.Mock };
	let eventBus: { publish: jest.Mock };
	let activityLogService: { logActivity: jest.Mock };
	let domainEventBus: { publish: jest.Mock };
	let service: TaskService;
	let stored: Row;
	let restore: (() => void) | undefined;
	let roleName: RolesEnum | null;

	function actAs(tenant: ITenantFixture, permissions: PermissionsEnum[] = []): void {
		({ restore } = asTenantUser(tenant, { permissions }));
	}

	function seedMembership(employeeId: ID, organizationTeamId: ID, flags: Row): void {
		memberships.seed({
			id: randomUUID(),
			tenantId: fixture.tenantId,
			organizationId: fixture.organizationId,
			employeeId,
			organizationTeamId,
			isActive: true,
			isArchived: false,
			...flags
		});
	}

	function setCallerMembership(flags: Row): void {
		const callerRows = memberships.all().filter((row) => row.employeeId === caller);
		callerRows.forEach((row) => Object.assign(row, flags));
	}

	/** The task as each direction needs it: the employee to assign is not on it, the one to take off is. */
	function storeMembersFor(change: MemberChange, employeeId: ID): void {
		const others = (stored.members as Row[]).filter((member) => member.id !== employeeId);
		if (change === 'removeMember') {
			stored.members = [...others, { id: employeeId }];
			return;
		}
		stored.members = others;
	}

	function expectedWrite(change: MemberChange, employeeId: ID): ILinkWrite {
		if (change === 'addMember') {
			return { op: 'insert', target: 'task_employee', taskId: stored.id, employeeId };
		}
		return { op: 'delete', target: 'Task.members', taskId: stored.id, employeeId };
	}

	function change(direction: MemberChange, employeeId: ID, organizationId: ID = fixture.organizationId) {
		return service[direction](stored.id, employeeId, organizationId);
	}

	beforeEach(() => {
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);
		roleName = RolesEnum.EMPLOYEE;
		jest.spyOn(RequestContext, 'currentRoleName').mockImplementation(() => roleName);
		jest.spyOn(RequestContext, 'currentOAuthAppScopes').mockReturnValue(null);

		tasks = new InMemoryTenantRepository<Row>(new Set(['id', 'tenantId', 'organizationId']));
		stored = tasks.seed({
			id: randomUUID(),
			tenantId: fixture.tenantId,
			organizationId: fixture.organizationId,
			projectId: randomUUID(),
			title: 'Ship the release',
			status: 'in-progress',
			estimate: 7200,
			members: [{ id: randomUUID() }],
			teams: [{ id: team, organizationId: fixture.organizationId }]
		});

		employees = new InMemoryTenantRepository<Row>(new Set(['id', 'tenantId', 'organizationId']));
		for (const employeeId of [caller, teammate]) {
			employees.seed({ id: employeeId, tenantId: fixture.tenantId, organizationId: fixture.organizationId });
		}

		linkWrites = [];
		onLinkWrite = () => undefined;
		Object.assign(tasks, {
			manager: {
				findOne: (_entity: unknown, options: { where: Row }) => employees.findOne(options)
			},
			createQueryBuilder: () => ({
				relation: (entity: { name: string }, relation: string) => ({
					of: (taskId: ID) => ({
						remove: async (employeeId: ID) => {
							linkWrites.push({ op: 'delete', target: `${entity.name}.${relation}`, taskId, employeeId });
							onLinkWrite();
						}
					})
				}),
				insert: () => ({
					into: (table: string) => ({
						values: (values: { taskId: ID; employeeId: ID }) => ({
							orIgnore: () => ({
								execute: async () => {
									linkWrites.push({ op: 'insert', target: table, ...values });
									onLinkWrite();
								}
							})
						})
					})
				})
			})
		});

		memberships = new InMemoryTenantRepository<Row>(
			new Set(['id', 'tenantId', 'organizationId', 'employeeId', 'organizationTeamId'])
		);
		seedMembership(caller, team, { isManager: false, role: null });
		seedMembership(teammate, team, { isManager: false, role: null });

		entitySubscriptionService = { delete: jest.fn().mockResolvedValue(undefined) };
		eventBus = { publish: jest.fn() };
		activityLogService = { logActivity: jest.fn() };
		domainEventBus = { publish: jest.fn().mockResolvedValue(undefined) };
		const unused = {} as never;
		service = new TaskService(
			tasks as never,
			unused,
			unused,
			eventBus as never,
			unused,
			entitySubscriptionService as never,
			unused,
			activityLogService as never,
			{ publishNotificationEvent: jest.fn() } as never,
			unused,
			new ManagedEmployeeService(memberships as never, unused),
			domainEventBus as never
		);
	});

	afterEach(() => {
		restore?.();
		restore = undefined;
		jest.restoreAllMocks();
	});

	describe.each<MemberChange>(['addMember', 'removeMember'])('%s', (direction) => {
		it('lets a plain member change their own assignment', async () => {
			storeMembersFor(direction, caller);
			actAs(fixture);

			await change(direction, caller);

			expect(linkWrites).toEqual([expectedWrite(direction, caller)]);
		});

		it('refuses a plain member changing someone else’s assignment, writing nothing', async () => {
			storeMembersFor(direction, teammate);
			actAs(fixture);

			await expect(change(direction, teammate)).rejects.toBeInstanceOf(ForbiddenException);
			expect(linkWrites).toEqual([]);
			expect(entitySubscriptionService.delete).not.toHaveBeenCalled();
			expect(eventBus.publish).not.toHaveBeenCalled();
		});

		it('lets a manager of the task team by role change someone else’s assignment', async () => {
			storeMembersFor(direction, teammate);
			setCallerMembership({ role: { name: RolesEnum.MANAGER } });
			actAs(fixture);

			await change(direction, teammate);

			expect(linkWrites).toEqual([expectedWrite(direction, teammate)]);
		});

		it('lets a member flagged as manager of the task team change someone else’s assignment', async () => {
			storeMembersFor(direction, teammate);
			setCallerMembership({ isManager: true });
			actAs(fixture);

			await change(direction, teammate);

			expect(linkWrites).toEqual([expectedWrite(direction, teammate)]);
		});

		it('does not count a team of another organization the task points at', async () => {
			const foreignTeam = randomUUID();
			stored.teams = [{ id: foreignTeam, organizationId: randomUUID() }];
			seedMembership(caller, foreignTeam, { isManager: true, role: { name: RolesEnum.MANAGER } });
			storeMembersFor(direction, teammate);
			actAs(fixture);

			await expect(change(direction, teammate)).rejects.toBeInstanceOf(ForbiddenException);
			expect(linkWrites).toEqual([]);
		});

		it.each<[string, RolesEnum, PermissionsEnum[]]>([
			['the ADMIN role', RolesEnum.ADMIN, []],
			['the SUPER_ADMIN role', RolesEnum.SUPER_ADMIN, []],
			['the right to act for every employee', RolesEnum.EMPLOYEE, [PermissionsEnum.CHANGE_SELECTED_EMPLOYEE]]
		])('lets a caller with %s change someone else’s assignment', async (_label, role, permissions) => {
			storeMembersFor(direction, teammate);
			roleName = role;
			actAs(fixture, permissions);

			await change(direction, teammate);

			expect(linkWrites).toEqual([expectedWrite(direction, teammate)]);
		});

		it('writes the member link only, leaving every other field of the task as stored', async () => {
			storeMembersFor(direction, caller);
			const before = structuredClone(stored);
			const save = jest.spyOn(tasks, 'save');
			const update = jest.spyOn(tasks, 'update');
			const create = jest.spyOn(TenantAwareCrudService.prototype, 'create');
			actAs(fixture);

			await change(direction, caller);

			expect(save).not.toHaveBeenCalled();
			expect(update).not.toHaveBeenCalled();
			expect(create).not.toHaveBeenCalled();
			expect(tasks.all()).toEqual([before]);
			expect(linkWrites).toHaveLength(1);
			const [[event]] = domainEventBus.publish.mock.calls;
			expect(event).toBeInstanceOf(TaskEvent);
			expect(event.type).toBe(BaseEntityEventTypeEnum.UPDATED);
		});

		it('publishes the sync scope saved after the write, not the one read before it', async () => {
			stored.syncScope = TaskSyncScopeEnum.ALL;
			storeMembersFor(direction, caller);
			onLinkWrite = () => {
				tasks.seed({ ...stored, syncScope: TaskSyncScopeEnum.NONE });
			};
			actAs(fixture);

			await change(direction, caller);

			const [[event]] = domainEventBus.publish.mock.calls;
			expect(event.entity.syncScope).toBe(TaskSyncScopeEnum.NONE);
		});

		it('still records the change, with the none scope, when the saved scope cannot be read back', async () => {
			stored.syncScope = TaskSyncScopeEnum.ALL;
			storeMembersFor(direction, caller);
			onLinkWrite = () => {
				jest.spyOn(tasks, 'findOne').mockRejectedValue(new Error('connection lost'));
			};
			jest.spyOn(console, 'error').mockImplementation(() => undefined);
			actAs(fixture);

			await change(direction, caller);

			expect(activityLogService.logActivity).toHaveBeenCalledTimes(1);
			const [[event]] = domainEventBus.publish.mock.calls;
			expect(event.entity.syncScope).toBe(TaskSyncScopeEnum.NONE);
		});

		it('refuses a task of another tenant as not found, even to an admin', async () => {
			storeMembersFor(direction, teammate);
			const foreign = createTenantFixture({ user: { employeeId: caller } as IUser });
			roleName = RolesEnum.ADMIN;
			actAs(foreign, [PermissionsEnum.CHANGE_SELECTED_EMPLOYEE]);

			await expect(change(direction, teammate)).rejects.toBeInstanceOf(NotFoundException);
			expect(linkWrites).toEqual([]);
		});

		it('refuses a task of another organization of the same tenant as not found', async () => {
			storeMembersFor(direction, caller);
			roleName = RolesEnum.ADMIN;
			actAs(fixture);

			await expect(change(direction, caller, randomUUID())).rejects.toBeInstanceOf(NotFoundException);
			expect(linkWrites).toEqual([]);
		});
	});

	describe('addMember', () => {
		it('subscribes the assigned employee to the task', async () => {
			actAs(fixture);

			await service.addMember(stored.id, caller, fixture.organizationId);

			expect(eventBus.publish).toHaveBeenCalledTimes(1);
			const [[subscription]] = eventBus.publish.mock.calls;
			expect(subscription.input).toMatchObject({
				entity: BaseEntityEnum.Task,
				entityId: stored.id,
				employeeId: caller,
				type: EntitySubscriptionTypeEnum.ASSIGNMENT
			});
		});

		it('changes nothing when the employee is already on the task', async () => {
			storeMembersFor('removeMember', teammate);
			roleName = RolesEnum.ADMIN;
			actAs(fixture);

			await service.addMember(stored.id, teammate, fixture.organizationId);

			expect(linkWrites).toEqual([]);
			expect(domainEventBus.publish).not.toHaveBeenCalled();
		});

		it('refuses an employee of another organization or tenant, even to an admin', async () => {
			const outsider = randomUUID();
			employees.seed({ id: outsider, tenantId: fixture.tenantId, organizationId: randomUUID() });
			const stranger = randomUUID();
			employees.seed({ id: stranger, tenantId: randomUUID(), organizationId: fixture.organizationId });
			roleName = RolesEnum.ADMIN;
			actAs(fixture);

			await expect(service.addMember(stored.id, outsider, fixture.organizationId)).rejects.toBeInstanceOf(
				BadRequestException
			);
			await expect(service.addMember(stored.id, stranger, fixture.organizationId)).rejects.toBeInstanceOf(
				BadRequestException
			);
			expect(linkWrites).toEqual([]);
		});

		it('inserts the one task_employee row under MikroORM, ignoring one that exists', async () => {
			jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.MikroORM);
			const ignore = jest.fn().mockResolvedValue(undefined);
			const onConflict = jest.fn().mockReturnValue({ ignore });
			const insert = jest.fn().mockReturnValue({ onConflict });
			const knex = jest.fn().mockReturnValue({ insert });
			jest.spyOn(TenantAwareCrudService.prototype, 'findOneByIdString').mockResolvedValue(stored as never);
			Object.assign(service, { mikroOrmRepository: { getKnex: () => knex } });
			actAs(fixture);

			await service.addMember(stored.id, caller, fixture.organizationId);

			expect(knex).toHaveBeenCalledWith('task_employee');
			expect(insert).toHaveBeenCalledWith({ taskId: stored.id, employeeId: caller });
			expect(onConflict).toHaveBeenCalledWith(['taskId', 'employeeId']);
			expect(ignore).toHaveBeenCalledTimes(1);
		});
	});

	describe('removeMember', () => {
		it('unsubscribes the employee taken off the task', async () => {
			storeMembersFor('removeMember', caller);
			actAs(fixture);

			await service.removeMember(stored.id, caller, fixture.organizationId);

			expect(entitySubscriptionService.delete).toHaveBeenCalledWith({
				entity: BaseEntityEnum.Task,
				entityId: stored.id,
				employeeId: caller,
				type: EntitySubscriptionTypeEnum.ASSIGNMENT,
				organizationId: fixture.organizationId,
				tenantId: fixture.tenantId
			});
		});

		it('changes nothing when the employee is not on the task', async () => {
			roleName = RolesEnum.ADMIN;
			actAs(fixture);

			await service.removeMember(stored.id, teammate, fixture.organizationId);

			expect(linkWrites).toEqual([]);
			expect(domainEventBus.publish).not.toHaveBeenCalled();
		});

		it('deletes the one task_employee row under MikroORM', async () => {
			storeMembersFor('removeMember', caller);
			jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.MikroORM);
			const del = jest.fn().mockResolvedValue(1);
			const where = jest.fn().mockReturnValue({ del });
			const knex = jest.fn().mockReturnValue({ where });
			jest.spyOn(TenantAwareCrudService.prototype, 'findOneByIdString').mockResolvedValue(stored as never);
			Object.assign(service, { mikroOrmRepository: { getKnex: () => knex } });
			actAs(fixture);

			await service.removeMember(stored.id, caller, fixture.organizationId);

			expect(knex).toHaveBeenCalledWith('task_employee');
			expect(where).toHaveBeenCalledWith({ taskId: stored.id, employeeId: caller });
			expect(del).toHaveBeenCalledTimes(1);
		});
	});
});
