import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/** The databases this migration runs on. Both SQLite drivers share one entry. */
type Dialect = 'postgres' | 'sqlite' | 'mysql';

/** The table this migration changes. */
const TABLE = 'time_log';

/** The invoice line that bills the time. */
const INVOICE_ITEM = 'invoiceItemId';

/**
 * The foreign key's and the index's names: TypeORM's own for `time_log.invoiceItemId` (`DefaultNamingStrategy`), so
 * a schema comparison finds the constraint and the index the entity declares.
 */
export const TIME_LOG_INVOICE_ITEM_FOREIGN_KEY = 'FK_51b08d0a32553920c9bd2862fce';
export const TIME_LOG_INVOICE_ITEM_INDEX = 'IDX_51b08d0a32553920c9bd2862fc';

/** The column's definition on each database. */
const COLUMN: Record<Dialect, string> = {
	postgres: 'uuid',
	// SQLite cannot add a constraint to an existing table, but a column it adds may carry one inline
	// (its default must then be NULL, which it is).
	sqlite: `varchar CONSTRAINT "${TIME_LOG_INVOICE_ITEM_FOREIGN_KEY}" REFERENCES "invoice_item" ("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
	mysql: 'varchar(255) NULL'
};

/**
 * Adds `time_log.invoiceItemId` (nullable, indexed, → `invoice_item`, `ON DELETE SET NULL`): the invoice line that
 * bills the time, written when an invoice or its lines are saved with the time logs they bill. Deleting the line, or
 * replacing an invoice's lines, clears it.
 *
 * Nothing is backfilled and no existing value changes: the column is nullable, and time logged before reads as not
 * invoiced, which is what the API could tell until now. On Postgres 11+ adding the column is a catalog-only change.
 * The index and the foreign key are built in the migration's transaction, which holds a write lock on `time_log` while
 * each scans the table: on a large deployment, add them out-of-band first under the same names (the column, then
 * `CREATE INDEX CONCURRENTLY`, then the constraint `NOT VALID` and `VALIDATE CONSTRAINT`), and every step here is
 * then a no-op, as for `AddTimeLogAndTimeSlotCompositeIndexes1790000024000`.
 *
 * Running `up` twice is harmless (`IF NOT EXISTS` on Postgres, a column, index and constraint check elsewhere), and a
 * transaction-scoped advisory lock (a named lock on MySQL) makes two API processes that boot at the same time against
 * one database run it one after the other.
 *
 * `down` drops the constraint, the index and the column on Postgres and MySQL. SQLite drops the index and keeps the
 * column, as every additive column of this platform is kept on the embedded dialect: a column that carries a foreign
 * key is dropped there only by rebuilding `time_log`.
 */
export class AddTimeLogInvoiceItem1791000008600 implements MigrationInterface {
	name = 'AddTimeLogInvoiceItem1791000008600';

	/** Advisory lock key that serialises concurrent runs of this migration on Postgres. */
	private readonly advisoryLockKey = 1791000008600;

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
		// the column missing. A named lock makes the checks and the DDL one critical section.
		if (dialect === 'mysql') {
			await withMysqlNamedLock(queryRunner, this.mysqlLockName, () => this.addColumn(queryRunner, dialect));
			return;
		}
		await this.addColumn(queryRunner, dialect);
	}

	/** Adds the column when it is not there yet, then its index and its foreign key (inline on SQLite). */
	private async addColumn(queryRunner: QueryRunner, dialect: Dialect): Promise<void> {
		// Asked first on every dialect: on PostgreSQL even `ADD COLUMN IF NOT EXISTS` takes an ACCESS EXCLUSIVE lock on
		// `time_log` and waits behind every open transaction, while this catalog read takes none. So a column created
		// ahead of the deploy (out of band, on a large table) costs the migration no lock. `IF NOT EXISTS` stays as a guard.
		const hasColumn = await queryRunner.hasColumn(TABLE, INVOICE_ITEM);
		if (!hasColumn) {
			let ifNotExists = '';
			if (dialect === 'postgres') {
				ifNotExists = 'IF NOT EXISTS ';
			}
			await queryRunner.query(
				`ALTER TABLE ${quoted(dialect, TABLE)} ADD COLUMN ${ifNotExists}${quoted(dialect, INVOICE_ITEM)} ${COLUMN[dialect]}`
			);
		}

		await this.addIndex(queryRunner, dialect);

		if (dialect === 'sqlite' || (await this.hasForeignKey(queryRunner))) {
			return;
		}
		await queryRunner.query(
			`ALTER TABLE ${quoted(dialect, TABLE)} ADD CONSTRAINT ${quoted(dialect, TIME_LOG_INVOICE_ITEM_FOREIGN_KEY)} FOREIGN KEY (${quoted(
				dialect,
				INVOICE_ITEM
			)}) REFERENCES ${quoted(dialect, 'invoice_item')}(${quoted(dialect, 'id')}) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
	}

	/** Adds the index on the column. MySQL has no `IF NOT EXISTS` for an index, so the table is asked first. */
	private async addIndex(queryRunner: QueryRunner, dialect: Dialect): Promise<void> {
		if (dialect === 'mysql') {
			if (await this.hasIndex(queryRunner)) {
				return;
			}
			await queryRunner.query(
				`CREATE INDEX \`${TIME_LOG_INVOICE_ITEM_INDEX}\` ON \`${TABLE}\` (\`${INVOICE_ITEM}\`)`
			);
			return;
		}
		await queryRunner.query(
			`CREATE INDEX IF NOT EXISTS "${TIME_LOG_INVOICE_ITEM_INDEX}" ON "${TABLE}" ("${INVOICE_ITEM}")`
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' reverting changes!'));

		const dialect = this.dialectOf(queryRunner);
		if (!(await queryRunner.hasTable(TABLE))) return;

		switch (dialect) {
			case 'postgres':
				await queryRunner.query(
					`ALTER TABLE "${TABLE}" DROP CONSTRAINT IF EXISTS "${TIME_LOG_INVOICE_ITEM_FOREIGN_KEY}"`
				);
				await queryRunner.query(`DROP INDEX IF EXISTS "${TIME_LOG_INVOICE_ITEM_INDEX}"`);
				await queryRunner.query(`ALTER TABLE "${TABLE}" DROP COLUMN IF EXISTS "${INVOICE_ITEM}"`);
				break;
			case 'sqlite':
				await queryRunner.query(`DROP INDEX IF EXISTS "${TIME_LOG_INVOICE_ITEM_INDEX}"`);
				console.log(chalk.gray(`${this.name}: the embedded dialect keeps its additive columns.`));
				break;
			case 'mysql':
				await withMysqlNamedLock(queryRunner, this.mysqlLockName, () => this.mysqlDown(queryRunner));
				break;
		}
	}

	/** Drops the constraint, then the index (which MySQL keeps for a foreign key while one exists), then the column. */
	private async mysqlDown(queryRunner: QueryRunner): Promise<void> {
		if (await this.hasForeignKey(queryRunner)) {
			await queryRunner.query(
				`ALTER TABLE \`${TABLE}\` DROP FOREIGN KEY \`${TIME_LOG_INVOICE_ITEM_FOREIGN_KEY}\``
			);
		}
		if (await this.hasIndex(queryRunner)) {
			await queryRunner.query(`DROP INDEX \`${TIME_LOG_INVOICE_ITEM_INDEX}\` ON \`${TABLE}\``);
		}
		if (await queryRunner.hasColumn(TABLE, INVOICE_ITEM)) {
			await queryRunner.query(`ALTER TABLE \`${TABLE}\` DROP COLUMN \`${INVOICE_ITEM}\``);
		}
	}

	/**
	 * Whether the table already carries the foreign key. TypeORM's query runner has no `hasConstraint`, so the
	 * question is asked of the table's own metadata, which keeps a re-run and a revert idempotent.
	 */
	private async hasForeignKey(queryRunner: QueryRunner): Promise<boolean> {
		const table = await queryRunner.getTable(TABLE);
		return Boolean(table?.foreignKeys?.some((foreignKey) => foreignKey.name === TIME_LOG_INVOICE_ITEM_FOREIGN_KEY));
	}

	/** Whether the table already carries the index, asked of the table's metadata for the reason above. */
	private async hasIndex(queryRunner: QueryRunner): Promise<boolean> {
		const table = await queryRunner.getTable(TABLE);
		return Boolean(table?.indices?.some((index) => index.name === TIME_LOG_INVOICE_ITEM_INDEX));
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
