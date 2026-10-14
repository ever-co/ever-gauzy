import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * Puts the null folds back into the seller-extended price tier index (review R5-13).
 *
 * ## Why
 *
 * `CreatePricingTables1791000000120` keys a live price tier on its variant, its currency and three nullable members
 * folded to a sentinel: `COALESCE(priceListId, nil-uuid)`, `COALESCE(minQuantity, -1)`, `COALESCE(maxQuantity, -1)`
 * on PostgreSQL and SQLite, and the stored keys `priceListKey`, `minQuantityKey`, `maxQuantityKey` on MySQL. The
 * folds are the point of the index: none of the three databases compares two NULLs equal inside a unique index, so a
 * base price — no list, no quantity bounds, the ordinary row — escapes an unfolded tuple, and the same tier can be
 * written twice. Which of the two a reader then resolves depends on row order.
 *
 * `AddMarketplaceAmendmentColumns1791000000435` added `sellerId` to the tuple by rebuilding the index over the **raw**
 * columns on PostgreSQL and SQLite, so every fold was dropped, and over the raw `sellerId` on MySQL, so a platform
 * price (no seller) escaped there. The service's `assertTierIsFree` still refuses a duplicate it can see, but two
 * concurrent or bulk writes are exactly what an index exists to stop. That migration has run on installations, so it
 * is not edited; this one replaces the index it built.
 *
 * ## What
 *
 * - PostgreSQL and SQLite: `UQ_price_tier` over `variantId`, `currency`, `COALESCE(sellerId, nil-uuid)` and the
 *   pricing set's three folds, for live rows — a platform row (no seller) is one tier, each seller's another.
 * - MySQL: a `sellerKey` generated column (`IFNULL(sellerId, nil-uuid)`) and the index over it and the pricing set's
 *   keys. It is **VIRTUAL**, not STORED: `FK_product_price_seller` releases (`ON DELETE SET NULL`) and MySQL refuses a
 *   releasing or cascading foreign key on a base column of a STORED generated column (`1215`); InnoDB indexes a
 *   VIRTUAL column like any other.
 *
 * Before the index is replaced, the live rows are checked for tiers the folded index would refuse. A duplicate that
 * already exists is a decision about which price is the real one, and that is not a migration's to make: the run
 * stops and names how many tiers collide, so they can be resolved and the migration run again.
 *
 * ## Down
 *
 * Restores the index exactly as `1791000000435` built it (and drops `sellerKey` on MySQL), so that reverting this
 * migration alone returns the schema to the state before it; `1791000000435`'s own down then puts back the pricing
 * set's folded tuple.
 */
export class FoldPriceTierNullKeys1791000000437 implements MigrationInterface {
	name = 'FoldPriceTierNullKeys1791000000437';

