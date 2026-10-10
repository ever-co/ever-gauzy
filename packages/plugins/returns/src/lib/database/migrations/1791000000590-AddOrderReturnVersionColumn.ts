import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * Gives a return the version its writes are predicated on.
 *
 * ## Why the column exists
 *
 * A return is read, reasoned about and written back by two people at once — a warehouse clerk
 * receiving a delivery while an operator refunds the return — and until now the second write won and
 * the first one's change was gone with nobody told. The column below is the counter that makes the
 * comparison possible: every write of the header is stated as one statement,
 * `UPDATE "order_return" SET … , "version" = :next WHERE "id" = :id AND "version" = :expected`, so a
 * version that moved on between the caller's read and its write matches no row and the write is
 * refused rather than applied.
 *
 * ## Backfill
 *
 * Nothing to backfill. The column is `int NOT NULL DEFAULT 1`, so every existing row is given the
 * value the entity declares and the first recorded write moves it to 2. A row created before this
 * tick and one created after it are therefore indistinguishable in what they mean, which is what
 * makes the counter safe to adopt on a table that already holds rows.
 *
 * ## No index
 *
 * The column is deliberately not indexed. Every write of the header is a primary-key lookup narrowed
 * by the version — the planner reaches the row through `PK_order_return_id` and checks the version on
 * the row it found — and nothing in the domain reads a return by its version, so an index would be
 * written on every transition and read by nothing. The platform's other version columns
 * (`warehouse_product_variant.version`, `fulfillment.version`, `purchase_order.version`) are
 * unindexed for the same reason.
 *
 * ## Dialects
 *
 * All three dialects add one defaulted column, so each states its own `ALTER TABLE`: the quoting and
 * the default's form differ, and a statement written for one dialect does not run on another. Each
 * step probes for the table and the column first, because a migration runs inside the platform's
 * retry wrapper and a tick that throws on the second attempt is a set that can never record itself —
 * which shows up as a boot that never finishes rather than as a message. The down migration reverses
 * the one statement, under the same probes, so a partially applied tick reverts cleanly.
 */
export class AddOrderReturnVersionColumn1791000000590 implements MigrationInterface {
	name = 'AddOrderReturnVersionColumn1791000000590';

	/** The table this tick extends. */
	private static readonly TABLE = 'order_return';

	/** The column this tick adds. */
	private static readonly COLUMN = 'version';

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
		await this.addVersionColumn(
			queryRunner,
			`ALTER TABLE "order_return" ADD COLUMN "version" int NOT NULL DEFAULT (1)`
		);
	}

	/**
	 * SqliteDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.dropVersionColumn(queryRunner, `ALTER TABLE "order_return" DROP COLUMN "version"`);
	}

	/**
	 * PostgresDB Up Migration
	 *
	 * @param queryRunner
	 */
	public async postgresUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.addVersionColumn(queryRunner, `ALTER TABLE "order_return" ADD COLUMN "version" int NOT NULL DEFAULT 1`);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.dropVersionColumn(queryRunner, `ALTER TABLE "order_return" DROP COLUMN "version"`);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.addVersionColumn(
			queryRunner,
			`ALTER TABLE \`order_return\` ADD COLUMN \`version\` int NOT NULL DEFAULT 1`
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.dropVersionColumn(queryRunner, `ALTER TABLE \`order_return\` DROP COLUMN \`version\``);
	}

	/**
	 * Adds the version column, when the table is there and the column is not.
	 *
	 * @param queryRunner The runner the migration is executing on.
	 * @param statement The dialect's own `ALTER TABLE … ADD COLUMN`.
	 */
	private async addVersionColumn(queryRunner: QueryRunner, statement: string): Promise<void> {
		const table = AddOrderReturnVersionColumn1791000000590.TABLE;

		if (!(await queryRunner.hasTable(table))) return;
		if (await queryRunner.hasColumn(table, AddOrderReturnVersionColumn1791000000590.COLUMN)) return;

		await queryRunner.query(statement);
		console.log(chalk.yellow(`${this.name}: added order_return.version.`));
	}

	/**
	 * Drops the version column, when it is there.
	 *
	 * @param queryRunner The runner the migration is executing on.
	 * @param statement The dialect's own `ALTER TABLE … DROP COLUMN`.
	 */
	private async dropVersionColumn(queryRunner: QueryRunner, statement: string): Promise<void> {
		const table = AddOrderReturnVersionColumn1791000000590.TABLE;

		if (!(await queryRunner.hasTable(table))) return;
		if (!(await queryRunner.hasColumn(table, AddOrderReturnVersionColumn1791000000590.COLUMN))) return;

		await queryRunner.query(statement);
		console.log(chalk.yellow(`${this.name}: dropped order_return.version.`));
	}
}
