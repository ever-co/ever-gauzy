import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * States that one cart becomes at most one placed order (R3-10).
 *
 * ## Why
 *
 * `1791000000220-CreateOrderTables` indexes `order.cartId` as `IDX_order_cart`, which is not unique, so
 * the database accepted two live orders naming the same cart — and two concurrent completions of one cart
 * produced exactly that. The cart package now claims the cart before the order is created; this tick is
 * the database's own statement of the same rule behind it, so an order written by any path (a retry that
 * outlived its claim, an import, a manual correction) cannot be a second placed order of a cart either.
 *
 * ## Which orders it covers: the placed ones
 *
 * An order is created `DRAFT` and placed afterwards (lines, delivery, addresses, then `place`). A checkout
 * that fails between the two leaves its `DRAFT` behind, and a checkout that fails before placement is
 * meant to cancel its draft. Counting either would make that cart impossible to buy again: every retry's
 * insert would collide with the leftover. So the rule covers the live orders that are neither `DRAFT` nor
 * `CANCELED` — and a second completion is still refused by the database, at the placement that would make
 * its draft the cart's second placed order.
 *
 * ## What it does
 *
 * **`UQ_order_cart`** — on Postgres and SQLite a partial unique index over `cartId`
 * (`WHERE "cartId" IS NOT NULL AND "deletedAt" IS NULL AND "status" NOT IN ('DRAFT','CANCELED')`). MySQL has
 * no partial index, so the same predicate is a **virtual generated column**, `placedCartKey` — the cart id
 * when the order is a live placed order of a cart, otherwise `NULL` — and the unique index covers it; MySQL's
 * own rule that a unique index never compares two `NULL`s exempts every other order. `IDX_order_cart` is
 * left exactly where it is: this tick adds, it does not replace.
 *
 * ## Fail-safe: existing duplicates are reported, never deleted
 *
 * An installation that already holds two placed live orders of one cart cannot be given the index, and
 * those orders are commercial records a migration has no business choosing between. The tick therefore
 * probes for duplicates first; where there are any it **creates nothing, changes no row** and logs which
 * carts are affected and how to finish the job once a person has resolved them. The cart's claim still
 * stops every new duplicate on such an installation. The migration does not fail, because a boot that
 * cannot complete over a data question nobody has answered yet is worse than the index arriving later.
 *
 * Every statement is guarded: the index (and MySQL's column) is created only where the catalogue does not
 * already carry it and dropped only where it does, so a re-run, or a replay onto a restored snapshot,
 * changes nothing. `down` drops exactly what this tick creates.
 */
export class AddOrderCartUniqueIndex1791000000782 implements MigrationInterface {
	name = 'AddOrderCartUniqueIndex1791000000782';

	/** The index this tick creates. */
	private static readonly INDEX = 'UQ_order_cart';

	/** The table it is created on. */
	private static readonly TABLE = 'order';

	/** MySQL's generated column the index covers there. */
	private static readonly MYSQL_KEY = 'placedCartKey';

	/** How many affected carts the duplicate report names, so a large one stays readable. */
	private static readonly REPORT_LIMIT = 20;

	/** The rule, in the Postgres/SQLite form: the live placed orders of a cart. */
	private static readonly PLACED = `"cartId" IS NOT NULL AND "deletedAt" IS NULL AND "status" NOT IN ('DRAFT', 'CANCELED')`;

	/** The rule, in MySQL's form. */
	private static readonly MYSQL_PLACED =
		"`cartId` IS NOT NULL AND `deletedAt` IS NULL AND `status` NOT IN ('DRAFT', 'CANCELED')";

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
		await this.addIndex(queryRunner, DatabaseTypeEnum.postgres, [this.partialIndexStatement()]);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.dropIndex(queryRunner, DatabaseTypeEnum.postgres, `DROP INDEX IF EXISTS "UQ_order_cart"`);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.addIndex(queryRunner, DatabaseTypeEnum.sqlite, [this.partialIndexStatement()]);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.dropIndex(queryRunner, DatabaseTypeEnum.sqlite, `DROP INDEX IF EXISTS "UQ_order_cart"`);
	}

	/**
	 * MySQL Up Migration
	 *
	 * The generated column is virtual, so adding it rewrites no row; the unique index over it is what holds
	 * the rule. A column left behind by an earlier, interrupted run is reused rather than added twice.
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		const key = AddOrderCartUniqueIndex1791000000782.MYSQL_KEY;
		const statements: string[] = [];

		if (!(await queryRunner.hasColumn(AddOrderCartUniqueIndex1791000000782.TABLE, key))) {
			statements.push(
				`ALTER TABLE \`order\` ADD COLUMN \`${key}\` varchar(36) GENERATED ALWAYS AS (IF(${AddOrderCartUniqueIndex1791000000782.MYSQL_PLACED}, \`cartId\`, NULL)) VIRTUAL`
			);
		}

		statements.push(`CREATE UNIQUE INDEX \`UQ_order_cart\` ON \`order\` (\`${key}\`)`);

		await this.addIndex(queryRunner, DatabaseTypeEnum.mysql, statements);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.dropIndex(queryRunner, DatabaseTypeEnum.mysql, 'DROP INDEX `UQ_order_cart` ON `order`');

		if (
			(await queryRunner.hasTable(AddOrderCartUniqueIndex1791000000782.TABLE)) &&
			(await queryRunner.hasColumn(
				AddOrderCartUniqueIndex1791000000782.TABLE,
				AddOrderCartUniqueIndex1791000000782.MYSQL_KEY
			))
		) {
			await queryRunner.query(
				`ALTER TABLE \`order\` DROP COLUMN \`${AddOrderCartUniqueIndex1791000000782.MYSQL_KEY}\``
			);
		}
	}

	/**
	 * The partial unique index, in the form Postgres and SQLite share.
	 *
	 * @returns The statement.
	 */
	private partialIndexStatement(): string {
		return `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_order_cart" ON "order" ("cartId") WHERE ${AddOrderCartUniqueIndex1791000000782.PLACED}`;
	}

	/**
	 * The query for the carts that more than one live placed order names — the rows the index would refuse.
	 *
	 * @param dialect The dialect whose quoting is used.
	 * @returns The query.
	 */
	private duplicatesQuery(dialect: DatabaseTypeEnum): string {
		return dialect === DatabaseTypeEnum.mysql
			? `SELECT \`cartId\` FROM \`order\` WHERE ${AddOrderCartUniqueIndex1791000000782.MYSQL_PLACED} GROUP BY \`cartId\` HAVING COUNT(*) > 1`
			: `SELECT "cartId" FROM "order" WHERE ${AddOrderCartUniqueIndex1791000000782.PLACED} GROUP BY "cartId" HAVING COUNT(*) > 1`;
	}

	/**
	 * Creates the unique index, unless it is already there or the rows would violate it.
	 *
	 * @param queryRunner
	 * @param dialect The dialect whose catalogue is probed.
	 * @param statements The dialect's own statements, in order, that create the index.
	 */
	private async addIndex(queryRunner: QueryRunner, dialect: DatabaseTypeEnum, statements: string[]): Promise<void> {
		if (!(await queryRunner.hasTable(AddOrderCartUniqueIndex1791000000782.TABLE))) {
			return;
		}

		if (await this.indexExists(queryRunner, dialect)) {
			return;
		}

		const rows: unknown = await queryRunner.query(this.duplicatesQuery(dialect));
		const affected = Array.isArray(rows) ? rows.map((row: any) => String(row?.cartId ?? row?.cartid ?? '')) : [];

		if (affected.length > 0) {
			const named = affected.slice(0, AddOrderCartUniqueIndex1791000000782.REPORT_LIMIT).join(', ');
			const more =
				affected.length > AddOrderCartUniqueIndex1791000000782.REPORT_LIMIT
					? ` (and ${affected.length - AddOrderCartUniqueIndex1791000000782.REPORT_LIMIT} more)`
					: '';

			console.warn(
				chalk.red(
					`${this.name}: ${affected.length} cart(s) are named by more than one live placed order, so ` +
						`${AddOrderCartUniqueIndex1791000000782.INDEX} was NOT created and no row was changed: ${named}${more}. ` +
						'The cart checkout claim still prevents new duplicates. Once a person has resolved these orders ' +
						'(cancel or soft-delete the extra one of each cart), create the index with the statements this ' +
						`migration issues: ${statements.join('; ')}`
				)
			);

			return;
		}

		for (const statement of statements) {
			await queryRunner.query(statement);
		}
	}

	/**
	 * Drops the unique index, when it is present.
	 *
	 * @param queryRunner
	 * @param dialect The dialect whose catalogue is probed.
	 * @param statement The dialect's own `DROP INDEX`.
	 */
	private async dropIndex(queryRunner: QueryRunner, dialect: DatabaseTypeEnum, statement: string): Promise<void> {
		if (!(await queryRunner.hasTable(AddOrderCartUniqueIndex1791000000782.TABLE))) {
			return;
		}

		if (!(await this.indexExists(queryRunner, dialect))) {
			return;
		}

		await queryRunner.query(statement);
	}

	/**
	 * Whether the dialect's catalogue already carries the index.
	 *
	 * @param queryRunner
	 * @param dialect The dialect whose catalogue is read.
	 * @returns True when the index exists.
	 */
	private async indexExists(queryRunner: QueryRunner, dialect: DatabaseTypeEnum): Promise<boolean> {
		const name = AddOrderCartUniqueIndex1791000000782.INDEX;
		let rows: unknown;

		if (dialect === DatabaseTypeEnum.mysql) {
			rows = await queryRunner.query(
				`SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ? LIMIT 1`,
				[AddOrderCartUniqueIndex1791000000782.TABLE, name]
			);
		} else if (dialect === DatabaseTypeEnum.sqlite) {
			rows = await queryRunner.query(`SELECT 1 FROM sqlite_master WHERE type = 'index' AND name = ? LIMIT 1`, [
				name
			]);
		} else {
			rows = await queryRunner.query(`SELECT 1 FROM pg_indexes WHERE indexname = $1 LIMIT 1`, [name]);
		}

		return Array.isArray(rows) && rows.length > 0;
	}
}
