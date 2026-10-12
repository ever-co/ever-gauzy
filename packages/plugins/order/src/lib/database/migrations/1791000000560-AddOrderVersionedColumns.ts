import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * States the version column of the order aggregate, and the index that reads a change by the order
 * version it produced.
 *
 * ## Why a tick of its own
 *
 * `order` is created by `1791000000220-CreateOrderTables`, this package's first tick, and already
 * carries a `version` column — the totals-version pointer. What this tick adds is the *contract* that
 * column now carries: a versioned aggregate's version is `integer NOT NULL DEFAULT 1`, it is stated
 * back by a caller as `If-Match` or as the `version` argument of a mutation, and it is incremented by
 * the same statement that checks it. A migration's timestamp is frozen once it has shipped, so the
 * contract is stated in the set's next free tick rather than by editing the create tick that a thousand
 * installations have already run.
 *
 * **`order_change.version` is deliberately not touched, and the reason is what the column means.** It
 * is not a version of the change: it is the order version the change produces, written once when the
 * change is requested. The aggregate's optimistic lock is the *order's* version, which every write of a
 * change goes through, so a default on this column would state a fact the design does not hold. This
 * tick therefore leaves its definition exactly as the create tick declared it, and states only the
 * index over it.
 *
 * ## What it does, and why each statement is guarded
 *
 * - **The order's column is added where it is absent.** A database whose `order` table was created
 *   before the version pointer existed — or whose schema the ORM synchronised from an older entity —
 *   has the table without the column, and a versioned aggregate cannot be read at all in that state.
 *   The guard makes the statement a no-op on every installation that already has it.
 * - **The default is set where the catalogue does not already report it**, so a re-run issues no DDL.
 *   SQLite cannot alter a column's default, and does not need to: the column is written on every insert
 *   by the ORM's own declaration.
 * - **`IDX_order_change_version` is created where it is missing.** It is declared by the create tick and
 *   a database whose schema the ORM synchronised carries it under a generated name or not at all. It is
 *   the index that answers "which change produced the order's version N?", which is what the column it
 *   covers means. Creation tolerates a database where it is already there — probed in the dialect's own
 *   catalogue, and `IF NOT EXISTS` where the dialect has it — so a re-run, or an installation that
 *   synchronised the schema first, issues no DDL.
 *
 * ## Why `down` does not drop the column
 *
 * `order.version` is the create tick's: it is the pointer the totals writer and the summary rows are
 * keyed by, and this tick never created it. A `down` that dropped it would destroy facts the
 * aggregate's other tables are written against, and would delete data this tick never created. `down`
 * therefore reverses exactly what this tick can have changed — the default it set and the index it
 * created — and leaves the column where it is.
 */
export class AddOrderVersionedColumns1791000000560 implements MigrationInterface {
	name = 'AddOrderVersionedColumns1791000000560';

	/** The version column the order aggregate declares. */
	private static readonly COLUMN = 'version';

	/** The table that owns the version column. */
	private static readonly TABLE = 'order';

	/** The index a change is read by, over the order version it produced. */
	private static readonly CHANGE_VERSION_INDEX = 'IDX_order_change_version';

	/** The index's columns, in order. */
	private static readonly CHANGE_VERSION_INDEX_COLUMNS = ['orderId', 'version'] as const;

