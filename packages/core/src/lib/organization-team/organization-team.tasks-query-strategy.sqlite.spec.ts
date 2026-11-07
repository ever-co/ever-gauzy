import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * `OrganizationTeam.tasks` under `relationLoadStrategy: 'query'`, on Gauzy's real entities and a real SQLite database.
 *
 * `Task.teams` owns the relation (`@JoinTable({ name: 'task_team' })`) and `OrganizationTeam.tasks` ALSO carries a
 * bare `@JoinTable()`, so TypeORM treats both sides as owners (a second, empty junction table
 * `organization_team_tasks_task` exists in every database). The join strategy still answers the tasks through
 * `task_team`; the query strategy reads `task_team` with the id lists swapped (`"taskId" IN (<team ids>)`) and answers
 * every team an empty list. The public team link therefore loads the tasks from the task's side
 * (ever-co/ever-gauzy#11676). A two-entity schema with the JoinTable on one side loads the inverse side correctly.
 *
 * This spec states today's answer. Once the inverse-side `@JoinTable()` is removed (an owner decision: the stray
 * tables and their migration), the query strategy answers the same as the join strategy, and this expectation flips.
 */
const TIMEOUT = 10 * 60 * 1000;

const TENANT = '11111111-1111-4111-8111-111111111111';
const ORGANIZATION = '22222222-2222-4222-8222-222222222222';
const TEAMS = ['33333333-3333-4333-8333-333333333331', '33333333-3333-4333-8333-333333333332'];
const TASKS = ['66666666-6666-4666-8666-666666666661', '66666666-6666-4666-8666-666666666662', '66666666-6666-4666-8666-666666666663'];

type Measured = {
	queryStrategy: Record<string, string[]>;
	joinStrategy: Record<string, string[]>;
	taskSide: Record<string, string[]>;
	statements: string[];
	junctionColumns: string[];
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
			for (const [index, id] of TASKS.entries()) await insert('task', { ...scope, id, title: `Task ${index + 1}` });
			measured.junctionColumns = ((await dataSource.query(`PRAGMA table_info("task_team")`)) as any[]).map((c) => c.name);
			for (const [taskId, organizationTeamId] of [
				[TASKS[0], TEAMS[0]],
				[TASKS[1], TEAMS[0]],
				[TASKS[2], TEAMS[1]]
			]) {
				await insert('task_team', { taskId, organizationTeamId });
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

	it('join strategy and the owning side answer the tasks; the query strategy on the inverse side answers none, reading task_team with the id lists swapped', () => {
		const expected = { [TEAMS[0]]: [TASKS[0], TASKS[1]].sort(), [TEAMS[1]]: [TASKS[2]] };
		expect(measured.junctionColumns).toEqual(expect.arrayContaining(['taskId', 'organizationTeamId']));
		expect(measured.joinStrategy).toEqual(expected);
		expect(measured.taskSide).toEqual({ [TASKS[0]]: [TEAMS[0]], [TASKS[1]]: [TEAMS[0]], [TASKS[2]]: [TEAMS[1]] });

		const junctionRead = measured.statements.find((statement) => /FROM "task_team"/.test(statement));
		expect(junctionRead).toMatch(/"task_team"\."taskId" IN \(\?, \?\) AND "task_team"\."organizationTeamId" IN \(\?, \?, \?\)/);
		expect(junctionRead).toContain(JSON.stringify([TEAMS[0], TEAMS[1], TASKS[0], TASKS[1], TASKS[2]]));
		// Today's answer (see the header); flips to `expected` once the inverse side no longer declares a JoinTable
		expect(measured.queryStrategy).toEqual({ [TEAMS[0]]: [], [TEAMS[1]]: [] });
	});
});
