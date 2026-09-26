import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * States the version column of the fulfilment aggregate.
 *
 * ## Why a tick of its own
 *
 * `fulfillment` is created by `1791000000240-CreateFulfillmentTables`, this package's first tick, and
 * already carries a `version` column. What this tick adds is the *contract* that column now carries:
 * the shipment is a versioned aggregate, a caller states the version it read as `If-Match` or as the
 * `version` member of the mutation's input, and the increment is applied by the same statement that
 * checks it. A migration's timestamp is frozen once it has shipped, so the contract is stated in the
 * set's next free tick rather than by editing the create tick that installations have already run.
 *
 * The API specification's second column read is what made the contract necessary: `POST
 * /api/fulfillments/:id/label` writes two columns of a row a caller read, and a write that did not
 * state what it was based on would silently erase a tracking change made in between.
 *
 * ## What it does, and why each statement is guarded
 *
 * - **The column is added where it is absent.** A database whose `fulfillment` table was created
 *   before the version pointer existed — or whose schema the ORM synchronised from an older entity —
 *   has the table without the column, and a versioned aggregate cannot be read at all in that state.
 *   The guard makes the statement a no-op on every installation that already has it, which is every
 *   installation the create tick has reached.
 * - **The default is set where the catalogue does not already report it**, so a re-run issues no DDL.
 *   SQLite cannot alter a column's default and does not need to: the column is written on every insert
 *   by the ORM's own declaration.
 *
 * ## Why `down` does not drop the column
 *
 * `fulfillment.version` is the create tick's: it is the counter every transition of the shipment
 * increments, and the create tick's own `INSERT`s state it. A `down` that dropped it would destroy
 * facts this tick never created, so `down` reverses exactly what this tick can have changed — the
 * default it set — and leaves the column where it is.
 */
export class AddFulfillmentVersionColumn1791000000610 implements MigrationInterface {
	name = 'AddFulfillmentVersionColumn1791000000610';

	/** The version column the fulfilment aggregate declares. */
	private static readonly COLUMN = 'version';

	/** The table that owns the version column. */
	private static readonly TABLE = 'fulfillment';

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
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.clearVersionDefault(queryRunner, DatabaseTypeEnum.postgres);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.addVersionColumn(queryRunner, DatabaseTypeEnum.sqlite);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.clearVersionDefault(queryRunner, DatabaseTypeEnum.sqlite);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.addVersionColumn(queryRunner, DatabaseTypeEnum.mysql);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.clearVersionDefault(queryRunner, DatabaseTypeEnum.mysql);
	}

	/**
	 * Gives the fulfilment the version column the entity declares, with the default it states.
	 *
	 * @param queryRunner
	 * @param dialect The dialect whose statement form is used.
	 */
	private async addVersionColumn(queryRunner: QueryRunner, dialect: DatabaseTypeEnum): Promise<void> {
		const table = AddFulfillmentVersionColumn1791000000610.TABLE;
		const column = AddFulfillmentVersionColumn1791000000610.COLUMN;

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
		const column = AddFulfillmentVersionColumn1791000000610.COLUMN;

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
	private async setVersionDefault(queryRunner: QueryRunner, dialect: DatabaseTypeEnum, table: string): Promise<void> {
		const column = AddFulfillmentVersionColumn1791000000610.COLUMN;

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
		const table = AddFulfillmentVersionColumn1791000000610.TABLE;
		const column = AddFulfillmentVersionColumn1791000000610.COLUMN;

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
	 * @param identifier The table or column name.
	 * @param dialect The dialect in use.
	 * @returns The quoted identifier.
	 */
	private quote(identifier: string, dialect: DatabaseTypeEnum): string {
		return dialect === DatabaseTypeEnum.mysql ? `\`${identifier}\`` : `"${identifier}"`;
	}
}
