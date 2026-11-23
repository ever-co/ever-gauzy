import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { DataSource } from 'typeorm';
import { insertRow } from '../../database/testing/insert-row';

/**
 * The daily-plan lists answer each employee they load with its user with the `fullName` the platform builds from that
 * user (`EmployeeSubscriber`), as they did when the relations were joined onto the plan rows: Ever Teams lists the
 * people who planned a task under that name, and the `shape=lean` answer keeps it as the person's name.
 *
 * Since the lists load their relations with one query per relation (`relationLoadStrategy: 'query'`), TypeORM runs
 * the employee's load hook before it loads the employee's user, so the hook finds no user and sets no name.
 *
 * One SQLite database read through both ORMs, with the platform's employee and user load hooks registered. The
 * entities are imported under `DB_ORM=mikro-orm` in a registry kept open while both ORMs build their metadata and read
 * (see `time-log.service.reports.dual-orm.spec.ts`); everything is measured in `beforeAll` and asserted below.
 */

const TIMEOUT = 15 * 60 * 1000;

const TENANT = '11111111-1111-4111-8111-111111111111';
const ORGANIZATION = '22222222-2222-4222-8222-222222222222';
const TEAM = '33333333-3333-4333-8333-333333333333';
const ADA = { user: '44444444-4444-4444-8444-444444444441', employee: '55555555-5555-4555-8555-555555555551' };
const GRACE = { user: '44444444-4444-4444-8444-444444444442', employee: '55555555-5555-4555-8555-555555555552' };
const SHARED_TASK = '66666666-6666-4666-8666-666666666661';
const ADA_PLAN = '77777777-7777-4777-8777-777777777771';
const GRACE_PLAN = '77777777-7777-4777-8777-777777777772';

/** The relations Ever Teams asks for on a person's plans. */
const TEAMS_RELATIONS = ['employee', 'tasks', 'employee.user', 'tasks.members', 'tasks.members.user'];

/** A person as the answer holds them: an employee with their user. */
type PersonAnswer = { fullName?: string; user?: { name?: string } } | null | undefined;

/** A plan as the answer holds it. */
type PlanAnswer = { id: string; employee?: PersonAnswer; tasks?: Array<{ members?: PersonAnswer[] }> };

/** A person's names as an HTTP client receives them. */
type Names = { fullName?: string; userName?: string };

/** A plan as an HTTP client receives it: the names of its employee and of each task's assignees. */
type PlanNames = { id: string; employee: Names; members: Names[] };

type Reads = Record<
	'mine' | 'byEmployee' | 'all' | 'team' | 'byTask' | 'teamWithoutUser',
	PlanNames[] | { error: string }
>;

/** The list methods this suite reads. */
type PlanLists = Record<
	'getMyPlans' | 'getAllPlans' | 'getTeamDailyPlans',
	(options: unknown) => Promise<{ items: unknown[] }>
> &
	Record<
		'getDailyPlansByEmployee' | 'getDailyPlansByTask',
		(options: unknown, id: string) => Promise<{ items: unknown[] }>
	>;

const namesOf = (person: PersonAnswer): Names => ({ fullName: person?.fullName, userName: person?.user?.name });

const byUserName = (a: Names, b: Names) => String(a.userName).localeCompare(String(b.userName));

const planNames = (plan: PlanAnswer): PlanNames => ({
	id: plan.id,
	employee: namesOf(plan.employee),
	members: (plan.tasks ?? [])
		.flatMap((task) => task.members ?? [])
		.map(namesOf)
		.sort(byUserName)
});

