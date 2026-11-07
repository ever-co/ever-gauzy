import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * The daily-plan lists on one SQLite database with the tables TypeORM creates: the relations the Teams app asks
 * for (`employee.user`, `tasks.members.user`) come back filled in, with every plan once, and no statement joins
 * the task assignees onto the plan rows (what multiplied each plan by its tasks and each task by its members).
 *
 * The entities are imported in an isolated registry under `DB_ORM=typeorm` (the ORM switch is read at import),
 * everything is measured in `beforeAll` and asserted below — the pattern of `time-log.service.reports.dual-orm.spec.ts`.
 */

const TIMEOUT = 10 * 60 * 1000;

const TENANT = '11111111-1111-4111-8111-111111111111';
const ORGANIZATION = '22222222-2222-4222-8222-222222222222';
const TEAM = '33333333-3333-4333-8333-333333333333';
const USERS = ['44444444-4444-4444-8444-444444444441', '44444444-4444-4444-8444-444444444442', '44444444-4444-4444-8444-444444444443'];
const EMPLOYEES = ['55555555-5555-4555-8555-555555555551', '55555555-5555-4555-8555-555555555552', '55555555-5555-4555-8555-555555555553'];
const TASKS = ['66666666-6666-4666-8666-666666666661', '66666666-6666-4666-8666-666666666662', '66666666-6666-4666-8666-666666666663'];
const PLANS = ['77777777-7777-4777-8777-777777777771', '77777777-7777-4777-8777-777777777772', '77777777-7777-4777-8777-777777777773'];

const TEAMS_RELATIONS = ['employee', 'tasks', 'employee.user', 'tasks.members', 'tasks.members.user'];

/** A plan as the assertions read it: who owns it and which tasks it holds, with each task's assignees. */
type PlanSummary = {
	id: string;
	employee: string | undefined;
	owner: string | undefined;
	tasks: Array<{ id: string; members: string[] }>;
};

type Measured = {
	mine: { items: PlanSummary[]; total: number; statements: string[] };
	minePage: { items: PlanSummary[]; total: number };
	mineHoldingTask: { items: PlanSummary[]; total: number; statements: string[] };
	mineHoldingTaskPage: { items: PlanSummary[]; total: number };
	team: { items: PlanSummary[]; total: number; statements: string[] };
	teamPlain: { items: PlanSummary[]; total: number };
	teamPage: { items: PlanSummary[]; total: number };
	byTask: { items: PlanSummary[]; total: number; statements: string[] };
	byTaskPage: { items: PlanSummary[]; total: number };
};

const summarize = (plan: any): PlanSummary => ({
	id: plan.id,
	employee: plan.employee?.id,
	owner: plan.employee?.user?.firstName,
	tasks: (plan.tasks ?? [])
		.map((task: any) => ({
			id: task.id,
			members: (task.members ?? []).map((member: any) => member.user?.firstName ?? member.id).sort()
		}))
		.sort((a: PlanSummary['tasks'][number], b: PlanSummary['tasks'][number]) => a.id.localeCompare(b.id))
});

