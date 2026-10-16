import '../../core/entities/internal';

import { BadRequestException } from '@nestjs/common';
import { DataSource, EntitySchema as TypeOrmEntitySchema } from 'typeorm';
import { BetterSqliteDriver } from '@mikro-orm/better-sqlite';
import { EntityCaseNamingStrategy, EntitySchema as MikroOrmEntitySchema, MikroORM } from '@mikro-orm/core';
import { TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR } from '@gauzy/config';
import { RequestContext } from '../../core/context';
import { TenantAwareCrudService } from '../../core/crud/tenant-aware-crud.service';
import { MultiORMEnum } from '../../core/utils';
import { DailyPlanService } from './daily-plan.service';

const TENANT_ID = '2a5d5f2e-0c4e-4f2b-9a0b-3d6a4b2f1c11';
const ORGANIZATION_ID = '8b1f0e3a-7c2d-4a5e-b6f7-1d2e3f4a5b6c';
const MANAGED_TEAM_ID = '5e6f7a8b-9c0d-4e1f-a2b3-c4d5e6f7a8b9';
const OTHER_TEAM_ID = '7a8b9c0d-1e2f-4a3b-8c4d-5e6f7a8b9c0d';
const PLAN_WITHOUT_TEAM = 'd4c3b2a1-f6e5-4d7c-8b9a-0f1e2d3c4b5a';
const PLAN_OF_MANAGED_TEAM = 'e5d4c3b2-a1f6-4e5d-9c8b-1a0f2e3d4c5b';
const PLAN_OF_OTHER_TEAM = 'f6e5d4c3-b2a1-4f6e-8d9c-2b1a0f3e4d5c';
const TASK_ID = '0f1e2d3c-4b5a-4968-8776-655443322110';
const OTHER_TASK_ID = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
const MANAGER_ID = '6c5b4a39-2817-4f6e-9d8c-7b6a5f4e3d2c';
const MEMBER_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';

/**
 * #10726 — `PUT /daily-plan/:taskId/remove` and the `removeTaskFromDailyPlans` mutation take a task out of many
 * plans of one employee. A request without `plansIds` (the MCP tool, ever-teams "Remove from all plans") answered
 * 400 on `plansIds.length`, the mutation always did because it sends the list as `planIds`, and without a team the
 * TypeORM query compared the plan's team with NULL and never found a plan.
 *
 * Without a team the plans of every team (and of none) are read, and each is kept only when its own team lets the
 * caller manage the owner — the rule a single plan follows. A team manager without CHANGE_SELECTED_EMPLOYEE acts
 * here on a member who also has a plan in a team the manager does not manage.
 */