	/**
	 * Up Migration
	 *
	 * @param queryRunner
	 */
	public async up(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' start running!'));

		switch (queryRunner.connection.options.type as DatabaseTypeEnum) {
			case DatabaseTypeEnum.sqlite:
			case DatabaseTypeEnum.betterSqlite3:
				await this.sqliteUpQueryRunner(queryRunner);
				break;
			case DatabaseTypeEnum.postgres:
				await this.postgresUpQueryRunner(queryRunner);
				break;
			case DatabaseTypeEnum.mysql:
				await this.mysqlUpQueryRunner(queryRunner);
				break;
			default:
				throw Error(`Unsupported database: ${queryRunner.connection.options.type}`);
		}
	}

	/**
	 * Down Migration
	 *
	 * @param queryRunner
	 */
	public async down(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' reverting changes!'));

		switch (queryRunner.connection.options.type as DatabaseTypeEnum) {
			case DatabaseTypeEnum.sqlite:
			case DatabaseTypeEnum.betterSqlite3:
				await this.sqliteDownQueryRunner(queryRunner);
				break;
			case DatabaseTypeEnum.postgres:
				await this.postgresDownQueryRunner(queryRunner);
				break;
			case DatabaseTypeEnum.mysql:
				await this.mysqlDownQueryRunner(queryRunner);
				break;
			default:
				throw Error(`Unsupported database: ${queryRunner.connection.options.type}`);
		}
	}

	/**
	 * PostgresDB Up Migration
	 *
	 * @param queryRunner
	 */
	public async postgresUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.addVersionColumn(queryRunner, DatabaseTypeEnum.postgres);
		await this.addChangeVersionIndex(queryRunner, DatabaseTypeEnum.postgres);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.dropChangeVersionIndex(queryRunner, DatabaseTypeEnum.postgres);
		await this.clearVersionDefault(queryRunner, DatabaseTypeEnum.postgres);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.addVersionColumn(queryRunner, DatabaseTypeEnum.sqlite);
		await this.addChangeVersionIndex(queryRunner, DatabaseTypeEnum.sqlite);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.dropChangeVersionIndex(queryRunner, DatabaseTypeEnum.sqlite);
		await this.clearVersionDefault(queryRunner, DatabaseTypeEnum.sqlite);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.addVersionColumn(queryRunner, DatabaseTypeEnum.mysql);
		await this.addChangeVersionIndex(queryRunner, DatabaseTypeEnum.mysql);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.dropChangeVersionIndex(queryRunner, DatabaseTypeEnum.mysql);
		await this.clearVersionDefault(queryRunner, DatabaseTypeEnum.mysql);
	}

	/**
	 * Gives the order the version column the entity declares, with the default it states.
	 *
	 * @param queryRunner
	 * @param dialect The dialect whose statement form is used.
	 */
	private async addVersionColumn(queryRunner: QueryRunner, dialect: DatabaseTypeEnum): Promise<void> {
		const table = AddOrderVersionedColumns1791000000560.TABLE;
		const column = AddOrderVersionedColumns1791000000560.COLUMN;

		if (!(await queryRunner.hasTable(table))) {
			return;
		}

		if (!(await queryRunner.hasColumn(table, column))) {
			await queryRunner.query(
				`ALTER TABLE ${this.quote(table, dialect)} ADD COLUMN ${this.quote(
					column,
					dialect
				)} ${this.integerType(dialect)} NOT NULL DEFAULT 1`
			);
		}

		// The default is stated only where the catalogue says it is not already the one the column
		// carries, so a second run — or a database the ORM synchronised first — issues no DDL.
		if (!(await this.versionDefaultsTo(queryRunner, dialect, table))) {
			await this.setVersionDefault(queryRunner, dialect, table);
		}
	}

	/**
	 * Whether the dialect's catalogue already reports the version column's default as `1`.
	 *
	 * The catalogue is read rather than assumed because the two states this file repairs — a column
	 * created without a default, and a column created with one — install identically otherwise, and a
	 * statement that ran on both would make `up` a write on every run. SQLite carries no default to
	 * read: it cannot alter one either, which is why the answer it gives is "not stated" and the
	 * statement it declines to issue is logged.
	 *
	 * @param queryRunner
	 * @param dialect The dialect whose catalogue is read.
	 * @param table The table whose version column is read.
	 * @returns True when the default is already `1`.
	 */
	private async versionDefaultsTo(
		queryRunner: QueryRunner,
		dialect: DatabaseTypeEnum,
		table: string
	): Promise<boolean> {
		const column = AddOrderVersionedColumns1791000000560.COLUMN;

		if (dialect === DatabaseTypeEnum.sqlite || dialect === DatabaseTypeEnum.betterSqlite3) {
			return false;
		}

		const rows: any[] =
			dialect === DatabaseTypeEnum.mysql
				? await queryRunner.query(
						`SELECT column_default FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ? LIMIT 1`,
						[table, column]
				  )
				: await queryRunner.query(
						`SELECT column_default FROM information_schema.columns WHERE table_name = $1 AND column_name = $2 LIMIT 1`,
						[table, column]
				  );

		if (!Array.isArray(rows) || rows.length === 0) {
			return false;
		}

		// PostgreSQL reports the default as the expression it stores — `'1'::integer` for an integer
		// column — so the quotes and the cast are stripped before the value is compared.
		const stored = String(rows[0]?.column_default ?? '')
			.trim()
			.replace(/::[a-z ]+$/i, '')
			.replace(/^'|'$/g, '')
			.trim();

		return stored === '1';
	}

	/**
	 * States the column's default on a dialect that can alter one.
	 *
	 * @param queryRunner
	 * @param dialect The dialect whose statement form is used.
	 * @param table The table whose version column is defaulted.
	 */
	private async setVersionDefault(
		queryRunner: QueryRunner,
		dialect: DatabaseTypeEnum,
		table: string
	): Promise<void> {
		const column = AddOrderVersionedColumns1791000000560.COLUMN;

		if (dialect === DatabaseTypeEnum.mysql) {
			await queryRunner.query(
				`ALTER TABLE ${this.quote(table, dialect)} MODIFY COLUMN ${this.quote(
					column,
					dialect
				)} int NOT NULL DEFAULT 1`
			);

			return;
		}

		if (dialect === DatabaseTypeEnum.postgres) {
			await queryRunner.query(
				`ALTER TABLE ${this.quote(table, dialect)} ALTER COLUMN ${this.quote(column, dialect)} SET DEFAULT 1`
			);

			return;
		}

		// SQLite has no `ALTER COLUMN` at all, and the column's default is the ORM's declaration rather
		// than the schema's on this dialect, so the entity's own definition is what a row receives.
		console.log(
			chalk.yellow(
				`${this.name}: SQLite cannot alter a column default, so ${table}.${column} keeps the ` +
					'definition the table was created with; the ORM states it on every insert.'
			)
		);
	}

	/**
	 * Removes the default this tick states, on a dialect that can alter one.
	 *
	 * @param queryRunner
	 * @param dialect The dialect whose statement form is used.
	 */
	private async clearVersionDefault(queryRunner: QueryRunner, dialect: DatabaseTypeEnum): Promise<void> {
		const table = AddOrderVersionedColumns1791000000560.TABLE;
		const column = AddOrderVersionedColumns1791000000560.COLUMN;

		if (!(await queryRunner.hasTable(table))) {
			return;
		}

		if (dialect === DatabaseTypeEnum.mysql) {
			await queryRunner.query(
				`ALTER TABLE ${this.quote(table, dialect)} MODIFY COLUMN ${this.quote(column, dialect)} int NOT NULL`
			);

			return;
		}

		if (dialect === DatabaseTypeEnum.postgres) {
			await queryRunner.query(
				`ALTER TABLE ${this.quote(table, dialect)} ALTER COLUMN ${this.quote(column, dialect)} DROP DEFAULT`
			);
		}
	}

	/**
	 * Creates the index over the order version a change produced, unless the database already has it.
	 *
	 * The column is not probed again: it is declared by the create tick, and this tick states the index
	 * that reads it rather than the column itself.
	 *
	 * @param queryRunner
	 * @param dialect The dialect whose statement form and catalogue are used.
	 */
	private async addChangeVersionIndex(queryRunner: QueryRunner, dialect: DatabaseTypeEnum): Promise<void> {
		const table = 'order_change';

		if (!(await queryRunner.hasTable(table))) {
			return;
		}

		if (await this.indexExists(queryRunner, dialect)) {
			// The index is already there — created by the create tick, by a synchronise run under this
			// name, or by a previous run of this migration. `up` run twice therefore issues no DDL.
			return;
		}

		const name = AddOrderVersionedColumns1791000000560.CHANGE_VERSION_INDEX;
		const columns = AddOrderVersionedColumns1791000000560.CHANGE_VERSION_INDEX_COLUMNS.map((column) =>
			this.quote(column, dialect)
		).join(', ');
		// MySQL has no `IF NOT EXISTS` for an index, and the catalogue probe above is what makes this
		// statement safe to run there; the two dialects that have the clause are given it as well, so a
		// race between the probe and the statement cannot fail the migration.
		const ifNotExists = dialect === DatabaseTypeEnum.mysql ? '' : 'IF NOT EXISTS ';

		await queryRunner.query(
			`CREATE INDEX ${ifNotExists}${this.quote(name, dialect)} ON ${this.quote(table, dialect)} (${columns})`
		);
	}

	/**
	 * Drops the index over the order version a change produced, when it is present.
	 *
	 * @param queryRunner
	 * @param dialect The dialect whose statement form and catalogue are used.
	 */
	private async dropChangeVersionIndex(queryRunner: QueryRunner, dialect: DatabaseTypeEnum): Promise<void> {
		if (!(await queryRunner.hasTable('order_change'))) {
			return;
		}

		if (!(await this.indexExists(queryRunner, dialect))) {
			return;
		}

		const name = AddOrderVersionedColumns1791000000560.CHANGE_VERSION_INDEX;

		await queryRunner.query(
			dialect === DatabaseTypeEnum.mysql
				? `DROP INDEX ${this.quote(name, dialect)} ON ${this.quote('order_change', dialect)}`
				: `DROP INDEX ${this.quote(name, dialect)}`
		);
	}

	/**
	 * Whether the dialect's catalogue already carries the index.
	 *
	 * The catalogue is read rather than guessed: an index on this platform is created by a migration or
	 * by the ORM's own synchronise run, and the name is the only thing both agree on.
	 *
	 * @param queryRunner
	 * @param dialect The dialect whose catalogue is read.
	 * @returns True when the index exists.
	 */
	private async indexExists(queryRunner: QueryRunner, dialect: DatabaseTypeEnum): Promise<boolean> {
		const name = AddOrderVersionedColumns1791000000560.CHANGE_VERSION_INDEX;

		if (dialect === DatabaseTypeEnum.mysql) {
			return this.rowsExist(
				await queryRunner.query(
					`SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ? LIMIT 1`,
					['order_change', name]
				)
			);
		}

		if (dialect === DatabaseTypeEnum.sqlite) {
			return this.rowsExist(
				await queryRunner.query(`SELECT 1 FROM sqlite_master WHERE type = 'index' AND name = ? LIMIT 1`, [
					name
				])
			);
		}

		return this.rowsExist(await queryRunner.query(`SELECT 1 FROM pg_indexes WHERE indexname = $1 LIMIT 1`, [name]));
	}

	/**
	 * The dialect's integer type.
	 *
	 * @param dialect The dialect in use.
	 * @returns The column type.
	 */
	private integerType(dialect: DatabaseTypeEnum): string {
		return dialect === DatabaseTypeEnum.mysql ? 'int' : 'integer';
	}

	/**
	 * Quotes an identifier the way the dialect does.
	 *
	 * @param identifier The table, column or index name.
	 * @param dialect The dialect in use.
	 * @returns The quoted identifier.
	 */
	private quote(identifier: string, dialect: DatabaseTypeEnum): string {
		return dialect === DatabaseTypeEnum.mysql ? `\`${identifier}\`` : `"${identifier}"`;
	}

	/**
	 * Whether a probe returned a row.
	 *
	 * @param rows Whatever the driver returned.
	 * @returns True when at least one row came back.
	 */
	private rowsExist(rows: unknown): boolean {
		return Array.isArray(rows) && rows.length > 0;
	}
}