async function measure(): Promise<Measured> {
	const previous = { DB_ORM: process.env.DB_ORM, DB_TYPE: process.env.DB_TYPE };
	process.env.DB_ORM = 'typeorm';
	process.env.DB_TYPE = 'better-sqlite3';
	const file = path.join(os.tmpdir(), `gauzy-daily-plan-relations-${process.pid}-${Date.now()}.sqlite3`);
	const measured = {} as Measured;
	let dataSource: any;

	try {
		await jest.isolateModulesAsync(async () => {
			const { coreEntities } = require('../../core/entities');
			const { DataSource } = require('typeorm');
			const { MultiORMEnum } = require('../../core/utils');
			const { CrudService } = require('../../core/crud/crud.service');
			const { RequestContext } = require('../../core/context');
			const { DailyPlan } = require('./daily-plan.entity');
			const { DailyPlanService } = require('./daily-plan.service');

			const statements: string[] = [];
			dataSource = new DataSource({
				type: 'better-sqlite3',
				database: file,
				entities: coreEntities,
				synchronize: true,
				logging: true,
				logger: {
					logQuery: (query: string) => statements.push(query),
					logQueryError: () => undefined,
					logQuerySlow: () => undefined,
					logSchemaBuild: () => undefined,
					logMigration: () => undefined,
					log: () => undefined
				}
			});
			await dataSource.initialize();

			// The custom-fields placeholder column the migrations add, which synchronize leaves out.
			for (const table of ['employee']) {
				const columns: any[] = await dataSource.query(`PRAGMA table_info("${table}")`);
				if (!columns.some((column) => column.name === 'fix_relational_custom_fields')) {
					await dataSource.query(`ALTER TABLE "${table}" ADD COLUMN "fix_relational_custom_fields" boolean`);
				}
			}

			// A row with the columns given, and a placeholder in every other NOT NULL column without a default.
			const insert = async (table: string, row: Record<string, unknown>) => {
				const columns: any[] = await dataSource.query(`PRAGMA table_info("${table}")`);
				const values: Record<string, unknown> = { ...row };
				for (const column of columns) {
					if (column.name in values || !column.notnull || column.dflt_value !== null || column.pk) continue;
					const type = String(column.type).toLowerCase();
					values[column.name] = /int|bool|numeric|decimal|real|float/.test(type)
						? 0
						: /date|time/.test(type)
							? '2026-01-01 00:00:00'
							: 'x';
				}
				const keys = Object.keys(values);
				await dataSource.query(
					`INSERT INTO "${table}" (${keys.map((key) => `"${key}"`).join(', ')}) VALUES (${keys
						.map(() => '?')
						.join(', ')})`,
					keys.map((key) => values[key])
				);
			};

			const scope = { tenantId: TENANT, organizationId: ORGANIZATION };
			await dataSource.query('PRAGMA foreign_keys = OFF');
			await insert('tenant', { id: TENANT, name: 'Tenant' });
			await insert('organization', { id: ORGANIZATION, tenantId: TENANT, name: 'Organization' });
			await insert('organization_team', { ...scope, id: TEAM, name: 'Team' });
			for (const [index, name] of ['Ada', 'Grace', 'Linus'].entries()) {
				await insert('user', { id: USERS[index], tenantId: TENANT, firstName: name, lastName: 'L' });
				await insert('employee', { ...scope, id: EMPLOYEES[index], userId: USERS[index] });
			}
			// T1 assigned to Ada and Grace, T2 to Grace and Linus, T3 to nobody.
			for (const [index, id] of TASKS.entries()) {
				await insert('task', { ...scope, id, title: `Task ${index + 1}` });
			}
			for (const [taskId, employeeId] of [
				[TASKS[0], EMPLOYEES[0]],
				[TASKS[0], EMPLOYEES[1]],
				[TASKS[1], EMPLOYEES[1]],
				[TASKS[1], EMPLOYEES[2]]
			]) {
				await insert('task_employee', { taskId, employeeId });
			}
			// Ada's plans: P1 (T1, T2) and P2 (T2, T3); Grace's plan P3 (T3). All in the team.
			const plans: Array<[string, string, string, string[]]> = [
				[PLANS[0], EMPLOYEES[0], '2026-01-10', [TASKS[0], TASKS[1]]],
				[PLANS[1], EMPLOYEES[0], '2026-01-11', [TASKS[1], TASKS[2]]],
				[PLANS[2], EMPLOYEES[1], '2026-01-10', [TASKS[2]]]
			];
			for (const [id, employeeId, date, taskIds] of plans) {
				await insert('daily_plan', {
					...scope,
					id,
					employeeId,
					organizationTeamId: TEAM,
					date,
					workTimePlanned: 8,
					status: 'open'
				});
				for (const taskId of taskIds) {
					await insert('daily_plan_task', { dailyPlanId: id, taskId });
				}
			}

			// Ada, who may read every employee's plans (the team check sees one).
			jest.spyOn(RequestContext, 'currentUser').mockReturnValue({
				id: USERS[0],
				tenantId: TENANT,
				employeeId: EMPLOYEES[0]
			} as any);
			jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
			jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue(EMPLOYEES[0]);
			jest.spyOn(RequestContext, 'hasPermission').mockReturnValue(true);
			jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);

			const service = new DailyPlanService(
				dataSource.getRepository(DailyPlan),
				{} as any,
				{} as any,
				{} as any,
				{ isMemberOfTeam: async () => true, canManageEmployee: async () => true } as any
			);
			const where = { tenantId: TENANT, organizationId: ORGANIZATION, organizationTeamId: TEAM };

			const read = async (run: () => Promise<{ items: any[]; total: number }>) => {
				statements.length = 0;
				const { items, total } = await run();
				return { items: items.map(summarize), total, statements: [...statements] };
			};

			measured.mine = await read(() => service.getMyPlans({ where, relations: TEAMS_RELATIONS } as any));
			measured.minePage = await read(() =>
				service.getMyPlans({ where, relations: TEAMS_RELATIONS, take: 1, skip: 2 } as any)
			);
			// A condition on a relation (the plans holding T2) with the relations requested: TypeORM joins the
			// task for the condition, the relations still load by their own queries.
			const holdingTask = { ...where, tasks: { id: TASKS[1] } };
			measured.mineHoldingTask = await read(() =>
				service.getMyPlans({ where: holdingTask, relations: TEAMS_RELATIONS } as any)
			);
			measured.mineHoldingTaskPage = await read(() =>
				service.getMyPlans({ where: holdingTask, relations: TEAMS_RELATIONS, take: 1, skip: 1 } as any)
			);
			measured.team = await read(() => service.getTeamDailyPlans({ where, relations: ['tasks'] } as any));
			measured.teamPlain = await read(() => service.getTeamDailyPlans({ where } as any));
			measured.teamPage = await read(() =>
				service.getTeamDailyPlans({ where, relations: TEAMS_RELATIONS, take: 2, skip: 2 } as any)
			);
			measured.byTask = await read(() => service.getDailyPlansByTask({ where } as any, TASKS[1]));
			measured.byTaskPage = await read(() =>
				service.getDailyPlansByTask({ where, take: 1, skip: 2 } as any, TASKS[1])
			);
		});
	} finally {
		jest.restoreAllMocks();
		if (dataSource?.isInitialized) await dataSource.destroy();
		fs.rmSync(file, { force: true });
		process.env.DB_ORM = previous.DB_ORM;
		process.env.DB_TYPE = previous.DB_TYPE;
	}
	return measured;
}