async function measure(): Promise<{ mikroOrm: Reads; typeOrm: Reads }> {
	const previous = { DB_ORM: process.env.DB_ORM, DB_TYPE: process.env.DB_TYPE };
	process.env.DB_ORM = 'mikro-orm';
	// Whatever database the machine's environment names: both ORMs read the one SQLite file below
	process.env.DB_TYPE = 'better-sqlite3';
	const file = path.join(os.tmpdir(), `gauzy-daily-plan-full-name-${process.pid}-${Date.now()}.sqlite3`);
	const measurement = {} as { mikroOrm: Reads; typeOrm: Reads };
	let dataSource: DataSource | undefined;

	try {
		await jest.isolateModulesAsync(async () => {
			const { coreEntities } = require('../../core/entities');
			const { dbMikroOrmConnectionConfig } = require('@gauzy/config');
			const { DataSource: TypeOrmDataSource } = require('typeorm');
			const { MikroORM } = require('@mikro-orm/core');
			const { MultiORMEnum } = require('../../core/utils');
			const { CrudService } = require('../../core/crud/crud.service');
			const { RequestContext } = require('../../core/context');
			const { EmployeeSubscriber } = require('../../employee/employee.subscriber');
			const { UserSubscriber } = require('../../user/user.subscriber');
			const { DailyPlan } = require('./daily-plan.entity');
			const { DailyPlanService } = require('./daily-plan.service');
			const { MikroOrmDailyPlanRepository } = require('./repository/mikro-orm-daily-plan.repository');

			// The tables TypeORM creates, as the migrations create them for the running platform.
			const database: DataSource = new TypeOrmDataSource({
				type: 'better-sqlite3',
				database: file,
				entities: coreEntities,
				synchronize: true
			});
			dataSource = database;
			await database.initialize();

			// The custom-fields placeholder column the migrations add, which synchronize leaves out.
			await database.query(`ALTER TABLE "employee" ADD COLUMN "fix_relational_custom_fields" boolean`);

			const scope = { tenantId: TENANT, organizationId: ORGANIZATION };
			await insertRow(database, 'Tenant', { id: TENANT, name: 'Tenant' });
			await insertRow(database, 'Organization', { id: ORGANIZATION, tenantId: TENANT, name: 'Organization' });
			await insertRow(database, 'OrganizationTeam', { ...scope, id: TEAM, name: 'Platform' });
			const people: Array<[typeof ADA, string, string]> = [
				[ADA, 'Ada', 'Lovelace'],
				[GRACE, 'Grace', 'Hopper']
			];
			for (const [person, firstName, lastName] of people) {
				await insertRow(database, 'User', { id: person.user, tenantId: TENANT, firstName, lastName });
				await insertRow(database, 'Employee', { ...scope, id: person.employee, userId: person.user });
			}
			// One task assigned to both, in each person's plan for the same day.
			await insertRow(database, 'Task', { ...scope, id: SHARED_TASK, title: 'Plan the API deprecation notice' });
			for (const person of [ADA, GRACE]) {
				await database.query(`INSERT INTO "task_employee" ("taskId", "employeeId") VALUES (?, ?)`, [
					SHARED_TASK,
					person.employee
				]);
			}
			for (const [id, employeeId] of [
				[ADA_PLAN, ADA.employee],
				[GRACE_PLAN, GRACE.employee]
			]) {
				await insertRow(database, 'DailyPlan', {
					...scope,
					id,
					employeeId,
					organizationTeamId: TEAM,
					date: new Date('2026-01-10T00:00:00Z'),
					workTimePlanned: 1,
					status: 'open'
				});
				await database.query(`INSERT INTO "daily_plan_task" ("dailyPlanId", "taskId") VALUES (?, ?)`, [
					id,
					SHARED_TASK
				]);
			}

			// The load hooks the platform registers, added once the rows are written so that no write hook runs.
			database.subscribers.push(new EmployeeSubscriber(), new UserSubscriber());

			// Ada, who may read every employee's plans (the team check sees one).
			jest.spyOn(RequestContext, 'currentUser').mockReturnValue({
				id: ADA.user,
				tenantId: TENANT,
				employeeId: ADA.employee
			} as never);
			jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
			jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue(ADA.employee);
			jest.spyOn(RequestContext, 'hasPermission').mockReturnValue(true);

			const service = (mikroOrmRepository: unknown): PlanLists =>
				new DailyPlanService(
					database.getRepository(DailyPlan),
					mikroOrmRepository,
					{} as never,
					{} as never,
					{ isMemberOfTeam: async () => true, canManageEmployee: async () => true } as never
				);
			const where = { tenantId: TENANT, organizationId: ORGANIZATION, organizationTeamId: TEAM };

			const reads = async (target: () => PlanLists): Promise<Reads> => {
				const read = async (run: () => Promise<{ items: unknown[] }>) => {
					try {
						// What the HTTP layer sends: the answer as JSON.
						const answer: { items: PlanAnswer[] } = JSON.parse(JSON.stringify(await run()));
						return answer.items.map(planNames).sort((a, b) => a.id.localeCompare(b.id));
					} catch (error) {
						return { error: (error as Error).message };
					}
				};
				return {
					mine: await read(() => target().getMyPlans({ where, relations: TEAMS_RELATIONS })),
					byEmployee: await read(() =>
						target().getDailyPlansByEmployee({ where, relations: TEAMS_RELATIONS }, GRACE.employee)
					),
					all: await read(() => target().getAllPlans({ where, relations: TEAMS_RELATIONS })),
					team: await read(() => target().getTeamDailyPlans({ where, relations: TEAMS_RELATIONS })),
					byTask: await read(() => target().getDailyPlansByTask({ where }, SHARED_TASK)),
					teamWithoutUser: await read(() =>
						target().getTeamDailyPlans({ where, relations: ['employee', 'tasks', 'tasks.members'] })
					)
				};
			};

			const mikroOrm = await MikroORM.init({
				...dbMikroOrmConnectionConfig,
				dbName: file,
				entities: coreEntities,
				subscribers: [new EmployeeSubscriber(), new UserSubscriber()],
				allowGlobalContext: true,
				colors: false,
				discovery: { warnWhenNoEntities: false }
			});
			try {
				// A context of its own for every read, as every request gets.
				measurement.mikroOrm = await reads(() =>
					service(new MikroOrmDailyPlanRepository(mikroOrm.em.fork(), DailyPlan))
				);
			} finally {
				await mikroOrm.close(true);
			}

			// TypeORM, on the same tables and rows.
			jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);
			measurement.typeOrm = await reads(() => service(undefined));
		});
	} finally {
		jest.restoreAllMocks();
		// Here rather than after the reads, so a read that throws cannot leave the database file open
		if (dataSource?.isInitialized) await dataSource.destroy();
		for (const [name, value] of Object.entries(previous)) {
			if (value === undefined) delete process.env[name];
			else process.env[name] = value;
		}
		fs.rmSync(file, { force: true });
	}

	return measurement;
}