	/** The sentinel a null key part is folded to, as the pricing set folds `priceListId`. */
	private static readonly NIL = '00000000-0000-0000-0000-000000000000';

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
		await this.foldFilteredTuple(queryRunner);
	}

	/**
	 * SqliteDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.restoreFilteredTuple(queryRunner);
	}

	/**
	 * PostgresDB Up Migration
	 *
	 * @param queryRunner
	 */
	public async postgresUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.foldFilteredTuple(queryRunner);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.restoreFilteredTuple(queryRunner);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		if (!(await this.applies(queryRunner))) {
			return;
		}

		if (!(await queryRunner.hasColumn('product_price', 'sellerKey'))) {
			await queryRunner.query(
				`ALTER TABLE \`product_price\` ADD COLUMN \`sellerKey\` varchar(36) GENERATED ALWAYS AS (IFNULL(\`sellerId\`, '${FoldPriceTierNullKeys1791000000437.NIL}')) VIRTUAL`
			);
		}

		await this.assertNoCollidingTiers(
			queryRunner,
			`SELECT COUNT(*) AS \`n\` FROM (SELECT 1 FROM \`product_price\` WHERE \`deletedAt\` IS NULL GROUP BY \`variantId\`, \`currency\`, \`sellerKey\`, \`priceListKey\`, \`minQuantityKey\`, \`maxQuantityKey\` HAVING COUNT(*) > 1) \`colliding\``
		);

		await this.dropTierIndex(queryRunner, 'DROP INDEX `UQ_price_tier` ON `product_price`');
		await queryRunner.query(
			'CREATE UNIQUE INDEX `UQ_price_tier` ON `product_price` (`variantId`, `currency`, `sellerKey`, `priceListKey`, `minQuantityKey`, `maxQuantityKey`, `deletedKey`)'
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		if (!(await this.applies(queryRunner))) {
			return;
		}

		await this.dropTierIndex(queryRunner, 'DROP INDEX `UQ_price_tier` ON `product_price`');
		await queryRunner.query(
			'CREATE UNIQUE INDEX `UQ_price_tier` ON `product_price` (`variantId`, `currency`, `sellerId`, `priceListKey`, `minQuantityKey`, `maxQuantityKey`, `deletedKey`)'
		);

		if (await queryRunner.hasColumn('product_price', 'sellerKey')) {
			await queryRunner.query('ALTER TABLE `product_price` DROP COLUMN `sellerKey`');
		}
	}

	/**
	 * Rebuilds the filtered tuple with every nullable member folded (PostgreSQL and SQLite).
	 *
	 * @param queryRunner The runner the migration is executing on.
	 */
	private async foldFilteredTuple(queryRunner: QueryRunner): Promise<void> {
		if (!(await this.applies(queryRunner))) {
			return;
		}

		const nil = FoldPriceTierNullKeys1791000000437.NIL;
		const folded = `"variantId", "currency", COALESCE("sellerId", '${nil}'), COALESCE("priceListId", '${nil}'), COALESCE("minQuantity", -1), COALESCE("maxQuantity", -1)`;

		await this.assertNoCollidingTiers(
			queryRunner,
			`SELECT COUNT(*) AS "n" FROM (SELECT 1 FROM "product_price" WHERE "deletedAt" IS NULL GROUP BY ${folded} HAVING COUNT(*) > 1) "colliding"`
		);

		await this.dropTierIndex(queryRunner, 'DROP INDEX IF EXISTS "UQ_price_tier"');
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_price_tier" ON "product_price" (${folded}) WHERE "deletedAt" IS NULL`
		);
	}

	/**
	 * Puts back the filtered tuple `1791000000435` built (PostgreSQL and SQLite).
	 *
	 * @param queryRunner The runner the migration is executing on.
	 */
	private async restoreFilteredTuple(queryRunner: QueryRunner): Promise<void> {
		if (!(await this.applies(queryRunner))) {
			return;
		}

		await this.dropTierIndex(queryRunner, 'DROP INDEX IF EXISTS "UQ_price_tier"');
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_price_tier" ON "product_price" ("variantId", "currency", "sellerId", "priceListId", "minQuantity", "maxQuantity") WHERE "deletedAt" IS NULL`
		);
	}

	/**
	 * Whether there is a seller-extended tuple to fold: the price table, with the marketplace's `sellerId`.
	 *
	 * @param queryRunner The runner the migration is executing on.
	 */
	private async applies(queryRunner: QueryRunner): Promise<boolean> {
		return (
			(await queryRunner.hasTable('product_price')) && (await queryRunner.hasColumn('product_price', 'sellerId'))
		);
	}

	/**
	 * Stops the run when live rows already hold a tier twice, naming how many tiers collide.
	 *
	 * @param queryRunner The runner the migration is executing on.
	 * @param countSql The dialect's count of colliding tiers.
	 * @throws Error When any tier collides.
	 */
	private async assertNoCollidingTiers(queryRunner: QueryRunner, countSql: string): Promise<void> {
		const colliding = Number((await queryRunner.query(countSql))?.[0]?.n ?? 0);

		if (colliding > 0) {
			throw new Error(
				`${this.name}: ${colliding} price tier(s) are held by more than one live product_price row (same variant, ` +
					`currency, seller, list and quantity band). Which of them is the real price is not a migration's call: ` +
					`soft-delete or correct the extra rows, then run the migrations again.`
			);
		}
	}

	/**
	 * Drops the tier index, tolerating its absence.
	 *
	 * @param queryRunner The runner the migration is executing on.
	 * @param statement The dialect's own `DROP INDEX`.
	 */
	private async dropTierIndex(queryRunner: QueryRunner, statement: string): Promise<void> {
		try {
			await queryRunner.query(statement);
		} catch {
			// An index that is not there is the state this method is trying to reach.
		}
	}
}