describe.each([MultiORMEnum.TypeORM, MultiORMEnum.MikroORM])(
	'DailyPlanService.removeTaskFromManyPlans (%s)',
	(ormType) => {
		let service: DailyPlanService;
		let stored: Array<{ id: string; organizationTeamId: string | null; tasks: Array<{ id: string }> }>;
		/** The conditions the TypeORM query was given, a subquery recorded as `subquery`. */
		let conditions: Array<{ condition: string; parameters?: Record<string, unknown> }>;
		let mikroOrmFind: jest.Mock;
		let managedEmployeeService: { canManageEmployee: jest.Mock };
		let saved: jest.SpyInstance;

		beforeEach(() => {
			stored = [
				{ id: PLAN_WITHOUT_TEAM, organizationTeamId: null, tasks: [{ id: TASK_ID }, { id: OTHER_TASK_ID }] },
				{ id: PLAN_OF_MANAGED_TEAM, organizationTeamId: MANAGED_TEAM_ID, tasks: [{ id: TASK_ID }] },
				{ id: PLAN_OF_OTHER_TEAM, organizationTeamId: OTHER_TEAM_ID, tasks: [{ id: TASK_ID }] }
			];
			conditions = [];

			const record = (condition: unknown, parameters?: Record<string, unknown>) => {
				conditions.push({ condition: typeof condition === 'string' ? condition : 'subquery', parameters });
				return query;
			};
			const query = {
				alias: 'daily_plan',
				leftJoinAndSelect: () => query,
				where: record,
				andWhere: record,
				getMany: async () => stored
			};
			mikroOrmFind = jest.fn(async () => stored);

			// The manager manages the member in MANAGED_TEAM_ID, and in "any team" for a plan without one
			managedEmployeeService = {
				canManageEmployee: jest.fn(async (_employeeId: string, teamId?: string) => teamId !== OTHER_TEAM_ID)
			};

			service = new DailyPlanService(
				{ metadata: { tableName: 'daily_plan' }, createQueryBuilder: () => query } as any,
				{ find: mikroOrmFind } as any,
				{} as any,
				{ findOneByIdString: jest.fn(async () => ({ id: TASK_ID })) } as any,
				managedEmployeeService as any
			);
			Object.defineProperty(service, 'ormType', { value: ormType });
			jest.spyOn(DailyPlanService.prototype as any, 'serialize').mockImplementation((entity: object) => entity);
			saved = jest
				.spyOn(TenantAwareCrudService.prototype, 'saveMany')
				.mockImplementation(async (entities) => entities as never);

			jest.spyOn(RequestContext, 'hasPermission').mockReturnValue(false);
			jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT_ID);
			jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue(MANAGER_ID);
			jest.spyOn(RequestContext, 'currentUser').mockReturnValue({
				id: 'c0ffee00-0000-4000-8000-000000000001',
				tenantId: TENANT_ID,
				employeeId: MANAGER_ID
			} as any);
		});

		afterEach(() => jest.restoreAllMocks());

		const remove = (input: Record<string, unknown>) =>
			service.removeTaskFromManyPlans(TASK_ID, {
				employeeId: MEMBER_ID,
				organizationId: ORGANIZATION_ID,
				...input
			} as any);

		/** The plans that reached the save, with the tasks they keep. */
		const savedPlans = () =>
			(saved.mock.calls[0][0] as typeof stored).map(({ id, tasks }) => ({
				id,
				tasks: tasks.map((task) => task.id)
			}));

		/** Whether the read was narrowed to a team. */
		const readByTeam = () =>
			ormType === MultiORMEnum.TypeORM
				? conditions.some(({ condition }) => condition.includes('organizationTeamId'))
				: 'organizationTeamId' in mikroOrmFind.mock.calls[0][0];

		it('takes the task out of every plan holding it when no list is sent (MCP, ever-teams)', async () => {
			await remove({});

			if (ormType === MultiORMEnum.TypeORM) {
				expect(conditions).toContainEqual({ condition: 'subquery', parameters: undefined });
				expect(conditions.some(({ condition }) => condition.includes(':...plansIds'))).toBe(false);
			} else {
				expect(mikroOrmFind.mock.calls[0][0]).toMatchObject({ tasks: { id: TASK_ID } });
				expect(mikroOrmFind.mock.calls[0][0]).not.toHaveProperty('id');
			}
			expect(savedPlans()).toEqual([
				{ id: PLAN_WITHOUT_TEAM, tasks: [OTHER_TASK_ID] },
				{ id: PLAN_OF_MANAGED_TEAM, tasks: [] }
			]);
		});

		it('reads the list the GraphQL mutation sends as planIds', async () => {
			stored = stored.slice(0, 1);

			await remove({ planIds: [PLAN_WITHOUT_TEAM] });

			if (ormType === MultiORMEnum.TypeORM) {
				expect(conditions).toContainEqual(
					expect.objectContaining({ parameters: { plansIds: [PLAN_WITHOUT_TEAM] } })
				);
			} else {
				expect(mikroOrmFind.mock.calls[0][0]).toMatchObject({ id: { $in: [PLAN_WITHOUT_TEAM] } });
			}
			expect(savedPlans()).toEqual([{ id: PLAN_WITHOUT_TEAM, tasks: [OTHER_TASK_ID] }]);
		});

		it('without a team, reads the plans of every team and saves only those whose team lets the caller manage the owner', async () => {
			await remove({ plansIds: [] });

			expect(readByTeam()).toBe(false);
			expect(managedEmployeeService.canManageEmployee).toHaveBeenCalledWith(
				MEMBER_ID,
				OTHER_TEAM_ID,
				ORGANIZATION_ID
			);
			expect(savedPlans().map(({ id }) => id)).toEqual([PLAN_WITHOUT_TEAM, PLAN_OF_MANAGED_TEAM]);
		});

		it('answers not found, and saves nothing, when no plan read lets the caller manage the owner', async () => {
			stored = stored.slice(2);

			await expect(remove({ plansIds: [] })).rejects.toBeInstanceOf(BadRequestException);
			expect(saved).not.toHaveBeenCalled();
		});

		it("with a team, reads that team's plans and checks the owner once, as before", async () => {
			stored = stored.slice(1, 2);

			await remove({ plansIds: [], organizationTeamId: MANAGED_TEAM_ID });

			expect(readByTeam()).toBe(true);
			expect(managedEmployeeService.canManageEmployee).toHaveBeenCalledTimes(1);
			expect(managedEmployeeService.canManageEmployee).toHaveBeenCalledWith(
				MEMBER_ID,
				MANAGED_TEAM_ID,
				ORGANIZATION_ID
			);
			expect(savedPlans()).toEqual([{ id: PLAN_OF_MANAGED_TEAM, tasks: [] }]);
		});
	}
);

