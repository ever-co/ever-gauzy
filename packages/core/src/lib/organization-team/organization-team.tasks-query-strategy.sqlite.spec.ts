import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * `OrganizationTeam.tasks` and `Employee.tasks` under `relationLoadStrategy: 'query'`, on Gauzy's real entities and a
 * real SQLite database.
 *
 * `Task.teams` owns the relation (`@JoinTable({ name: 'task_team' })`); `OrganizationTeam.tasks` is its inverse side.
 * Until 2026-11-07 the inverse side carried a bare `@JoinTable()` too, so TypeORM treated both sides as owners (a
 * second, always empty junction table `organization_team_tasks_task` existed in every database) and the query
 * strategy read `task_team` with the id lists swapped, answering every team an empty list (ever-co/ever-gauzy#11676
 * loaded the public team's tasks from the task's side because of it). With the decorator gone
 * (`DropInverseSideTaskJoinTables1791000004925` retires the stray table), the query strategy answers the same as the
 * join strategy and reads `task_team` by the team ids. `Employee.tasks` (inverse of `Task.members`, junction
 * `task_employee`) had the same decorator and the same answer; it is checked the same way.
 */
const TIMEOUT = 10 * 60 * 1000;

const TENANT = '11111111-1111-4111-8111-111111111111';
const ORGANIZATION = '22222222-2222-4222-8222-222222222222';
const TEAMS = ['33333333-3333-4333-8333-333333333331', '33333333-3333-4333-8333-333333333332'];
const EMPLOYEES = ['44444444-4444-4444-8444-444444444441', '44444444-4444-4444-8444-444444444442'];
const TASKS = ['66666666-6666-4666-8666-666666666661', '66666666-6666-4666-8666-666666666662', '66666666-6666-4666-8666-666666666663'];

type Measured = {
	queryStrategy: Record<string, string[]>;
	joinStrategy: Record<string, string[]>;
	taskSide: Record<string, string[]>;
	employeeQueryStrategy: Record<string, string[]>;
	employeeJoinStrategy: Record<string, string[]>;
	memberSide: Record<string, string[]>;
	employeeStatements: string[];
	statements: string[];
	junctionColumns: string[];
	tables: string[];
};

async function measure(): Promise<Measured> {
	const previous = { DB_ORM: process.env.DB_ORM, DB_TYPE: process.env.DB_TYPE };
	process.env.DB_ORM = 'typeorm';
	process.env.DB_TYPE = 'better-sqlite3';
	const file = path.join(os.tmpdir(), `gauzy-team-tasks-strategy-${process.pid}-${Date.now()}.sqlite3`);
	const measured = {} as Measured;
	let dataSource: any;

	try {
		await jest.isolateModulesAsync(async () => {
			const { coreEntities } = require('../core/entities');
			const { DataSource } = require('typeorm');
			const { OrganizationTeam } = require('./organization-team.entity');
			const { Employee } = require('../employee/employee.entity');
			const { Task } = require('../tasks/task.entity');

			const statements: string[] = [];
			dataSource = new DataSource({
				type: 'better-sqlite3',
				database: file,
				entities: coreEntities,
				synchronize: true,
				logging: true,
				logger: {
					logQuery: (query: string, parameters?: unknown[]) => statements.push(`${query} -- ${JSON.stringify(parameters ?? [])}`),
					logQueryError: () => undefined,
					logQuerySlow: () => undefined,
					logSchemaBuild: () => undefined,
					logMigration: () => undefined,
					log: () => undefined
				}
			});
			await dataSource.initialize();

			const insert = async (table: string, row: Record<string, unknown>) => {
				const columns: any[] = await dataSource.query(`PRAGMA table_info("${table}")`);
				const values: Record<string, unknown> = { ...row };
				for (const column of columns) {
					if (column.name in values || !column.notnull || column.dflt_value !== null || column.pk) continue;
					const type = String(column.type).toLowerCase();
					values[column.name] = /int|bool|numeric|decimal|real|float/.test(type) ? 0 : /date|time/.test(type) ? '2026-01-01 00:00:00' : 'x';
				}
				const keys = Object.keys(values);
				await dataSource.query(
					`INSERT INTO "${table}" (${keys.map((key) => `"${key}"`).join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`,
					keys.map((key) => values[key])
				);
			};
			const scope = { tenantId: TENANT, organizationId: ORGANIZATION };
			await dataSource.query('PRAGMA foreign_keys = OFF');
			await insert('tenant', { id: TENANT, name: 'Tenant' });
			await insert('organization', { id: ORGANIZATION, tenantId: TENANT, name: 'Organization' });
			for (const [index, id] of TEAMS.entries()) await insert('organization_team', { ...scope, id, name: `Team ${index + 1}` });
			for (const id of EMPLOYEES) await insert('employee', { ...scope, id });
			for (const [index, id] of TASKS.entries()) await insert('task', { ...scope, id, title: `Task ${index + 1}` });
			measured.junctionColumns = ((await dataSource.query(`PRAGMA table_info("task_team")`)) as any[]).map((c) => c.name);
			measured.tables = ((await dataSource.query(`SELECT name FROM sqlite_master WHERE type = 'table'`)) as any[]).map((t) => t.name);
			for (const [taskId, organizationTeamId] of [
				[TASKS[0], TEAMS[0]],
				[TASKS[1], TEAMS[0]],
				[TASKS[2], TEAMS[1]]
			]) {
				await insert('task_team', { taskId, organizationTeamId });
			}
			// The first employee works on two tasks, the second on one (the task the first team does not have)
			for (const [taskId, employeeId] of [
				[TASKS[0], EMPLOYEES[0]],
				[TASKS[2], EMPLOYEES[0]],
				[TASKS[2], EMPLOYEES[1]]
			]) {
				await insert('task_employee', { taskId, employeeId });
			}

			const tasksOf = (teams: any[]) => Object.fromEntries(teams.map((team) => [team.id, (team.tasks ?? []).map((t: any) => t.id).sort()]));
			const teamsOf = (tasks: any[]) => Object.fromEntries(tasks.map((task) => [task.id, (task.teams ?? []).map((t: any) => t.id).sort()]));
			const teamRepository = dataSource.getRepository(OrganizationTeam);
			const where = { tenantId: TENANT, organizationId: ORGANIZATION };
			statements.length = 0;
			measured.queryStrategy = tasksOf(await teamRepository.find({ where, relations: { tasks: true }, relationLoadStrategy: 'query', order: { id: 'ASC' } }));
			measured.statements = [...statements];
			measured.joinStrategy = tasksOf(await teamRepository.find({ where, relations: { tasks: true }, relationLoadStrategy: 'join', order: { id: 'ASC' } }));
			measured.taskSide = teamsOf(await dataSource.getRepository(Task).find({ where, relations: { teams: true }, relationLoadStrategy: 'query', order: { id: 'ASC' } }));

			const membersOf = (tasks: any[]) => Object.fromEntries(tasks.map((task) => [task.id, (task.members ?? []).map((m: any) => m.id).sort()]));
			const employeeRepository = dataSource.getRepository(Employee);
			statements.length = 0;
			measured.employeeQueryStrategy = tasksOf(await employeeRepository.find({ where, relations: { tasks: true }, relationLoadStrategy: 'query', order: { id: 'ASC' } }));
			measured.employeeStatements = [...statements];
			measured.employeeJoinStrategy = tasksOf(await employeeRepository.find({ where, relations: { tasks: true }, relationLoadStrategy: 'join', order: { id: 'ASC' } }));
			measured.memberSide = membersOf(await dataSource.getRepository(Task).find({ where, relations: { members: true }, relationLoadStrategy: 'query', order: { id: 'ASC' } }));
		});
	} finally {
		if (dataSource?.isInitialized) await dataSource.destroy();
		fs.rmSync(file, { force: true });
		for (const [key, value] of Object.entries(previous)) {
			if (value === undefined) delete process.env[key];
			else process.env[key] = value;
		}
	}
	return measured;
}

