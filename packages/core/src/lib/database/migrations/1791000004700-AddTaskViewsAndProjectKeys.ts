import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/** The databases this migration runs on. Both SQLite drivers share one entry. */
type Dialect = 'postgres' | 'sqlite' | 'mysql';

/** A column this migration adds, with its definition on each database. */
interface ColumnSpec extends Record<Dialect, string> {
	table: string;
	name: string;
}

const JSON_TYPE: Record<Dialect, string> = { postgres: 'jsonb', sqlite: 'text', mysql: 'json' };

/** The columns, in the order they are added. */
const COLUMNS: readonly ColumnSpec[] = [
	// Saved task views: who sees them, their save version, their manual order.
	{ table: 'task_view', name: 'visibility', postgres: `character varying(16)`, sqlite: `varchar(16)`, mysql: `varchar(16) NULL` },
	{ table: 'task_view', name: 'version', postgres: `integer NOT NULL DEFAULT 1`, sqlite: `integer NOT NULL DEFAULT (1)`, mysql: `int NOT NULL DEFAULT 1` },
	{ table: 'task_view', name: 'manualOrder', postgres: JSON_TYPE.postgres, sqlite: JSON_TYPE.sqlite, mysql: `${JSON_TYPE.mysql} NULL` },
	// Projects: the key tasks are addressed by, and the former keys.
	{ table: 'organization_project', name: 'taskKey', postgres: `character varying(16)`, sqlite: `varchar(16)`, mysql: `varchar(16) NULL` },
	{ table: 'organization_project', name: 'taskKeyHistory', postgres: JSON_TYPE.postgres, sqlite: JSON_TYPE.sqlite, mysql: `${JSON_TYPE.mysql} NULL` }
];

/**
 * The unique index that keeps a project key unique within an organization (and quick to resolve). Rows without a key
 * are no concern: every one of the three databases treats NULLs as distinct in a unique index. The entity declares the
 * same index, so `migration:generate` sees nothing to add.
 */
const KEY_INDEX = {
	name: 'UQ_organization_project_organization_task_key',
	table: 'organization_project',
	columns: ['tenantId', 'organizationId', 'taskKey']
};

/**
 * Adds the columns of the task views extensions: `task_view.visibility` (`personal` / `shared`, null = shared),
 * `task_view.version` (bumped by every save, default 1), `task_view.manualOrder` (the task ids in manual order),
 * `organization_project.taskKey` (the key tasks are addressed by) and `organization_project.taskKeyHistory`
 * (former keys), plus a unique index on `(tenantId, organizationId, taskKey)`.
 *
 * Nothing is backfilled: views stay shared, projects keep resolving under the key derived from their name until a
 * manager sets one. Running `up` twice is harmless (`IF NOT EXISTS` on Postgres, column and index checks elsewhere),
 * and an advisory lock (a named lock on MySQL) makes two API processes that boot together run it one after the other.
 *
 * `down` drops the columns and the index on Postgres and MySQL. SQLite keeps the columns, as every additive column of
 * this platform is kept on the embedded dialect.
 */
export class AddTaskViewsAndProjectKeys1791000004700 implements MigrationInterface {
	name = 'AddTaskViewsAndProjectKeys1791000004700';

	/** Advisory lock key that serialises concurrent runs of this migration on Postgres. */
	private readonly advisoryLockKey = 1791000004700;

	/** The MySQL named lock of this migration. MySQL refuses lock names over 64 characters. */
	readonly mysqlLockName = `gauzy:migration:${this.advisoryLockKey}`;

	public async up(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' start running!'));

		const dialect = this.dialectOf(queryRunner);
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
		for (const column of COLUMNS) {
			if (!(await queryRunner.hasTable(column.table))) continue;
			await this.addColumn(queryRunner, dialect, column);
		}
		if (await queryRunner.hasTable(KEY_INDEX.table)) {
			await this.addIndex(queryRunner, dialect);
		}
	}

	/** Adds the column when it is not there yet. */
	private async addColumn(queryRunner: QueryRunner, dialect: Dialect, column: ColumnSpec): Promise<void> {
		// Postgres guards the statement itself; the other two need the column check first.
		if (dialect !== 'postgres' && (await queryRunner.hasColumn(column.table, column.name))) {
			return;
		}
		const ifNotExists = dialect === 'postgres' ? 'IF NOT EXISTS ' : '';
		await queryRunner.query(
			`ALTER TABLE ${quoted(dialect, column.table)} ADD COLUMN ${ifNotExists}${quoted(dialect, column.name)} ${column[dialect]}`
		);
	}

	private async addIndex(queryRunner: QueryRunner, dialect: Dialect): Promise<void> {
		const columns = KEY_INDEX.columns.map((name) => quoted(dialect, name)).join(', ');
		if (dialect === 'mysql') {
			const table = await queryRunner.getTable(KEY_INDEX.table);
			if (table?.indices.some((index) => index.name === KEY_INDEX.name)) return;
			await queryRunner.query(`CREATE UNIQUE INDEX \`${KEY_INDEX.name}\` ON \`${KEY_INDEX.table}\` (${columns})`);
			return;
		}
		await queryRunner.query(
			`CREATE UNIQUE INDEX IF NOT EXISTS ${quoted(dialect, KEY_INDEX.name)} ON ${quoted(dialect, KEY_INDEX.table)} (${columns})`
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' reverting changes!'));

		const dialect = this.dialectOf(queryRunner);
		switch (dialect) {
			case 'postgres':
				await queryRunner.query(`DROP INDEX IF EXISTS "${KEY_INDEX.name}"`);
				for (const column of [...COLUMNS].reverse()) {
					if (!(await queryRunner.hasTable(column.table))) continue;
					await queryRunner.query(`ALTER TABLE "${column.table}" DROP COLUMN IF EXISTS "${column.name}"`);
				}
				break;
			case 'sqlite':
				await queryRunner.query(`DROP INDEX IF EXISTS "${KEY_INDEX.name}"`);
				console.log(chalk.gray(`${this.name}: the embedded dialect keeps its additive columns.`));
				break;
			case 'mysql': {
				const table = await queryRunner.getTable(KEY_INDEX.table);
				if (table?.indices.some((index) => index.name === KEY_INDEX.name)) {
					await queryRunner.query(`DROP INDEX \`${KEY_INDEX.name}\` ON \`${KEY_INDEX.table}\``);
				}
				for (const column of [...COLUMNS].reverse()) {
					if ((await queryRunner.hasTable(column.table)) && (await queryRunner.hasColumn(column.table, column.name))) {
						await queryRunner.query(`ALTER TABLE \`${column.table}\` DROP COLUMN \`${column.name}\``);
					}
				}
				break;
			}
		}
	}

	/** The dialect of the connection's driver. Throws before any statement runs on any other database. */
	private dialectOf(queryRunner: QueryRunner): Dialect {
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
}

/** An identifier quoted for the dialect. */
function quoted(dialect: Dialect, identifier: string): string {
	return dialect === 'mysql' ? `\`${identifier}\`` : `"${identifier}"`;
}

/**
 * Runs `work` while holding a MySQL named lock (`GET_LOCK`), so that two processes running the same migration
 * concurrently run its check and DDL one after the other. The lock is session-level and released in `finally`.
 */
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