describe('DailyPlanService lists, the employees’ full names, on one database through both ORMs', () => {
	let measured: { mikroOrm: Reads; typeOrm: Reads };

	beforeAll(async () => {
		measured = await measure();
	}, TIMEOUT);

	const ada = { fullName: 'Ada Lovelace', userName: 'Ada Lovelace' };
	const grace = { fullName: 'Grace Hopper', userName: 'Grace Hopper' };
	const bothAssignees = [ada, grace];

	describe.each(['typeOrm', 'mikroOrm'] as const)('%s', (orm) => {
		it('answers my plans with my full name and each assignee’s', () => {
			expect(measured[orm].mine).toEqual([{ id: ADA_PLAN, employee: ada, members: bothAssignees }]);
		});

		it('answers another employee’s plans with that employee’s full name', () => {
			expect(measured[orm].byEmployee).toEqual([{ id: GRACE_PLAN, employee: grace, members: bothAssignees }]);
		});

		it('answers the plan list with each plan’s employee by full name', () => {
			expect(measured[orm].all).toEqual([
				{ id: ADA_PLAN, employee: ada, members: bothAssignees },
				{ id: GRACE_PLAN, employee: grace, members: bothAssignees }
			]);
		});

		it('answers the team’s plans with each plan’s employee by full name', () => {
			expect(measured[orm].team).toEqual([
				{ id: ADA_PLAN, employee: ada, members: bothAssignees },
				{ id: GRACE_PLAN, employee: grace, members: bothAssignees }
			]);
		});

		it('answers the plans that hold a task with the full name of each person who planned it', () => {
			expect(measured[orm].byTask).toEqual([
				{ id: ADA_PLAN, employee: ada, members: [] },
				{ id: GRACE_PLAN, employee: grace, members: [] }
			]);
		});

		it('gives no full name to an employee read without its user', () => {
			const nameless = { fullName: undefined, userName: undefined };
			expect(measured[orm].teamWithoutUser).toEqual([
				{ id: ADA_PLAN, employee: nameless, members: [nameless, nameless] },
				{ id: GRACE_PLAN, employee: nameless, members: [nameless, nameless] }
			]);
		});
	});
});
