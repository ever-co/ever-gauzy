import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * Gives a cart the checkout claim a completion takes before it creates the order (R3-10).
 *
 * Two concurrent completions of one cart used to place two orders: the cart was marked completed only
 * after the order existed, and nothing excluded the second completion before that. A completion now
 * claims the cart first, with one conditional update predicated on the version it validated, on a
 * completable status and on `orderId IS NULL`, and records the claim in two columns:
 *
 * - `checkoutClaimId` — the id the completion claimed the cart under, which is what lets its release
 *   name its own claim and never another completion's;
 * - `checkoutClaimedAt` — when it claimed it, which is what lets a claim left behind by a process that
 *   died mid-checkout lapse instead of holding the cart forever.
 *
 * Both columns are nullable and nothing is backfilled: a cart nobody is checking out has no claim, which
 * is every existing row. No index is added — the claim is read only on the one row a completion already
 * addressed by id.
 *
 * Every statement is guarded the way the other column ticks of this set guard their own: a column is
 * added only where it is absent and dropped only where it is present, so a re-run, or a replay onto a
 * database restored from a snapshot taken after the first run, changes nothing rather than failing.
 * `down` drops exactly the two columns this tick adds; what they held is transient claim state that no
 * other row refers to.
 */
export class AddCartCheckoutClaimColumns1791000000781 implements MigrationInterface {
	name = 'AddCartCheckoutClaimColumns1791000000781';

	/** The table the claim is recorded on. */
	private static readonly TABLE = 'commerce_cart';

	/**
	 * The two columns, in the order `up` adds them, with each dialect's type.
	 *
	 * `checkoutClaimId` carries a UUID, stored as the 36-character varchar every identifier column of this
	 * set uses; `checkoutClaimedAt` is the dialect's own timestamp type, as `completedAt` beside it is.
	 */
	private static readonly COLUMNS: ReadonlyArray<{ name: string; postgres: string; sqlite: string; mysql: string }> = [
		{ name: 'checkoutClaimId', postgres: 'character varying(36)', sqlite: 'varchar(36)', mysql: 'varchar(36) NULL' },
		{ name: 'checkoutClaimedAt', postgres: 'TIMESTAMP', sqlite: 'datetime', mysql: 'datetime NULL' }
	];

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
		for (const column of AddCartCheckoutClaimColumns1791000000781.COLUMNS) {
			await this.addColumn(queryRunner, column.name, `ALTER TABLE "commerce_cart" ADD COLUMN "${column.name}" ${column.postgres}`);
		}
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		for (const column of [...AddCartCheckoutClaimColumns1791000000781.COLUMNS].reverse()) {
			await this.dropColumn(queryRunner, column.name, `ALTER TABLE "commerce_cart" DROP COLUMN "${column.name}"`);
		}
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		for (const column of AddCartCheckoutClaimColumns1791000000781.COLUMNS) {
			await this.addColumn(queryRunner, column.name, `ALTER TABLE "commerce_cart" ADD COLUMN "${column.name}" ${column.sqlite}`);
		}
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		for (const column of [...AddCartCheckoutClaimColumns1791000000781.COLUMNS].reverse()) {
			await this.dropColumn(queryRunner, column.name, `ALTER TABLE "commerce_cart" DROP COLUMN "${column.name}"`);
		}
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		for (const column of AddCartCheckoutClaimColumns1791000000781.COLUMNS) {
			await this.addColumn(queryRunner, column.name, `ALTER TABLE \`commerce_cart\` ADD COLUMN \`${column.name}\` ${column.mysql}`);
		}
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		for (const column of [...AddCartCheckoutClaimColumns1791000000781.COLUMNS].reverse()) {
			await this.dropColumn(queryRunner, column.name, `ALTER TABLE \`commerce_cart\` DROP COLUMN \`${column.name}\``);
		}
	}

	/**
	 * Adds a column, unless the cart table already carries it.
	 *
	 * @param queryRunner
	 * @param column The column's name.
	 * @param statement The dialect's own `ALTER TABLE ... ADD COLUMN`.
	 */
	private async addColumn(queryRunner: QueryRunner, column: string, statement: string): Promise<void> {
		if (await queryRunner.hasColumn(AddCartCheckoutClaimColumns1791000000781.TABLE, column)) {
			return;
		}

		await queryRunner.query(statement);
	}

	/**
	 * Drops a column, unless it is already gone.
	 *
	 * @param queryRunner
	 * @param column The column's name.
	 * @param statement The dialect's own `ALTER TABLE ... DROP COLUMN`.
	 */
	private async dropColumn(queryRunner: QueryRunner, column: string, statement: string): Promise<void> {
		if (!(await queryRunner.hasColumn(AddCartCheckoutClaimColumns1791000000781.TABLE, column))) {
			return;
		}

		await queryRunner.query(statement);
	}
}