describe('OrganizationTeam.tasks under relationLoadStrategy query (real entities, SQLite)', () => {
	let measured: Measured;
	beforeAll(async () => {
		measured = await measure();
	}, TIMEOUT);

	it('the query strategy on the inverse side answers the same tasks as the join strategy, reading task_team by the team ids', () => {
		const expected = { [TEAMS[0]]: [TASKS[0], TASKS[1]].sort(), [TEAMS[1]]: [TASKS[2]] };
		expect(measured.junctionColumns).toEqual(expect.arrayContaining(['taskId', 'organizationTeamId']));
		expect(measured.joinStrategy).toEqual(expected);
		expect(measured.taskSide).toEqual({ [TASKS[0]]: [TEAMS[0]], [TASKS[1]]: [TEAMS[0]], [TASKS[2]]: [TEAMS[1]] });
		const junctionRead = measured.statements.find((statement) => /FROM "task_team"/.test(statement));
		expect(junctionRead).toBeDefined();
		// The junction is read by the team ids (the inverse side's own column), not with the lists swapped
		expect(junctionRead).toMatch(/"task_team"\."organizationTeamId" IN \(\?, \?\)/);
		const parameters: string[] = JSON.parse(String(junctionRead).slice(String(junctionRead).lastIndexOf(' -- ') + 4));
		// The team ids fill the team-id list (TypeORM also narrows by the task ids it found, which is fine)
		expect(TEAMS.every((id) => parameters.includes(id))).toBe(true);
		// No stray junction table is created for the inverse side any more
		expect(measured.tables).not.toContain('organization_team_tasks_task');
		expect(measured.tables).not.toContain('employee_tasks_task');
		expect(measured.queryStrategy).toEqual(expected);
	});

	it('Employee.tasks under the query strategy answers exactly the tasks assigned through Task.members, read from task_employee by the employee ids', () => {
		const expected = { [EMPLOYEES[0]]: [TASKS[0], TASKS[2]].sort(), [EMPLOYEES[1]]: [TASKS[2]] };
		expect(measured.employeeJoinStrategy).toEqual(expected);
		expect(measured.memberSide).toEqual({ [TASKS[0]]: [EMPLOYEES[0]], [TASKS[1]]: [], [TASKS[2]]: EMPLOYEES.slice().sort() });
		const junctionRead = measured.employeeStatements.find((statement) => /FROM "task_employee"/.test(statement));
		expect(junctionRead).toBeDefined();
		expect(junctionRead).toMatch(/"task_employee"\."employeeId" IN \(\?, \?\)/);
		const parameters: string[] = JSON.parse(String(junctionRead).slice(String(junctionRead).lastIndexOf(' -- ') + 4));
		expect(EMPLOYEES.every((id) => parameters.includes(id))).toBe(true);
		expect(measured.employeeQueryStrategy).toEqual(expected);
	});
});
