import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';
import { assignProjectKeys, takenProjectKeys, uniqueProjectKey } from '../../tasks/task-reference';

type Dialect = 'postgres' | 'sqlite' | 'mysql';

interface ProjectRow {
	id: string;
	tenantId: string | null;
	organizationId: string | null;
	name: string | null;
	taskKey: string | null;
	taskKeyHistory: string[] | string | null;
}

/**
 * Gives every project without a task key one: the first letters of its name (the key its tasks were already
 * addressed by, `Fulfilment` → `FUL`), made unique within its organization (`FUL2`, …) against every key held or held
 * before there, oldest project first. A project whose name has fewer than two letters or digits keeps none. Keys stay
 * editable by managers; a replaced key keeps resolving through the key history.
 *
 * Only rows without a key are written (`WHERE "taskKey" IS NULL`), so running it again changes nothing, and a lock
 * (advisory on Postgres, named on MySQL) makes two API processes that boot together run it one after the other.
 * `down` changes nothing: a backfilled key cannot be told from one a manager set.
 */
export class BackfillProjectTaskKeys1791000004950 implements MigrationInterface {
	name = 'BackfillProjectTaskKeys1791000004950';

	private readonly advisoryLockKey = 1791000004950;
	readonly mysqlLockName = `gauzy:migration:${this.advisoryLockKey}`;

	public async up(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' start running!'));
		if (!(await queryRunner.hasTable('organization_project')) || !(await queryRunner.hasColumn('organization_project', 'taskKey'))) {
			return;
		}
		const dialect = dialectOf(queryRunner);
		if (dialect === 'postgres' && queryRunner.isTransactionActive) {
			await queryRunner.query(`SELECT pg_advisory_xact_lock($1)`, [this.advisoryLockKey]);
		}
		if (dialect === 'mysql') {
			await withMysqlNamedLock(queryRunner, this.mysqlLockName, () => this.apply(queryRunner, dialect));
			return;
		}
		await this.apply(queryRunner, dialect);
	}

	private async apply(queryRunner: QueryRunner, dialect: Dialect): Promise<void> {
		const q = (identifier: string) => quoted(dialect, identifier);
		const rows = (await queryRunner.query(
			`SELECT ${['id', 'tenantId', 'organizationId', 'name', 'taskKey', 'taskKeyHistory'].map(q).join(', ')} FROM ${q('organization_project')} ` +
				`ORDER BY ${q('createdAt')} ASC, ${q('id')} ASC`
		)) as ProjectRow[];
		const byOrganization = new Map<string, ProjectRow[]>();
		for (const row of rows) {
			const scope = `${row.tenantId ?? ''}|${row.organizationId ?? ''}`;
			const group = byOrganization.get(scope);
			if (group) group.push(row);
			else byOrganization.set(scope, [row]);
		}
		let written = 0;
		for (const projects of byOrganization.values()) {
			const names = new Map(projects.map((project) => [project.id, project.name]));
			for (const [id, key] of assignProjectKeys(projects)) {
				if (await this.writeKey(queryRunner, dialect, projects[0], id, key, names.get(id) ?? null)) written += 1;
			}
		}
		console.log(chalk.green(`${this.name}: ${written} project key(s) given.`));
	}

	/**
	 * Writes one project's key. A project created meanwhile (the API may be running) can hold that key first: the
	 * organization's keys are read again and the next free one is written, a few times; the migration never stops
	 * on a key. Answers whether a key was written.
	 *
	 * On Postgres inside the migration's transaction, a refused statement aborts the whole transaction (every later
	 * statement fails with `25P02`), so each attempt runs under a savepoint and a refusal rolls back to it before the
	 * keys are read again. MySQL (InnoDB) and SQLite undo only the refused statement and need none.
	 */
	private async writeKey(queryRunner: QueryRunner, dialect: Dialect, scope: ProjectRow, id: string, first: string, name: string | null): Promise<boolean> {
		const q = (identifier: string) => quoted(dialect, identifier);
		const savepoint = dialect === 'postgres' && queryRunner.isTransactionActive ? BACKFILL_SAVEPOINT : null;
		let key: string | null = first;
		for (let attempt = 1; key && attempt <= 5; attempt += 1) {
			if (savepoint) await queryRunner.query(`SAVEPOINT ${savepoint}`);
			try {
				await queryRunner.query(
					`UPDATE ${q('organization_project')} SET ${q('taskKey')} = ${param(dialect, 1)} WHERE ${q('id')} = ${param(dialect, 2)} AND ${q('taskKey')} IS NULL`,
					[key, id]
				);
				if (savepoint) await queryRunner.query(`RELEASE SAVEPOINT ${savepoint}`);
				return true;
			} catch (error) {
				if (savepoint) await queryRunner.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
				if (!isUniqueViolation(error)) throw error;
				const current = (await queryRunner.query(
					`SELECT ${['name', 'taskKey', 'taskKeyHistory'].map(q).join(', ')} FROM ${q('organization_project')} WHERE ${q('tenantId')} ${scope.tenantId === null ? 'IS NULL' : `= ${param(dialect, 1)}`} AND ${q('organizationId')} ${scope.organizationId === null ? 'IS NULL' : `= ${param(dialect, scope.tenantId === null ? 1 : 2)}`}`,
					[scope.tenantId, scope.organizationId].filter((value) => value !== null)
				)) as ProjectRow[];
				const taken = takenProjectKeys(current);
				taken.add(key);
				key = uniqueProjectKey(name, taken);
			}
		}
		return false;
	}

	public async down(): Promise<void> {
		console.log(chalk.yellow(this.name + ': nothing to revert (a backfilled key cannot be told from one a manager set).'));
	}
}