describe('DailyPlanService lists on SQLite — relations loaded per query', () => {
	let measured: Measured;

	beforeAll(async () => {
		measured = await measure();
	}, TIMEOUT);

	/** A statement that joins the task assignees (or the tasks) onto the plan rows. */
	const joinsTasksOntoPlans = (statements: string[]) =>
		statements.filter((sql) => /FROM "daily_plan"/.test(sql) && /JOIN "(task_employee|daily_plan_task)"/.test(sql));

	it('answers my plans once each, with the employee, their user, the tasks and each task’s assignees', () => {
		expect(measured.mine.total).toBe(2);
		expect(measured.mine.items.sort((a, b) => a.id.localeCompare(b.id))).toEqual([
			{
				id: PLANS[0],
				employee: EMPLOYEES[0],
				owner: 'Ada',
				tasks: [
					{ id: TASKS[0], members: ['Ada', 'Grace'] },
					{ id: TASKS[1], members: ['Grace', 'Linus'] }
				]
			},
			{
				id: PLANS[1],
				employee: EMPLOYEES[0],
				owner: 'Ada',
				tasks: [
					{ id: TASKS[1], members: ['Grace', 'Linus'] },
					{ id: TASKS[2], members: [] }
				]
			}
		]);
	});

	it('joins no task or assignee onto the plan rows', () => {
		expect(joinsTasksOntoPlans(measured.mine.statements)).toEqual([]);
		expect(joinsTasksOntoPlans(measured.team.statements)).toEqual([]);
		expect(joinsTasksOntoPlans(measured.byTask.statements)).toEqual([]);
	});

	it('pages my plans with the relations filled in and the total of every plan', () => {
		expect(measured.minePage.total).toBe(2);
		expect(measured.minePage.items).toEqual([
			{
				id: PLANS[1],
				employee: EMPLOYEES[0],
				owner: 'Ada',
				tasks: [
					{ id: TASKS[1], members: ['Grace', 'Linus'] },
					{ id: TASKS[2], members: [] }
				]
			}
		]);
	});

	it('answers the team’s plans with their employee and tasks (the user is not asked for), asked for a relation or not', () => {
		for (const list of [measured.team, measured.teamPlain]) {
			expect(list.total).toBe(3);
			expect(
				list.items.map(({ id, employee, tasks }) => [id, employee, tasks.map((task) => task.id)]).sort()
			).toEqual([
				[PLANS[0], EMPLOYEES[0], [TASKS[0], TASKS[1]]],
				[PLANS[1], EMPLOYEES[0], [TASKS[1], TASKS[2]]],
				[PLANS[2], EMPLOYEES[1], [TASKS[2]]]
			]);
		}
	});

	it('answers the plans that hold a task, with their employee, user and tasks', () => {
		expect(measured.byTask.total).toBe(2);
		expect(measured.byTask.items.map(({ id, owner, tasks }) => [id, owner, tasks.map((task) => task.id)]).sort()).toEqual([
			[PLANS[0], 'Ada', [TASKS[0], TASKS[1]]],
			[PLANS[1], 'Ada', [TASKS[1], TASKS[2]]]
		]);
	});

	it('filters my plans on a task they hold, once each, with the relations filled in — and pages them', () => {
		expect(measured.mineHoldingTask.total).toBe(2);
		expect(measured.mineHoldingTask.items.map(({ id, tasks }) => [id, tasks.map((task) => task.id)]).sort()).toEqual(
			[
				[PLANS[0], [TASKS[0], TASKS[1]]],
				[PLANS[1], [TASKS[1], TASKS[2]]]
			]
		);
		expect(measured.mineHoldingTask.items.every(({ owner }) => owner === 'Ada')).toBe(true);
		// The condition on `tasks` gets its one join from TypeORM; the assignees are never joined onto the plans.
		expect(
			measured.mineHoldingTask.statements.filter((sql) => /FROM "daily_plan"/.test(sql) && /JOIN "task_employee"/.test(sql))
		).toEqual([]);

		expect(measured.mineHoldingTaskPage.total).toBe(2);
		expect(measured.mineHoldingTaskPage.items.map(({ id, owner, tasks }) => [id, owner, tasks.length])).toEqual([
			[PLANS[0], 'Ada', 2]
		]);
	});

	it('pages the team’s plans and the plans of a task with the relations filled in and the full totals', () => {
		expect(measured.teamPage.total).toBe(3);
		expect(measured.teamPage.items.map(({ id, owner, tasks }) => [id, owner, tasks.map((task) => task.id)])).toEqual([
			[PLANS[1], 'Ada', [TASKS[1], TASKS[2]]]
		]);

		expect(measured.byTaskPage.total).toBe(2);
		expect(measured.byTaskPage.items.map(({ id, owner, tasks }) => [id, owner, tasks.map((task) => task.id)])).toEqual([
			[PLANS[1], 'Ada', [TASKS[1], TASKS[2]]]
		]);
	});
});
