import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/** The databases this migration runs on. Both SQLite drivers share one entry. */
type Dialect = 'postgres' | 'sqlite' | 'mysql';

/** The table this migration changes. */
const TABLE = 'time_log';

/** The log a split cut this one from. */
const SPLIT_FROM = 'splitFromTimeLogId';

/** The index's name: TypeORM's own for `time_log.splitFromTimeLogId` (`DefaultNamingStrategy`). */
export const TIME_LOG_SPLIT_FROM_INDEX = 'IDX_1406ae5ea2bf25e4f890ab3596';

/** The column's definition on each database: a time log id, as `time_log.id` is stored there. */
const COLUMN: Record<Dialect, string> = {
	postgres: 'uuid',
	sqlite: 'varchar',
	mysql: 'varchar(36) NULL'
};

/**
 * Adds `time_log.splitFromTimeLogId` (nullable, indexed): the log a split cut this one from, written in the same save
 * as the part after the new range (`DeleteTimeSpanHandler`). While such a part still ends where its log ends and
 * starts inside it, which a split whose cut and undo both failed leaves, the log is not split again, on any API
 * process and after a restart (ever-co/ever-gauzy#11887).
 *
 * Nothing is backfilled and no existing value changes: the column is nullable, and no log saved before it names
 * where it was cut from, as nothing recorded that until now. It is a plain column, with no foreign key: the part
 * outlives the log it was cut from. On Postgres 11+ adding the column is a catalog-only change; the index is built in
 * the migration's transaction, which holds a write lock on `time_log` while it scans the table: on a large deployment,
 * add the column and `CREATE INDEX CONCURRENTLY` under the same name first, and every step here is then a no-op.
 *
 * Running `up` twice is harmless (a column and an index check on every dialect), and a transaction-scoped advisory
 * lock (a named lock on MySQL) makes two API processes that boot at the same time against one database run it one
 * after the other.
 *
 * `down` drops the index and the column on Postgres and MySQL. SQLite drops the index and keeps the column, as every
 * additive column of this platform is kept on the embedded dialect; a kept nullable column is invisible to a build
 * without the entity member.
 */
export class AddTimeLogSplitFromTimeLogId1791000011950 implements MigrationInterface {
	name = 'AddTimeLogSplitFromTimeLogId1791000011950';

	/** Advisory lock key that serialises concurrent runs of this migration on Postgres. */
	private readonly advisoryLockKey = 1791000011950;

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
		// the column missing. A named lock makes the checks and the DDL one critical section.
		if (dialect === 'mysql') {
			await withMysqlNamedLock(queryRunner, this.mysqlLockName, () => this.addColumn(queryRunner, dialect));
			return;
		}
		await this.addColumn(queryRunner, dialect);
	}

	/** Adds the column when it is not there yet, then its index. */
	private async addColumn(queryRunner: QueryRunner, dialect: Dialect): Promise<void> {
		// Asked first on every dialect: on PostgreSQL even `ADD COLUMN IF NOT EXISTS` takes an ACCESS EXCLUSIVE lock on
		// `time_log` and waits behind every open transaction, while this catalog read takes none.
		const hasColumn = await queryRunner.hasColumn(TABLE, SPLIT_FROM);
		if (!hasColumn) {
			let ifNotExists = '';
			if (dialect === 'postgres') {
				ifNotExists = 'IF NOT EXISTS ';
			}
			await queryRunner.query(
				`ALTER TABLE ${quoted(dialect, TABLE)} ADD COLUMN ${ifNotExists}${quoted(dialect, SPLIT_FROM)} ${COLUMN[dialect]}`
			);
		}

		await this.addIndex(queryRunner, dialect);
	}

	/** Adds the index on the column. MySQL has no `IF NOT EXISTS` for an index, so the table is asked first. */
	private async addIndex(queryRunner: QueryRunner, dialect: Dialect): Promise<void> {
		if (dialect === 'mysql') {
			if (await this.hasIndex(queryRunner)) {
				return;
			}
			await queryRunner.query(
				`CREATE INDEX \`${TIME_LOG_SPLIT_FROM_INDEX}\` ON \`${TABLE}\` (\`${SPLIT_FROM}\`)`
			);
			return;
		}
		await queryRunner.query(
			`CREATE INDEX IF NOT EXISTS "${TIME_LOG_SPLIT_FROM_INDEX}" ON "${TABLE}" ("${SPLIT_FROM}")`
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' reverting changes!'));

		const dialect = this.dialectOf(queryRunner);
		if (!(await queryRunner.hasTable(TABLE))) return;

		switch (dialect) {
			case 'postgres':
				await queryRunner.query(`DROP INDEX IF EXISTS "${TIME_LOG_SPLIT_FROM_INDEX}"`);
				await queryRunner.query(`ALTER TABLE "${TABLE}" DROP COLUMN IF EXISTS "${SPLIT_FROM}"`);
				break;
			case 'sqlite':
				await queryRunner.query(`DROP INDEX IF EXISTS "${TIME_LOG_SPLIT_FROM_INDEX}"`);
				console.log(chalk.gray(`${this.name}: the embedded dialect keeps its additive columns.`));
				break;
			case 'mysql':
				await withMysqlNamedLock(queryRunner, this.mysqlLockName, () => this.mysqlDown(queryRunner));
				break;
		}
	}

	/** Drops the index, then the column. */
	private async mysqlDown(queryRunner: QueryRunner): Promise<void> {
		if (await this.hasIndex(queryRunner)) {
			await queryRunner.query(`DROP INDEX \`${TIME_LOG_SPLIT_FROM_INDEX}\` ON \`${TABLE}\``);
		}
		if (await queryRunner.hasColumn(TABLE, SPLIT_FROM)) {
			await queryRunner.query(`ALTER TABLE \`${TABLE}\` DROP COLUMN \`${SPLIT_FROM}\``);
		}
	}

	/** Whether the table already carries the index, asked of the table's own metadata. */
	private async hasIndex(queryRunner: QueryRunner): Promise<boolean> {
		const table = await queryRunner.getTable(TABLE);
		return Boolean(table?.indices?.some((index) => index.name === TIME_LOG_SPLIT_FROM_INDEX));
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