function dialectOf(queryRunner: QueryRunner): Dialect {
	switch (queryRunner.connection.options.type as DatabaseTypeEnum) {
		case DatabaseTypeEnum.postgres:
			return 'postgres';
		case DatabaseTypeEnum.sqlite:
		case DatabaseTypeEnum.betterSqlite3:
			return 'sqlite';
		case DatabaseTypeEnum.mysql:
			return 'mysql';
		default:
			throw new Error(`Unsupported database: ${queryRunner.connection.options.type}`);
	}
}

/** The savepoint each Postgres key write runs under (see `writeKey`). */
const BACKFILL_SAVEPOINT = 'backfill_project_task_key';

/** A unique-index refusal on any of the three databases (another project took the key first). */
function isUniqueViolation(error: unknown): boolean {
	const candidate = error as { code?: unknown; errno?: unknown; driverError?: { code?: unknown; errno?: unknown } } | null;
	const codes = [candidate?.code, candidate?.errno, candidate?.driverError?.code, candidate?.driverError?.errno].map((code) => String(code ?? ''));
	return codes.includes('23505') || codes.includes('ER_DUP_ENTRY') || codes.includes('1062') || codes.some((code) => code.startsWith('SQLITE_CONSTRAINT'));
}

function quoted(dialect: Dialect, identifier: string): string {
	return dialect === 'mysql' ? `\`${identifier}\`` : `"${identifier}"`;
}

function param(dialect: Dialect, n: number): string {
	return dialect === 'postgres' ? `$${n}` : '?';
}

async function withMysqlNamedLock(queryRunner: QueryRunner, lockName: string, work: () => Promise<void>): Promise<void> {
	const [row] = (await queryRunner.query(`SELECT GET_LOCK(?, 30) AS acquired`, [lockName])) as Array<{ acquired: number | string | null }>;
	if (Number(row?.acquired) !== 1) {
		throw new Error(`Could not acquire the MySQL lock ${lockName} for the migration.`);
	}
	try {
		await work();
	} finally {
		await queryRunner.query(`SELECT RELEASE_LOCK(?)`, [lockName]);
	}
}
