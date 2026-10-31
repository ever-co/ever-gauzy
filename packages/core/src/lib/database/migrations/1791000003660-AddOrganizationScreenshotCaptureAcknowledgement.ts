import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/** The databases this migration runs on. Both SQLite drivers share one entry. */
type Dialect = 'postgres' | 'sqlite' | 'mysql';

/** The table this migration changes. */
const TABLE = 'organization';

/** When screen capture was last turned on with the admin's acknowledgement. */
const ACKNOWLEDGED_AT = 'screenshotCaptureAcknowledgedAt';

/** Who gave that acknowledgement. */
const ACKNOWLEDGED_BY = 'screenshotCaptureAcknowledgedByUserId';

/**
 * The foreign key's name: TypeORM's own for `organization.screenshotCaptureAcknowledgedByUserId`
 * (`DefaultNamingStrategy.foreignKeyName`), so a schema comparison finds the constraint the entity declares.
 */
const FOREIGN_KEY = 'FK_fc68b0554abdb810ac724ee4059';

/** Each column's definition on each database. */
const COLUMNS: ReadonlyArray<{ name: string } & Record<Dialect, string>> = [
	{ name: ACKNOWLEDGED_AT, postgres: 'TIMESTAMP', sqlite: 'datetime', mysql: 'datetime NULL' },
	{
		name: ACKNOWLEDGED_BY,
		postgres: 'uuid',
		// SQLite cannot add a constraint to an existing table, but a column it adds may carry one inline
		// (its default must then be NULL, which it is).
		sqlite: `varchar CONSTRAINT "${FOREIGN_KEY}" REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
		mysql: 'varchar(255) NULL'
	}
];

/**
 * Adds the record of the screen capture acknowledgement to `organization` (issue #9872):
 * `screenshotCaptureAcknowledgedAt` (nullable timestamp) and `screenshotCaptureAcknowledgedByUserId`
 * (nullable, → `user`, `ON DELETE SET NULL`: the acknowledgement is history and outlives the admin's account,
 * whose ID the activity log keeps).
 *
 * Turning screen capture on for an organization in the EEA or the UK now takes the admin's explicit
 * acknowledgement, and the API writes who gave it and when in the same write that turns capture on. The tenant
 * is the organization's own.
 *
 * Nothing is backfilled and no existing value changes: `allowScreenshotCapture` keeps its column default and
 * every organization keeps the value it has. Both columns are nullable, and on Postgres 11+ adding them is a
 * catalog-only change.
 *
 * Running `up` twice is harmless (`IF NOT EXISTS` on Postgres, a column and constraint check elsewhere), and a
 * transaction-scoped advisory lock (a named lock on MySQL) makes two API processes that boot at the same time
 * against one database run it one after the other.
 *
 * `down` drops the constraint and both columns on Postgres and MySQL. SQLite keeps them, as every additive column
 * of this platform is kept on the embedded dialect (dropping a column that carries a constraint there means a
 * table rebuild); a kept nullable column is invisible to a build without the entity members.
 */
export class AddOrganizationScreenshotCaptureAcknowledgement1791000003660 implements MigrationInterface {
	name = 'AddOrganizationScreenshotCaptureAcknowledgement1791000003660';

	/** Advisory lock key that serialises concurrent runs of this migration on Postgres. */
	private readonly advisoryLockKey = 1791000003660;

	/**
	 * The MySQL named lock of this migration. MySQL refuses lock names over 64 characters, so the name carries the
	 * timestamp rather than the class name.
	 */
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

	/** Adds the columns that are not there yet, then the foreign key (inline on SQLite). */
	private async addColumns(queryRunner: QueryRunner, dialect: Dialect): Promise<void> {
		for (const column of COLUMNS) {
			// Postgres guards the statement itself; the other two need the column check first.
			if (dialect !== 'postgres' && (await queryRunner.hasColumn(TABLE, column.name))) {
				continue;
			}
			const ifNotExists = dialect === 'postgres' ? 'IF NOT EXISTS ' : '';
			await queryRunner.query(
				`ALTER TABLE ${quoted(dialect, TABLE)} ADD COLUMN ${ifNotExists}${quoted(dialect, column.name)} ${column[dialect]}`
			);
		}

		if (dialect === 'sqlite' || (await this.hasForeignKey(queryRunner))) {
			return;
		}
		await queryRunner.query(
			`ALTER TABLE ${quoted(dialect, TABLE)} ADD CONSTRAINT ${quoted(dialect, FOREIGN_KEY)} FOREIGN KEY (${quoted(
				dialect,
				ACKNOWLEDGED_BY
			)}) REFERENCES ${quoted(dialect, 'user')}(${quoted(dialect, 'id')}) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' reverting changes!'));

		const dialect = this.dialectOf(queryRunner);
		if (!(await queryRunner.hasTable(TABLE))) return;

		switch (dialect) {
			case 'postgres':
				await queryRunner.query(`ALTER TABLE "${TABLE}" DROP CONSTRAINT IF EXISTS "${FOREIGN_KEY}"`);
				for (const column of [...COLUMNS].reverse()) {
					await queryRunner.query(`ALTER TABLE "${TABLE}" DROP COLUMN IF EXISTS "${column.name}"`);
				}
				break;
			case 'sqlite':
				console.log(chalk.gray(`${this.name}: the embedded dialect keeps its additive columns.`));
				break;
			case 'mysql':
				if (await this.hasForeignKey(queryRunner)) {
					await queryRunner.query(`ALTER TABLE \`${TABLE}\` DROP FOREIGN KEY \`${FOREIGN_KEY}\``);
				}
				for (const column of [...COLUMNS].reverse()) {
					if (await queryRunner.hasColumn(TABLE, column.name)) {
						await queryRunner.query(`ALTER TABLE \`${TABLE}\` DROP COLUMN \`${column.name}\``);
					}
				}
				break;
		}
	}

	/**
	 * Whether the table already carries the foreign key. TypeORM's query runner has no `hasConstraint`, so the
	 * question is asked of the table's own metadata, which keeps a re-run and a revert idempotent.
	 */
	private async hasForeignKey(queryRunner: QueryRunner): Promise<boolean> {
		const table = await queryRunner.getTable(TABLE);
		return Boolean(table?.foreignKeys?.some((foreignKey) => foreignKey.name === FOREIGN_KEY));
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
	return dialect === 'mysql' ? `\`${identifier}\`` : `"${identifier}"`;
}
