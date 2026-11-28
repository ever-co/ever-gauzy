import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/** The databases this migration runs on. Both SQLite drivers share one entry. */
type Dialect = 'postgres' | 'sqlite' | 'mysql';

/** The table this migration changes. */
const TABLE = 'email_sent';

/** The columns this migration adds, with their definition on each database, as TypeORM creates them for the entity. */
const COLUMNS: ReadonlyArray<Readonly<{ name: string } & Record<Dialect, string>>> = [
	{ name: 'retryCount', postgres: 'integer', sqlite: 'integer', mysql: 'int NULL' },
	{ name: 'nextRetryAt', postgres: 'TIMESTAMP', sqlite: 'datetime', mysql: 'datetime NULL' },
	{ name: 'lastErrorCode', postgres: 'character varying', sqlite: 'varchar', mysql: 'varchar(255) NULL' },
	{ name: 'lastRetryAt', postgres: 'TIMESTAMP', sqlite: 'datetime', mysql: 'datetime NULL' }
];

/**
 * Adds the automatic retry state of a failed email to `email_sent`: `retryCount` (how many automatic retries it had),
 * `nextRetryAt` (when the next one is due), `lastErrorCode` (why the last attempt failed, without any address) and
 * `lastRetryAt` (when a sweep last claimed it, which is what the installation-wide cap on retries counts). See
 * `email-send/email-retry.policy.ts`.
 *
 * All four are nullable with no default, so adding them rewrites no row, and nothing is backfilled: every row written
 * before this migration has no `nextRetryAt`, and only a row with one is ever retried, so deploying it sends no old
 * email. No index is added, so the migration takes no lock that would hold up the emails being filed meanwhile: the
 * sweep reads the failed rows (`status` is indexed) of the last two hours, and counts the recent claims only while a
 * retry is due.
 *
 * Running `up` twice is harmless (`IF NOT EXISTS` on Postgres, a column check elsewhere), and a transaction-scoped
 * advisory lock (a named lock on MySQL) makes two API processes that boot at the same time against one database run
 * it one after the other.
 *
 * `down` drops the columns on Postgres and MySQL. SQLite keeps them, as every additive column of this platform is kept
 * on the embedded dialect; a kept nullable column is invisible to a build without the entity members.
 */
export class AddEmailSentRetryColumns1791000019950 implements MigrationInterface {
	name = 'AddEmailSentRetryColumns1791000019950';

	/** Advisory lock key that serialises concurrent runs of this migration on Postgres. */
	private readonly advisoryLockKey = 1791000019950;

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
		// the columns missing. A named lock makes the checks and the DDL one critical section.
		if (dialect === 'mysql') {
			await withMysqlNamedLock(queryRunner, this.mysqlLockName, () => this.addColumns(queryRunner, dialect));
			return;
		}
		await this.addColumns(queryRunner, dialect);
	}

	/** Adds each column that is not there yet. */
	private async addColumns(queryRunner: QueryRunner, dialect: Dialect): Promise<void> {
		for (const column of COLUMNS) {
			// Postgres guards the statement itself; the other two need the column check first.
			if (dialect !== 'postgres' && (await queryRunner.hasColumn(TABLE, column.name))) {
				continue;
			}
			const ifNotExists = dialect === 'postgres' ? 'IF NOT EXISTS ' : '';
			await queryRunner.query(
				`ALTER TABLE ${quoted(dialect, TABLE)} ADD COLUMN ${ifNotExists}${quoted(dialect, column.name)} ${
					column[dialect]
				}`
			);
		}
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' reverting changes!'));

		const dialect = this.dialectOf(queryRunner);
		if (!(await queryRunner.hasTable(TABLE))) return;

		switch (dialect) {
			case 'postgres':
				for (const column of COLUMNS) {
					await queryRunner.query(`ALTER TABLE "${TABLE}" DROP COLUMN IF EXISTS "${column.name}"`);
				}
				break;
			case 'sqlite':
				console.log(chalk.gray(`${this.name}: the embedded dialect keeps its additive columns.`));
				break;
			case 'mysql':
				for (const column of COLUMNS) {
					if (await queryRunner.hasColumn(TABLE, column.name)) {
						await queryRunner.query(`ALTER TABLE \`${TABLE}\` DROP COLUMN \`${column.name}\``);
					}
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
