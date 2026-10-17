import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * States that one cart becomes at most one order (R3-10).
 *
 * ## Why
 *
 * `1791000000220-CreateOrderTables` indexes `order.cartId` as `IDX_order_cart`, which is not unique, so
 * the database accepted two live orders naming the same cart — and two concurrent completions of one cart
 * produced exactly that. The cart package now claims the cart before the order is created; this tick is
 * the database's own statement of the same rule behind it, so an order written by any path (a retry that
 * outlived its claim, an import, a manual correction) cannot be a second order of a cart either.
 *
 * ## What it does
 *
 * **`UQ_order_cart`** — unique over the live orders that name a cart. On Postgres and SQLite it is partial
 * (`WHERE "cartId" IS NOT NULL AND "deletedAt" IS NULL`), the form every other unique index of this set
 * takes; on MySQL, which has no partial index, it covers `(cartId, deletedKey)` — the generated column the
 * create tick gives `order` for exactly this purpose ('0' for a live row, the row's own id once it is
 * deleted) — and MySQL's own rule that a unique index never compares two `NULL`s exempts the orders that
 * name no cart. `IDX_order_cart` is left exactly where it is: this tick adds, it does not replace.
 *
 * ## Fail-safe: existing duplicates are reported, never deleted
 *
 * An installation that already holds two live orders of one cart cannot be given the index, and those
 * orders are commercial records a migration has no business choosing between. The tick therefore probes
 * for duplicates first; where there are any it **creates nothing, changes no row** and logs which carts
 * are affected and how to finish the job once a person has resolved them. The cart's claim still stops
 * every new duplicate on such an installation. The migration does not fail, because a boot that cannot
 * complete over a data question nobody has answered yet is worse than the index arriving later.
 *
 * Every statement is guarded: the index is created only where the catalogue does not already carry it and
 * dropped only where it does, so a re-run, or a replay onto a restored snapshot, changes nothing. `down`
 * drops exactly the index this tick creates.
 */
export class AddOrderCartUniqueIndex1791000000782 implements MigrationInterface {
	name = 'AddOrderCartUniqueIndex1791000000782';

	/** The index this tick creates. */
	private static readonly INDEX = 'UQ_order_cart';

	/** The table it is created on. */
	private static readonly TABLE = 'order';

	/** How many affected carts the duplicate report names, so a large one stays readable. */
	private static readonly REPORT_LIMIT = 20;

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
		await this.addIndex(
			queryRunner,
			DatabaseTypeEnum.postgres,
			`SELECT "cartId" FROM "order" WHERE "cartId" IS NOT NULL AND "deletedAt" IS NULL GROUP BY "cartId" HAVING COUNT(*) > 1`,
			`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_order_cart" ON "order" ("cartId") WHERE "cartId" IS NOT NULL AND "deletedAt" IS NULL`
		);
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
		await this.addIndex(
			queryRunner,
			DatabaseTypeEnum.sqlite,
			`SELECT "cartId" FROM "order" WHERE "cartId" IS NOT NULL AND "deletedAt" IS NULL GROUP BY "cartId" HAVING COUNT(*) > 1`,
			`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_order_cart" ON "order" ("cartId") WHERE "cartId" IS NOT NULL AND "deletedAt" IS NULL`
		);
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
	 * The unique index folds the deletion state in through `deletedKey` where the table carries it. A table
	 * whose schema the ORM synchronised has no generated column, and is given the index over `cartId` alone —
	 * a soft-deleted order then still holds its cart, which is the stricter of the two readings — with the
	 * duplicate probe counting deleted rows too, so the probe and the index always agree.
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		const folded = await queryRunner.hasColumn(AddOrderCartUniqueIndex1791000000782.TABLE, 'deletedKey');

		await this.addIndex(
			queryRunner,
			DatabaseTypeEnum.mysql,
			folded
				? 'SELECT `cartId` FROM `order` WHERE `cartId` IS NOT NULL AND `deletedAt` IS NULL GROUP BY `cartId` HAVING COUNT(*) > 1'
				: 'SELECT `cartId` FROM `order` WHERE `cartId` IS NOT NULL GROUP BY `cartId` HAVING COUNT(*) > 1',
			folded
				? 'CREATE UNIQUE INDEX `UQ_order_cart` ON `order` (`cartId`, `deletedKey`)'
				: 'CREATE UNIQUE INDEX `UQ_order_cart` ON `order` (`cartId`)'
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.dropIndex(queryRunner, DatabaseTypeEnum.mysql, 'DROP INDEX `UQ_order_cart` ON `order`');
	}

	/**
	 * Creates the unique index, unless it is already there or the rows would violate it.
	 *
	 * @param queryRunner
	 * @param dialect The dialect whose catalogue is probed.
	 * @param duplicates The dialect's query for the carts that more than one live order names.
	 * @param statement The dialect's own `CREATE UNIQUE INDEX`.
	 */
	private async addIndex(
		queryRunner: QueryRunner,
		dialect: DatabaseTypeEnum,
		duplicates: string,
		statement: string
	): Promise<void> {
		if (!(await queryRunner.hasTable(AddOrderCartUniqueIndex1791000000782.TABLE))) {
			return;
		}

		if (await this.indexExists(queryRunner, dialect)) {
			return;
		}

		const rows: unknown = await queryRunner.query(duplicates);
		const affected = Array.isArray(rows) ? rows.map((row: any) => String(row?.cartId ?? row?.cartid ?? '')) : [];

		if (affected.length > 0) {
			const named = affected.slice(0, AddOrderCartUniqueIndex1791000000782.REPORT_LIMIT).join(', ');
			const more =
				affected.length > AddOrderCartUniqueIndex1791000000782.REPORT_LIMIT
					? ` (and ${affected.length - AddOrderCartUniqueIndex1791000000782.REPORT_LIMIT} more)`
					: '';

			console.warn(
				chalk.red(
					`${this.name}: ${affected.length} cart(s) are named by more than one live order, so ` +
						`${AddOrderCartUniqueIndex1791000000782.INDEX} was NOT created and no row was changed: ${named}${more}. ` +
						'The cart checkout claim still prevents new duplicates. Once a person has resolved these orders ' +
						'(cancel or soft-delete the extra one of each cart), create the index with the statement this ' +
						`migration issues: ${statement}`
				)
			);

			return;
		}

		await queryRunner.query(statement);
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
