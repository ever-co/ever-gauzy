import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DataSource } from 'typeorm';
import { DropInverseSideTaskJoinTables1791000004925 } from './migrations/1791000004925-DropInverseSideTaskJoinTables';

/**
 * `DropInverseSideTaskJoinTables1791000004925` on a real SQLite database: the two retired junction tables are
 * dropped, every row they held is in the owning table afterwards (a link already there is not duplicated), and a
 * second run finds nothing to do. The retired tables are given rows here on purpose: production's are empty, and
 * the migration must still lose nothing where they are not. The spec lives beside the other migration specs, outside
 * `migrations/`, which TypeORM loads whole at startup.
 */
describe('DropInverseSideTaskJoinTables1791000004925 (SQLite)', () => {
	const TIMEOUT = 60 * 1000;
	let file: string;
	let dataSource: DataSource;
	const tables = async () =>
		((await dataSource.query(`SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`)) as { name: string }[]).map((t) => t.name);
	const rows = async (table: string, columns: string[]) =>
		((await dataSource.query(`SELECT ${columns.map((c) => `"${c}"`).join(', ')} FROM "${table}" ORDER BY 1, 2`)) as Record<string, string>[]).map(
			(r) => columns.map((c) => r[c]).join('/')
		);

	beforeAll(async () => {
		file = path.join(os.tmpdir(), `gauzy-drop-inverse-join-${process.pid}-${Date.now()}.sqlite3`);
		dataSource = new DataSource({ type: 'better-sqlite3', database: file, entities: [], synchronize: false, logging: false });
		await dataSource.initialize();
		// The owning tables and the retired ones, as the original schema has them (no foreign keys: the referenced
		// rows are not what is under test)
		await dataSource.query(`CREATE TABLE "task_team" ("taskId" varchar NOT NULL, "organizationTeamId" varchar NOT NULL, PRIMARY KEY ("taskId", "organizationTeamId"))`);
		await dataSource.query(`CREATE TABLE "task_employee" ("taskId" varchar NOT NULL, "employeeId" varchar NOT NULL, PRIMARY KEY ("taskId", "employeeId"))`);
		await dataSource.query(`CREATE TABLE "organization_team_tasks_task" ("organizationTeamId" varchar NOT NULL, "taskId" varchar NOT NULL, PRIMARY KEY ("organizationTeamId", "taskId"))`);
		await dataSource.query(`CREATE TABLE "employee_tasks_task" ("employeeId" varchar NOT NULL, "taskId" varchar NOT NULL, PRIMARY KEY ("employeeId", "taskId"))`);
		// Owner: task-1 ↔ team-A already linked; retired side: the same link again plus task-2 ↔ team-B
		await dataSource.query(`INSERT INTO "task_team" VALUES ('task-1', 'team-A')`);
		await dataSource.query(`INSERT INTO "organization_team_tasks_task" VALUES ('team-A', 'task-1'), ('team-B', 'task-2')`);
		// Employees: the retired side holds the only link
		await dataSource.query(`INSERT INTO "employee_tasks_task" VALUES ('emp-1', 'task-3')`);
	}, TIMEOUT);

	afterAll(async () => {
		if (dataSource?.isInitialized) await dataSource.destroy();
		fs.rmSync(file, { force: true });
	});

	it('moves every row into the owning table, skips a link already there, and drops the retired tables', async () => {
		const migration = new DropInverseSideTaskJoinTables1791000004925();
		const runner = dataSource.createQueryRunner();
		try {
			await migration.up(runner);
		} finally {
			await runner.release();
		}
		expect(await tables()).toEqual(['task_employee', 'task_team']);
		expect(await rows('task_team', ['taskId', 'organizationTeamId'])).toEqual(['task-1/team-A', 'task-2/team-B']);
		expect(await rows('task_employee', ['taskId', 'employeeId'])).toEqual(['task-3/emp-1']);
	}, TIMEOUT);

	it('runs again without error when the tables are already gone', async () => {
		const migration = new DropInverseSideTaskJoinTables1791000004925();
		const runner = dataSource.createQueryRunner();
		try {
			await expect(migration.up(runner)).resolves.toBeUndefined();
		} finally {
			await runner.release();
		}
		expect(await tables()).toEqual(['task_employee', 'task_team']);
	}, TIMEOUT);

	it('down recreates the two tables empty, and up retires them again', async () => {
		const migration = new DropInverseSideTaskJoinTables1791000004925();
		const runner = dataSource.createQueryRunner();
		try {
			await migration.down(runner);
			expect(await tables()).toEqual(['employee_tasks_task', 'organization_team_tasks_task', 'task_employee', 'task_team']);
			expect(await rows('organization_team_tasks_task', ['organizationTeamId', 'taskId'])).toEqual([]);
			await migration.up(runner);
			expect(await tables()).toEqual(['task_employee', 'task_team']);
			// The owner rows are untouched by the round trip
			expect(await rows('task_team', ['taskId', 'organizationTeamId'])).toEqual(['task-1/team-A', 'task-2/team-B']);
		} finally {
			await runner.release();
		}
	}, TIMEOUT);
});