/**
 * The same removal against a real in-memory SQLite database under each ORM, so the plans a read returns are the
 * ones its conditions select. Beside the member's plans of today and later that hold the task sit a plan of a
 * managed team without the task, a past plan, a plan of another employee and one of another tenant. Without a
 * team, the TypeORM read used to compare the plan's team with NULL and find nothing.
 */
const FUTURE = new Date('2099-01-01T00:00:00.000Z');
const PAST = new Date('2000-01-01T00:00:00.000Z');
const OTHER_TENANT_ID = '3b6e6f3f-1d5f-4a3c-8b1c-4e7b5c3a2d22';
const OTHER_EMPLOYEE_ID = 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e';
const PLAN_WITHOUT_THE_TASK = '0a9b8c7d-6e5f-4a3b-9c2d-1e0f9a8b7c6d';
const PAST_PLAN = '1b0a9c8d-7e6f-4b5a-8d3c-2f1e0a9b8c7d';
const PLAN_OF_OTHER_EMPLOYEE = '2c1b0a9d-8f7e-4c6b-9e4d-3a2f1b0c9d8e';
const PLAN_OF_OTHER_TENANT = '3d2c1b0a-9e8f-4d7c-8f5e-4b3a2c1d0e9f';

interface ISeedPlan {
	id: string;
	date: Date;
	tenantId: string;
	organizationId: string;
	employeeId: string;
	organizationTeamId: string | null;
	tasks: string[];
}

const PLANS: ISeedPlan[] = [
	{ id: PLAN_WITHOUT_TEAM, organizationTeamId: null, tasks: [TASK_ID, OTHER_TASK_ID] },
	{ id: PLAN_OF_MANAGED_TEAM, organizationTeamId: MANAGED_TEAM_ID, tasks: [TASK_ID] },
	{ id: PLAN_OF_OTHER_TEAM, organizationTeamId: OTHER_TEAM_ID, tasks: [TASK_ID] },
	{ id: PLAN_WITHOUT_THE_TASK, organizationTeamId: MANAGED_TEAM_ID, tasks: [OTHER_TASK_ID] },
	{ id: PAST_PLAN, organizationTeamId: MANAGED_TEAM_ID, tasks: [TASK_ID], date: PAST },
	{
		id: PLAN_OF_OTHER_EMPLOYEE,
		organizationTeamId: MANAGED_TEAM_ID,
		tasks: [TASK_ID],
		employeeId: OTHER_EMPLOYEE_ID
	},
	{ id: PLAN_OF_OTHER_TENANT, organizationTeamId: MANAGED_TEAM_ID, tasks: [TASK_ID], tenantId: OTHER_TENANT_ID }
].map((plan) => ({
	date: FUTURE,
	employeeId: MEMBER_ID,
	tenantId: TENANT_ID,
	organizationId: ORGANIZATION_ID,
	...plan
}));

