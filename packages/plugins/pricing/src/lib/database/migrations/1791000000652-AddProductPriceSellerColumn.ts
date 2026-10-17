import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * Creates `product_price.sellerId` in the package that owns it (review R5-14).
 *
 * ## Why
 *
 * The column is declared by the pricing plugin, which declares it on `ProductPrice` (`sellerId`), but until now only the
 * marketplace plugin's `AddMarketplaceAmendmentColumns1791000000435` created it. An
 * installation that hosts this package without the marketplace — the worker hosts the kernel, pricing, cart, order,
 * inventory and the catalogue, not the marketplace — maps a column its own migrations never create, so every read
 * or write of the row fails with "no such column" (a fresh worker database today; on a shared database, the window
 * before the API has run 0435). This tick makes the owner create what the owner declares, for every process that hosts pricing — the API and the worker alike.
 *
 * ## What
 *
 * Each column is added where the table exists and the column does not, with the definition
 * `1791000000435` uses, so an installation that ran the marketplace's tick first sees a no-op and one without the
 * marketplace gets exactly the column the marketplace would have added. The foreign key to `seller`, the indexes
 * the marketplace reads through and its `CHECK` rules stay the marketplace's: they constrain a seller relation,
 * and `seller` is the marketplace's table.
 *
 * ## Down
 *
 * The column is dropped only where the marketplace's tick has **not** run: there they are this tick's
 * alone. Where it has run they are the marketplace's too — its foreign key, its indexes and its rules sit on them,
 * and its own down leaves the columns in place — so this down leaves them as well. SQLite keeps them either way,
 * as every additive column of this platform is kept on the embedded dialect: dropping one there means a table
 * rebuild, the destructive `ALTER` the conventions refuse.
 */
export class AddProductPriceSellerColumn1791000000652 implements MigrationInterface {
	name = 'AddProductPriceSellerColumn1791000000652';

	/** The table the columns belong to. */
	private static readonly TABLE = 'product_price';

	/** The columns, as `AddMarketplaceAmendmentColumns1791000000435` defines them on each dialect. */
	private static readonly COLUMNS: ReadonlyArray<{ name: string; sqlite: string; postgres: string; mysql: string }> =
		[{ name: 'sellerId', sqlite: `varchar`, postgres: `uuid`, mysql: `varchar(36) NULL` }];

	/** The marketplace tick that also adds these columns, and whose constraints sit on them once it has run. */
	private static readonly MARKETPLACE_TICK = 'AddMarketplaceAmendmentColumns1791000000435';

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
	 * SqliteDB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.addColumns(queryRunner, 'sqlite');
	}

	/**
	 * SqliteDB Down Migration
	 *
	 * The columns are kept: see the class documentation.
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(_queryRunner: QueryRunner): Promise<any> {
		console.log(chalk.gray(`${this.name}: the embedded dialect keeps its additive columns.`));
	}

	/**
	 * PostgresDB Up Migration
	 *
	 * @param queryRunner
	 */
	public async postgresUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.addColumns(queryRunner, 'postgres');
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.dropColumns(queryRunner, 'postgres');
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.addColumns(queryRunner, 'mysql');
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.dropColumns(queryRunner, 'mysql');
	}

	/**
	 * Adds every column that is missing, when the table is there.
	 *
	 * @param queryRunner The runner the migration is executing on.
	 * @param dialect The dialect, for its quoting and its column definition.
	 */
	private async addColumns(queryRunner: QueryRunner, dialect: 'sqlite' | 'postgres' | 'mysql'): Promise<void> {
		const table = AddProductPriceSellerColumn1791000000652.TABLE;

		if (!(await queryRunner.hasTable(table))) {
			return;
		}

		const quote = dialect === 'mysql' ? '`' : '"';

		for (const column of AddProductPriceSellerColumn1791000000652.COLUMNS) {
			if (await queryRunner.hasColumn(table, column.name)) {
				continue;
			}

			await queryRunner.query(
				`ALTER TABLE ${quote}${table}${quote} ADD COLUMN ${quote}${column.name}${quote} ${column[dialect]}`
			);
			console.log(chalk.yellow(`${this.name}: added ${table}.${column.name}.`));
		}
	}

	/**
	 * Drops the columns, unless the marketplace's tick has run here and they are its columns too.
	 *
	 * @param queryRunner The runner the migration is executing on.
	 * @param dialect The dialect, for its quoting.
	 */
	private async dropColumns(queryRunner: QueryRunner, dialect: 'postgres' | 'mysql'): Promise<void> {
		const table = AddProductPriceSellerColumn1791000000652.TABLE;

		if (!(await queryRunner.hasTable(table))) {
			return;
		}
		if (await this.marketplaceTickHasRun(queryRunner)) {
			console.log(
				chalk.gray(
					`${this.name}: ${AddProductPriceSellerColumn1791000000652.MARKETPLACE_TICK} has run here, so the columns are the marketplace's too and stay.`
				)
			);
			return;
		}

		const quote = dialect === 'mysql' ? '`' : '"';

		for (const column of [...AddProductPriceSellerColumn1791000000652.COLUMNS].reverse()) {
			if (await queryRunner.hasColumn(table, column.name)) {
				await queryRunner.query(
					`ALTER TABLE ${quote}${table}${quote} DROP COLUMN ${quote}${column.name}${quote}`
				);
			}
		}
	}

	/**
	 * Whether the marketplace's amendment tick is recorded as executed on this database.
	 *
	 * @param queryRunner The runner the migration is executing on.
	 */
	private async marketplaceTickHasRun(queryRunner: QueryRunner): Promise<boolean> {
		const migrations = queryRunner.connection.options.migrationsTableName ?? 'migrations';

		if (!(await queryRunner.hasTable(migrations))) {
			return false;
		}

		const quote = (queryRunner.connection.options.type as DatabaseTypeEnum) === DatabaseTypeEnum.mysql ? '`' : '"';
		const placeholder =
			(queryRunner.connection.options.type as DatabaseTypeEnum) === DatabaseTypeEnum.postgres ? '$1' : '?';
		const rows = await queryRunner.query(
			`SELECT 1 FROM ${quote}${migrations}${quote} WHERE ${quote}name${quote} = ${placeholder}`,
			[AddProductPriceSellerColumn1791000000652.MARKETPLACE_TICK]
		);

		return Array.isArray(rows) && rows.length > 0;
	}
}
