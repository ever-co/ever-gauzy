import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/** The databases this migration runs on. Both SQLite drivers share one entry. */
type Dialect = 'postgres' | 'sqlite' | 'mysql';

/**
 * The presence columns, in the order `up` adds them (`down` drops them in reverse), with their type on
 * each database. None has a default and every type is nullable.
 */
const PRESENCE_COLUMNS: ReadonlyArray<{ readonly name: string } & Readonly<Record<Dialect, string>>> = [
	{ name: 'lastSeenAt', postgres: 'TIMESTAMP', sqlite: 'datetime', mysql: 'datetime NULL' },
	{ name: 'isIdle', postgres: 'boolean', sqlite: 'boolean', mysql: 'tinyint NULL' }
];

/**
 * Adds `employee.lastSeenAt` and `employee.isIdle`, written by the presence heartbeat
 * (`PUT /employee/me/presence`): when the employee's client last reported in, and whether it saw no
 * user input for a while at that time.
 *
 * Both are nullable with no default: existing employees keep NULL, which reads as "never seen", so no
 * existing row is read or written and no client that ignores the columns is affected.
 *
 * Safe to run on a live database: on Postgres a nullable column without a default is a catalog-only
 * change. Running `up` twice is harmless (`IF NOT EXISTS` on Postgres, a column check elsewhere), and a
 * transaction-scoped advisory lock makes two API processes that boot at the same time against one
 * database run it one after the other.
 *
 * `down` drops both columns.
 */
export class AddEmployeePresence1790000025000 implements MigrationInterface {
	name = 'AddEmployeePresence1790000025000';

	/** Advisory lock key that serialises concurrent runs of this migration on Postgres. */
	private readonly advisoryLockKey = 1790000025000;

	public async up(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' start running!'));

		const dialect = this.dialectOf(queryRunner);
		if (dialect === 'postgres' && queryRunner.isTransactionActive) {
			await queryRunner.query(`SELECT pg_advisory_xact_lock($1)`, [this.advisoryLockKey]);
		}

		for (const column of PRESENCE_COLUMNS) {
			// Postgres guards the statement itself; the other two need the column check first.
			if (dialect !== 'postgres' && (await queryRunner.hasColumn('employee', column.name))) continue;

			const ifNotExists = dialect === 'postgres' ? 'IF NOT EXISTS ' : '';
			await queryRunner.query(
				`ALTER TABLE ${quoted(dialect, 'employee')} ADD COLUMN ${ifNotExists}${quoted(dialect, column.name)} ${column[dialect]}`
			);
		}
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' reverting changes!'));

		const dialect = this.dialectOf(queryRunner);
		for (const { name } of [...PRESENCE_COLUMNS].reverse()) {
			if (dialect !== 'postgres' && !(await queryRunner.hasColumn('employee', name))) continue;

			const ifExists = dialect === 'postgres' ? 'IF EXISTS ' : '';
			await queryRunner.query(
				`ALTER TABLE ${quoted(dialect, 'employee')} DROP COLUMN ${ifExists}${quoted(dialect, name)}`
			);
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

/** Quotes an identifier the way the dialect expects: backticks on MySQL, double quotes elsewhere. */
function quoted(dialect: Dialect, identifier: string): string {
	return dialect === 'mysql' ? `\`${identifier}\`` : `"${identifier}"`;
}
