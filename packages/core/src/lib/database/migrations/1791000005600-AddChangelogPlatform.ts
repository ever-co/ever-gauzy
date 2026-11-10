import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/** The databases this migration runs on. Both SQLite drivers share one entry. */
type Dialect = 'postgres' | 'sqlite' | 'mysql';

/** The table this migration changes. */
const TABLE = 'changelog';

/** The column this migration adds, with its definition on each database. */
const COLUMN: Readonly<{ name: string } & Record<Dialect, string>> = {
	name: 'platform',
	postgres: `character varying(50) NOT NULL DEFAULT 'gauzy'`,
	sqlite: `varchar(50) NOT NULL DEFAULT ('gauzy')`,
	mysql: `varchar(50) NOT NULL DEFAULT 'gauzy'`
};

/**
 * Adds `changelog.platform` (`varchar(50) NOT NULL DEFAULT 'gauzy'`): the product a What's New entry belongs to.
 *
 * One `changelog` table feeds the What's New of several products: Ever Teams runs on the Gauzy API (the two APIs share
 * one database), and other Ever products read the same public endpoint. Without a product on each
 * row they would all show each other's news. Every row that exists today is Gauzy's, which the default backfills, and
 * the API lists Gauzy's rows when a reader names no product, so nothing a reader sees changes.
 *
 * No index: the table holds a few dozen rows. On Postgres 11+ a column with a constant default is a catalog-only
 * change.
 *
 * Running `up` twice is harmless (`IF NOT EXISTS` on Postgres, a column check elsewhere), and a transaction-scoped
 * advisory lock (a named lock on MySQL) makes two API processes that boot at the same time against one database run
 * it one after the other.
 *
 * `down` drops the column on all three databases (on SQLite through `DROP COLUMN`, as `AddDailyPlanTaskOrder` does).
 */
export class AddChangelogPlatform1791000005600 implements MigrationInterface {
	name = 'AddChangelogPlatform1791000005600';

	/** Advisory lock key that serialises concurrent runs of this migration on Postgres. */
	private readonly advisoryLockKey = 1791000005600;

	/** The MySQL named lock of this migration. MySQL refuses lock names over 64 characters. */
	readonly mysqlLockName = `gauzy:migration:${this.advisoryLockKey}`;

	public async up(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' start running!'));

		const dialect = this.dialectOf(queryRunner);
		if (!(await queryRunner.hasTable(TABLE))) return;

		if (dialect === 'postgres' && queryRunner.isTransactionActive) {
			await queryRunner.query(`SELECT pg_advisory_xact_lock($1)`, [this.advisoryLockKey]);
		}

		// MySQL has no transactional DDL and no migration-run lock: two processes booting together would both see
		// the column missing. A named lock makes the check and the DDL one critical section.
		if (dialect === 'mysql') {
			await withMysqlNamedLock(queryRunner, this.mysqlLockName, () => this.addColumn(queryRunner, dialect));
			return;
		}
		await this.addColumn(queryRunner, dialect);
	}

	/** Adds the column when it is not there yet. */
	private async addColumn(queryRunner: QueryRunner, dialect: Dialect): Promise<void> {
		// Postgres guards the statement itself; the other two need the column check first.
		const guardsItself = dialect === 'postgres';
		if (!guardsItself) {
			const hasColumn = await queryRunner.hasColumn(TABLE, COLUMN.name);
			if (hasColumn) {
				return;
			}
		}
		const ifNotExists = ifNotExistsClause(dialect);
		await queryRunner.query(
			`ALTER TABLE ${quoted(dialect, TABLE)} ADD COLUMN ${ifNotExists}${quoted(dialect, COLUMN.name)} ${COLUMN[dialect]}`
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' reverting changes!'));

		const dialect = this.dialectOf(queryRunner);
		if (!(await queryRunner.hasTable(TABLE))) return;

		switch (dialect) {
			case 'postgres':
				await queryRunner.query(`ALTER TABLE "${TABLE}" DROP COLUMN IF EXISTS "${COLUMN.name}"`);
				break;
			case 'sqlite':
				// `DROP COLUMN` needs SQLite 3.35+, which the bundled better-sqlite3 ships.
				if (await queryRunner.hasColumn(TABLE, COLUMN.name)) {
					await queryRunner.query(`ALTER TABLE "${TABLE}" DROP COLUMN "${COLUMN.name}"`);
				}
				break;
			case 'mysql':
				if (await queryRunner.hasColumn(TABLE, COLUMN.name)) {
					await queryRunner.query(`ALTER TABLE \`${TABLE}\` DROP COLUMN \`${COLUMN.name}\``);
				}
				break;
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
 * concurrently run its check and DDL one after the other. The lock is session-level and released in `finally`.
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