const TypeOrmUserSchema = new TypeOrmEntitySchema<any>({
	name: 'User',
	tableName: 'user',
	columns: { id: { primary: true, type: 'varchar' } }
});
const TypeOrmEmployeeSchema = new TypeOrmEntitySchema<any>({
	name: 'Employee',
	tableName: 'employee',
	columns: { id: { primary: true, type: 'varchar' }, userId: { type: 'varchar', nullable: true } },
	relations: { user: { type: 'many-to-one', target: 'User', joinColumn: { name: 'userId' } } }
});
const TypeOrmTaskSchema = new TypeOrmEntitySchema<any>({
	name: 'Task',
	tableName: 'task',
	columns: { id: { primary: true, type: 'varchar' } }
});
const TypeOrmDailyPlanSchema = new TypeOrmEntitySchema<any>({
	name: 'DailyPlan',
	tableName: 'daily_plan',
	columns: {
		id: { primary: true, type: 'varchar' },
		date: { type: 'datetime' },
		tenantId: { type: 'varchar', nullable: true },
		organizationId: { type: 'varchar', nullable: true },
		employeeId: { type: 'varchar', nullable: true },
		organizationTeamId: { type: 'varchar', nullable: true }
	},
	relations: {
		employee: { type: 'many-to-one', target: 'Employee', joinColumn: { name: 'employeeId' } },
		tasks: {
			type: 'many-to-many',
			target: 'Task',
			joinTable: {
				name: 'daily_plan_task',
				joinColumn: { name: 'dailyPlanId' },
				inverseJoinColumn: { name: 'taskId' }
			}
		}
	}
});

class SpecUser {
	id!: string;
}
class SpecEmployee {
	id!: string;
	user?: SpecUser;
}
class SpecTask {
	id!: string;
}
class SpecDailyPlan {
	id!: string;
	date!: Date;
	tenantId?: string;
	organizationId?: string;
	employee?: unknown;
	employeeId?: string;
	organizationTeamId?: string | null;
	tasks?: unknown;
}

const MikroOrmUserSchema = new MikroOrmEntitySchema<SpecUser>({
	class: SpecUser,
	tableName: 'user',
	properties: { id: { type: 'string', primary: true } }
});
const MikroOrmEmployeeSchema = new MikroOrmEntitySchema<SpecEmployee>({
	class: SpecEmployee,
	tableName: 'employee',
	properties: {
		id: { type: 'string', primary: true },
		user: { kind: 'm:1', entity: () => SpecUser, nullable: true, fieldName: 'userId' } as any
	}
});
const MikroOrmTaskSchema = new MikroOrmEntitySchema<SpecTask>({
	class: SpecTask,
	tableName: 'task',
	properties: { id: { type: 'string', primary: true } }
});
const MikroOrmDailyPlanSchema = new MikroOrmEntitySchema<SpecDailyPlan>({
	class: SpecDailyPlan,
	tableName: 'daily_plan',
	properties: {
		id: { type: 'string', primary: true },
		date: { type: 'datetime' },
		tenantId: { type: 'string', nullable: true },
		organizationId: { type: 'string', nullable: true },
		organizationTeamId: { type: 'string', nullable: true },
		// As on the platform: the relation owns the column and `employeeId` mirrors it, not persisted
		employee: { kind: 'm:1', entity: () => SpecEmployee, nullable: true, fieldName: 'employeeId' } as any,
		employeeId: { type: 'string', nullable: true, persist: false, fieldName: 'employeeId' } as any,
		tasks: {
			kind: 'm:n',
			entity: () => SpecTask,
			owner: true,
			pivotTable: 'daily_plan_task',
			joinColumn: 'dailyPlanId',
			inverseJoinColumn: 'taskId'
		} as any
	}
});

interface IPlanStore {
	/** The TypeORM and MikroORM repositories the service is built with. */
	repositories(): [unknown, unknown];
	close(): Promise<void>;
}

async function typeOrmStore(): Promise<IPlanStore> {
	const dataSource = new DataSource({
		type: 'better-sqlite3',
		database: ':memory:',
		entities: [TypeOrmUserSchema, TypeOrmEmployeeSchema, TypeOrmTaskSchema, TypeOrmDailyPlanSchema],
		synchronize: true,
		logging: false,
		invalidWhereValuesBehavior: TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR
	});
	await dataSource.initialize();
	await dataSource.getRepository('Task').save([{ id: TASK_ID }, { id: OTHER_TASK_ID }]);
	await dataSource.getRepository('Employee').save([{ id: MEMBER_ID }, { id: OTHER_EMPLOYEE_ID }]);
	await dataSource
		.getRepository('DailyPlan')
		.save(PLANS.map(({ tasks, ...plan }) => ({ ...plan, tasks: tasks.map((id) => ({ id })) })));

	return {
		repositories: () => [dataSource.getRepository('DailyPlan'), {}],
		close: () => dataSource.destroy()
	};
}

