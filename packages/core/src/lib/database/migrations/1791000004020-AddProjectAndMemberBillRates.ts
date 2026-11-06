import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/** The databases this migration runs on. Both SQLite drivers share one entry. */
type Dialect = 'postgres' | 'sqlite' | 'mysql';

/** The rate column, as `employee.billRateValue` is declared since issue #10199. */
const RATE_COLUMN: Readonly<Record<Dialect, string>> = {
	postgres: 'numeric(14,2)',
	sqlite: 'numeric(14,2)',
	mysql: 'decimal(14,2) NULL'
};

/** The tables this migration adds a `billRateValue` column to. */
const TABLES: ReadonlyArray<string> = ['organization_project', 'organization_project_employee'];

const COLUMN = 'billRateValue';

/**
 * Adds `organization_project.billRateValue` and `organization_project_employee.billRateValue` (nullable
 * `numeric(14,2)`): a project's client rate and a member's client rate on a project, what the client is billed per
 * hour, both in the project's currency. Neither changes what members are paid.
 *
 * Both columns are nullable and nothing is backfilled: every project and membership reads "no rate". On Postgres 11+
 * adding a nullable column is a catalog-only change.
 *
 * Running `up` twice is harmless (`IF NOT EXISTS` on Postgres, a column check elsewhere), and a transaction-scoped
 * advisory lock (a named lock on MySQL) makes two API processes that boot at the same time against one database run
 * it one after the other.
 *
 * `down` drops the columns on Postgres and MySQL. SQLite keeps them, as every additive column of this platform is
 * kept on the embedded dialect; a kept nullable column is invisible to a build without the entity members.
 */
export class AddProjectAndMemberBillRates1791000004020 implements MigrationInterface {
	name = 'AddProjectAndMemberBillRates1791000004020';

	/** Advisory lock key that serialises concurrent runs of this migration on Postgres. */
	private readonly advisoryLockKey = 1791000004020;

	/** The MySQL named lock of this migration. MySQL refuses lock names over 64 characters. */
	readonly mysqlLockName = `gauzy:migration:${this.advisoryLockKey}`;

	public async up(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' start running!'));

		const dialect = this.dialectOf(queryRunner);

		if (dialect === 'postgres' && queryRunner.isTransactionActive) {
			await queryRunner.query(`SELECT pg_advisory_xact_lock($1)`, [this.advisoryLockKey]);
		}

		// MySQL has no transactional DDL and no migration-run lock: two processes booting together would both see
		// the columns missing. A named lock makes the checks and the DDL one critical section.
		if (dialect === 'mysql') {
			await withMysqlNamedLock(queryRunner, this.mysqlLockName, () => this.addColumns(queryRunner, dialect));
			return;
		}
		await this.addColumns(queryRunner, dialect);
	}

	/** Adds the rate column to each table that exists and does not have it yet. */
	private async addColumns(queryRunner: QueryRunner, dialect: Dialect): Promise<void> {
		for (const table of TABLES) {
			const hasTable = await queryRunner.hasTable(table);
			if (!hasTable) {
				continue;
			}
			// Postgres guards the statement itself; the other two need the column check first.
			const guardsItself = dialect === 'postgres';
			if (!guardsItself) {
				const hasColumn = await queryRunner.hasColumn(table, COLUMN);
				if (hasColumn) {
					continue;
				}
			}
			const ifNotExists = ifNotExistsClause(dialect);
			await queryRunner.query(
				`ALTER TABLE ${quoted(dialect, table)} ADD COLUMN ${ifNotExists}${quoted(dialect, COLUMN)} ${RATE_COLUMN[dialect]}`
			);
		}
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' reverting changes!'));

		const dialect = this.dialectOf(queryRunner);

		if (dialect === 'sqlite') {
			console.log(chalk.gray(`${this.name}: the embedded dialect keeps its additive columns.`));
			return;
		}
		for (const table of TABLES) {
			const hasTable = await queryRunner.hasTable(table);
			if (!hasTable) {
				continue;
			}
			if (dialect === 'postgres') {
				await queryRunner.query(`ALTER TABLE "${table}" DROP COLUMN IF EXISTS "${COLUMN}"`);
				continue;
			}
			const hasColumn = await queryRunner.hasColumn(table, COLUMN);
			if (hasColumn) {
				await queryRunner.query(`ALTER TABLE \`${table}\` DROP COLUMN \`${COLUMN}\``);
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

/**
 * Runs `work` while holding a MySQL named lock (`GET_LOCK`), so that two processes running the same migration
 * concurrently run its checks and DDL one after the other. The lock is session-level and released in `finally`.
 */
async function withMysqlNamedLock(
	queryRunner: QueryRunner,
	lockName: string,
	work: () => Promise<void>
): Promise<void> {
	const [row] = await queryRunner.query(`SELECT GET_LOCK(?, 120) AS \`acquired\``, [lockName]);
	if (Number(row?.acquired) !== 1) {
		throw new Error(`Could not acquire the MySQL migration lock ${lockName}.`);
	}
	try {
		await work();
	} finally {
		await queryRunner.query(`SELECT RELEASE_LOCK(?)`, [lockName]);
	}
}

/** Quotes an identifier the way the dialect expects: backticks on MySQL, double quotes elsewhere. */
function quoted(dialect: Dialect, identifier: string): string {
	if (dialect === 'mysql') {
		return `\`${identifier}\``;
	}
	return `"${identifier}"`;
}

/** Postgres guards an added column itself; the other dialects check for it first. */
function ifNotExistsClause(dialect: Dialect): string {
	if (dialect === 'postgres') {
		return 'IF NOT EXISTS ';
	}
	return '';
}
