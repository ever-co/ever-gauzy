import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/** The databases this migration runs on. Both SQLite drivers share one entry. */
type Dialect = 'postgres' | 'sqlite' | 'mysql';

const TABLE = 'employee';

/**
 * The columns this migration adds, each with its type per dialect: the rate as `employee.billRateValue` is declared
 * since issue #10199, the currency as `employee.billRateCurrency`.
 */
const COLUMNS: ReadonlyArray<{ name: string; type: Readonly<Record<Dialect, string>> }> = [
	{
		name: 'payRateValue',
		type: { postgres: 'numeric(14,2)', sqlite: 'numeric(14,2)', mysql: 'decimal(14,2) NULL' }
	},
	{
		name: 'payRateCurrency',
		type: { postgres: 'character varying', sqlite: 'varchar', mysql: 'varchar(255) NULL' }
	}
];

/**
 * Adds `employee.payRateValue` (nullable `numeric(14,2)`) and `employee.payRateCurrency` (nullable): what the
 * employee is paid per hour and its currency, apart from what a client is billed (`billRateValue`). Empty, the
 * currency is the organization's.
 *
 * Both columns are nullable and nothing is backfilled: every employee reads "no pay rate", so what they are owed
 * stays priced at their billing rate, as before. On Postgres 11+ adding a nullable column is a catalog-only change.
 *
 * Running `up` twice is harmless (`IF NOT EXISTS` on Postgres, a column check elsewhere), and a transaction-scoped
 * advisory lock (a named lock on MySQL) makes two API processes that boot at the same time against one database run
 * it one after the other.
 *
 * `down` drops the columns on Postgres and MySQL. SQLite keeps them, as every additive column of this platform is
 * kept on the embedded dialect; a kept nullable column is invisible to a build without the entity members.
 */
export class AddEmployeePayRate1791000004300 implements MigrationInterface {
	name = 'AddEmployeePayRate1791000004300';

	/** Advisory lock key that serialises concurrent runs of this migration on Postgres. */
	private readonly advisoryLockKey = 1791000004300;

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

	/** Adds each pay rate column the employee table does not have yet. */
	private async addColumns(queryRunner: QueryRunner, dialect: Dialect): Promise<void> {
		const hasTable = await queryRunner.hasTable(TABLE);
		if (!hasTable) {
			return;
		}
		for (const column of COLUMNS) {
			// Postgres guards the statement itself; the other two need the column check first.
			const guardsItself = dialect === 'postgres';
			if (!guardsItself) {
				const hasColumn = await queryRunner.hasColumn(TABLE, column.name);
				if (hasColumn) {
					continue;
				}
			}
			const ifNotExists = ifNotExistsClause(dialect);
			await queryRunner.query(
				`ALTER TABLE ${quoted(dialect, TABLE)} ADD COLUMN ${ifNotExists}${quoted(dialect, column.name)} ${column.type[dialect]}`
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
		const hasTable = await queryRunner.hasTable(TABLE);
		if (!hasTable) {
			return;
		}
		for (const column of COLUMNS) {
			if (dialect === 'postgres') {
				await queryRunner.query(`ALTER TABLE "${TABLE}" DROP COLUMN IF EXISTS "${column.name}"`);
				continue;
			}
			const hasColumn = await queryRunner.hasColumn(TABLE, column.name);
			if (hasColumn) {
				await queryRunner.query(`ALTER TABLE \`${TABLE}\` DROP COLUMN \`${column.name}\``);
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