async function mikroOrmStore(): Promise<IPlanStore> {
	const orm = await MikroORM.init<BetterSqliteDriver>({
		driver: BetterSqliteDriver,
		dbName: ':memory:',
		entities: [MikroOrmUserSchema, MikroOrmEmployeeSchema, MikroOrmTaskSchema, MikroOrmDailyPlanSchema],
		namingStrategy: EntityCaseNamingStrategy,
		allowGlobalContext: true,
		discovery: { warnWhenNoEntities: false }
	});
	await orm.schema.createSchema();
	const em = orm.em.fork();
	[TASK_ID, OTHER_TASK_ID].forEach((id) => em.create(SpecTask, { id }));
	[MEMBER_ID, OTHER_EMPLOYEE_ID].forEach((id) => em.create(SpecEmployee, { id }));
	PLANS.forEach(({ employeeId, ...plan }) => em.create(SpecDailyPlan, { ...plan, employee: employeeId } as any));
	await em.flush();

	return {
		// A fresh fork per service, so a plan is answered because the store answered it
		repositories: () => [{ metadata: { tableName: 'daily_plan' } }, orm.em.fork().getRepository(SpecDailyPlan)],
		close: () => orm.close(true)
	};
}

describe.each([
	[MultiORMEnum.TypeORM, typeOrmStore],
	[MultiORMEnum.MikroORM, mikroOrmStore]
])('DailyPlanService.removeTaskFromManyPlans (%s) — on a real database', (ormType, createStore) => {
	let store: IPlanStore;
	let service: DailyPlanService;
	let saved: jest.SpyInstance;

	beforeAll(async () => {
		store = await createStore();
	});

	afterAll(async () => {
		await store?.close();
	});

	beforeEach(() => {
		const [typeOrmRepository, mikroOrmRepository] = store.repositories();
		service = new DailyPlanService(
			typeOrmRepository as any,
			mikroOrmRepository as any,
			{} as any,
			{ findOneByIdString: jest.fn(async () => ({ id: TASK_ID })) } as any,
			// The manager manages the member in MANAGED_TEAM_ID, and in "any team" for a plan without one
			{
				canManageEmployee: jest.fn(async (_employeeId: string, teamId?: string) => teamId !== OTHER_TEAM_ID)
			} as any
		);
		Object.defineProperty(service, 'ormType', { value: ormType });
		saved = jest
			.spyOn(TenantAwareCrudService.prototype, 'saveMany')
			.mockImplementation(async (entities) => entities as never);

		jest.spyOn(RequestContext, 'hasPermission').mockReturnValue(false);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT_ID);
		jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue(MANAGER_ID);
		jest.spyOn(RequestContext, 'currentUser').mockReturnValue({
			id: 'c0ffee00-0000-4000-8000-000000000001',
			tenantId: TENANT_ID,
			employeeId: MANAGER_ID
		} as any);
	});

	afterEach(() => jest.restoreAllMocks());

	const remove = (input: Record<string, unknown>) =>
		service.removeTaskFromManyPlans(TASK_ID, {
			employeeId: MEMBER_ID,
			organizationId: ORGANIZATION_ID,
			...input
		} as any);

	/** The plans that reached the save, with the tasks they keep, in id order. */
	const savedPlans = () =>
		(saved.mock.calls[0][0] as Array<{ id: string; tasks: Array<{ id: string }> }>)
			.map(({ id, tasks }) => ({ id, tasks: tasks.map((task) => task.id) }))
			.sort((a, b) => a.id.localeCompare(b.id));

	it('without a list or a team, saves only the plans holding the task that the caller may change', async () => {
		await remove({});

		expect(savedPlans()).toEqual([
			{ id: PLAN_WITHOUT_TEAM, tasks: [OTHER_TASK_ID] },
			{ id: PLAN_OF_MANAGED_TEAM, tasks: [] }
		]);
	});

	it('with a team, saves only the plans of that team holding the task', async () => {
		await remove({ plansIds: [], organizationTeamId: MANAGED_TEAM_ID });

		expect(savedPlans()).toEqual([{ id: PLAN_OF_MANAGED_TEAM, tasks: [] }]);
	});
});
