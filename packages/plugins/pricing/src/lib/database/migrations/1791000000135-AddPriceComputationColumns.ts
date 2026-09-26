import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * Lets a price row say **how** it computes, and lets it be scoped to something other than a variant.
 *
 * Two changes, and they belong together because each one is only usable with the other:
 *
 * 1. **The arithmetic.** `computeMode` says whether the row's `amount` *is* the price or whether the
 *    price is **derived**, and a derived row states the base it starts from (`baseSource`, and
 *    `basePriceListId` when that base is another list), the signed share it applies (`percent` — a
 *    negative share being a cost-plus markup) and, optionally, the price ending it is quantised to
 *    (`roundTo`). A price book ("distributor = list − 25 %") is therefore one row rather than N × M
 *    materialised rows re-derived by hand on every base change, and a base correction propagates
 *    instead of leaving every derived list stale.
 * 2. **The scope.** `variantId` becomes **nullable**. A null variant is not "unset": it makes the row
 *    *open-scoped*, so its applicability is exactly its `rule` rows with `ownerType = PRICE` and it
 *    prices every variant those rules select — one row for a category, a tag or a collection, instead
 *    of one row per variant in it.
 *
 * `amount` becomes nullable with them, because a derived row stores no amount: it has one, but the
 * number is what its base and its share compute to, and storing a copy would be a second answer that
 * goes stale the moment the base moves. The three check constraints below state that pairing on the
 * dialects that have them, and the service states it on all three.
 * **Why this timestamp.** This package's shipped set occupies `1791000000120` and `1791000000130`
 * inside the pricing sub-range, and a migration's timestamp is frozen once it has shipped. The
 * revision therefore takes the **next free tick of this package's own sub-range**, `1791000000135`,
 * which places it after both shipped files, as intended.
 *
 * **`unitId` carries no foreign key, deliberately.** Its target is `unit`, which belongs to the
 * kernel's measurement set: the programme's rule is that a constraint is added by the set that owns
 * its target, and this package must not constrain a table it does not create. The column is therefore
 * a plain uuid, exactly as the purchasing set leaves its own document-line units. `basePriceListId`
 * is a different case and **is** constrained here, on the dialects that accept adding a constraint to
 * an existing table: `price_list` is created by this package's own set, at an earlier tick, so this
 * is the set that owns the target.
 *
 * **SQLite needs a rebuild for exactly one thing.** Adding a nullable column is an in-place operation
 * on every dialect, but dropping `NOT NULL` from `variantId` is not: SQLite has no `ALTER COLUMN`, so
 * the table is rebuilt from its own recorded definition, its rows copied across by name, and its
 * **indexes replayed from the definitions read before the rebuild** — a rebuilt table loses them
 * silently, and nothing about the result looks wrong until a query slows down or a duplicate gets in.
 * The inverse puts `NOT NULL` back and replays the same indexes.
 */
export class AddPriceComputationColumns1791000000135 implements MigrationInterface {
	name = 'AddPriceComputationColumns1791000000135';

	/** The table the revision extends. */
	private static readonly PRICE_TABLE = 'product_price';

	/** The unique business key of a price row, which a rebuild must not lose. */
	private static readonly TIER_INDEX = 'UQ_price_tier';

	/** The foreign key that makes a base list a real relationship rather than a number. */
	private static readonly BASE_LIST_FOREIGN_KEY = 'FK_product_price_base_list';

	/** The suffix the SQLite rebuild gives the replacement table while it is being filled. */
	private static readonly REBUILD_SUFFIX = '_1791000000135_rebuild';

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
		if (!(await queryRunner.hasTable(AddPriceComputationColumns1791000000135.PRICE_TABLE))) {
			return;
		}

		await this.addComputationColumns(queryRunner, 'postgres');
		await this.relaxVariant(queryRunner, 'postgres');
		await this.addComputationIndexes(queryRunner, 'postgres');

		// The pairing the schema states and the service enforces on every dialect. A null operand passes
		// a Postgres check, so the amount constraint that shipped with the table still holds wherever an
		// amount is present.
		await queryRunner.query(
			`ALTER TABLE "product_price" ADD CONSTRAINT "CHK_price_compute_mode_fields" CHECK (("computeMode" = 'AMOUNT' AND "amount" IS NOT NULL AND "percent" IS NULL AND "baseSource" IS NULL AND "basePriceListId" IS NULL) OR ("computeMode" = 'PERCENT_OFF' AND "amount" IS NULL AND "percent" IS NOT NULL AND "baseSource" IS NOT NULL))`
		);
		await queryRunner.query(
			`ALTER TABLE "product_price" ADD CONSTRAINT "CHK_price_percent_range" CHECK ("percent" IS NULL OR ("percent" > -1000 AND "percent" <= 100))`
		);
		await queryRunner.query(
			`ALTER TABLE "product_price" ADD CONSTRAINT "CHK_price_round_positive" CHECK ("roundTo" IS NULL OR "roundTo" > 0)`
		);
		await queryRunner.query(
			`ALTER TABLE "product_price" ADD CONSTRAINT "CHK_price_base_list_distinct" CHECK ("basePriceListId" IS NULL OR "basePriceListId" <> "priceListId")`
		);
		await queryRunner.query(
			`ALTER TABLE "product_price" ADD CONSTRAINT "FK_product_price_base_list" FOREIGN KEY ("basePriceListId") REFERENCES "price_list"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		if (!(await queryRunner.hasTable(AddPriceComputationColumns1791000000135.PRICE_TABLE))) {
			return;
		}

		await queryRunner.query(
			`ALTER TABLE "product_price" DROP CONSTRAINT "FK_product_price_base_list"`
		);
		await queryRunner.query(`ALTER TABLE "product_price" DROP CONSTRAINT "CHK_price_base_list_distinct"`);
		await queryRunner.query(`ALTER TABLE "product_price" DROP CONSTRAINT "CHK_price_round_positive"`);
		await queryRunner.query(`ALTER TABLE "product_price" DROP CONSTRAINT "CHK_price_percent_range"`);
		await queryRunner.query(`ALTER TABLE "product_price" DROP CONSTRAINT "CHK_price_compute_mode_fields"`);

		await this.removeComputationIndexes(queryRunner, 'postgres');
		await this.restoreVariant(queryRunner, 'postgres');
		await this.removeComputationColumns(queryRunner, 'postgres');
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * The table is rebuilt once, for the nullability of `variantId` alone: every column this file adds
	 * is nullable or carries a constant default, which SQLite adds in place. The rebuild reads the
	 * table's own definition and its indexes rather than restating them, so this file cannot drift from
	 * the shape the shipped migration created.
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		if (!(await queryRunner.hasTable(AddPriceComputationColumns1791000000135.PRICE_TABLE))) {
			return;
		}

		await this.addComputationColumns(queryRunner, 'sqlite');

		// Both relaxations are `NOT NULL` removals, which is the one change SQLite has no `ALTER TABLE`
		// for at all — so the table is rebuilt once, and the rebuild is also what carries every existing
		// row across by name.
		await queryRunner.query('PRAGMA foreign_keys = OFF');
		await this.rebuildSqliteTable(queryRunner, (definition) =>
			this.makeSqliteColumnNullable(this.makeSqliteColumnNullable(definition, 'variantId'), 'amount')
		);
		await queryRunner.query('PRAGMA foreign_keys = ON');

		await this.addComputationIndexes(queryRunner, 'sqlite');
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		if (!(await queryRunner.hasTable(AddPriceComputationColumns1791000000135.PRICE_TABLE))) {
			return;
		}

		await this.removeComputationIndexes(queryRunner, 'sqlite');
		await this.removeComputationColumns(queryRunner, 'sqlite');

		// The nullability is restored last, once the columns that could hold an open-scoped or derived
		// row are gone: the rebuild would fail loudly on such a row, which is the right answer to a
		// rollback that would have to discard one.
		await queryRunner.query('PRAGMA foreign_keys = OFF');
		await this.rebuildSqliteTable(queryRunner, (definition) =>
			this.makeSqliteColumnRequired(this.makeSqliteColumnRequired(definition, 'variantId'), 'amount')
		);
		await queryRunner.query('PRAGMA foreign_keys = ON');
	}

	/**
	 * MySQL Up Migration
	 *
	 * MySQL has no partial indexes, so the business key that shipped with the table is left exactly as
	 * it is: a null `variantId` already makes an open row's tuple distinct on this dialect, which is
	 * the same property the partial predicate provides on the other two.
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		if (!(await queryRunner.hasTable(AddPriceComputationColumns1791000000135.PRICE_TABLE))) {
			return;
		}

		await this.addComputationColumns(queryRunner, 'mysql');
		await this.relaxVariant(queryRunner, 'mysql');
		await this.addComputationIndexes(queryRunner, 'mysql');

		await queryRunner.query(
			`ALTER TABLE \`product_price\` ADD CONSTRAINT \`CHK_price_compute_mode_fields\` CHECK ((\`computeMode\` = 'AMOUNT' AND \`amount\` IS NOT NULL AND \`percent\` IS NULL AND \`baseSource\` IS NULL AND \`basePriceListId\` IS NULL) OR (\`computeMode\` = 'PERCENT_OFF' AND \`amount\` IS NULL AND \`percent\` IS NOT NULL AND \`baseSource\` IS NOT NULL))`
		);
		await queryRunner.query(
			`ALTER TABLE \`product_price\` ADD CONSTRAINT \`CHK_price_percent_range\` CHECK (\`percent\` IS NULL OR (\`percent\` > -1000 AND \`percent\` <= 100))`
		);
		await queryRunner.query(
			`ALTER TABLE \`product_price\` ADD CONSTRAINT \`CHK_price_round_positive\` CHECK (\`roundTo\` IS NULL OR \`roundTo\` > 0)`
		);
		await queryRunner.query(
			`ALTER TABLE \`product_price\` ADD CONSTRAINT \`CHK_price_base_list_distinct\` CHECK (\`basePriceListId\` IS NULL OR \`basePriceListId\` <> \`priceListId\`)`
		);
		await queryRunner.query(
			`ALTER TABLE \`product_price\` ADD CONSTRAINT \`FK_product_price_base_list\` FOREIGN KEY (\`basePriceListId\`) REFERENCES \`price_list\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		if (!(await queryRunner.hasTable(AddPriceComputationColumns1791000000135.PRICE_TABLE))) {
			return;
		}

		await queryRunner.query(`ALTER TABLE \`product_price\` DROP FOREIGN KEY \`FK_product_price_base_list\``);
		await queryRunner.query(`ALTER TABLE \`product_price\` DROP CONSTRAINT \`CHK_price_base_list_distinct\``);
		await queryRunner.query(`ALTER TABLE \`product_price\` DROP CONSTRAINT \`CHK_price_round_positive\``);
		await queryRunner.query(`ALTER TABLE \`product_price\` DROP CONSTRAINT \`CHK_price_percent_range\``);
		await queryRunner.query(`ALTER TABLE \`product_price\` DROP CONSTRAINT \`CHK_price_compute_mode_fields\``);

		await this.removeComputationIndexes(queryRunner, 'mysql');
		await this.restoreVariant(queryRunner, 'mysql');
		await this.removeComputationColumns(queryRunner, 'mysql');
	}

	/*
	|--------------------------------------------------------------------------
	| The columns
	|--------------------------------------------------------------------------
	*/

	/**
	 * Adds the computation columns and relaxes `amount`, each addition guarded so a second run of this
	 * file adds nothing.
	 *
	 * @param queryRunner The query runner.
	 * @param dialect The dialect being migrated.
	 */
	private async addComputationColumns(
		queryRunner: QueryRunner,
		dialect: 'postgres' | 'mysql' | 'sqlite'
	): Promise<void> {
		const table = AddPriceComputationColumns1791000000135.PRICE_TABLE;

		if (dialect === 'postgres') {
			if (!(await queryRunner.hasColumn(table, 'computeMode'))) {
				await queryRunner.query(
					`ALTER TABLE "product_price" ADD COLUMN "computeMode" character varying(16) NOT NULL DEFAULT 'AMOUNT'`
				);
			}
			if (!(await queryRunner.hasColumn(table, 'percent'))) {
				await queryRunner.query(`ALTER TABLE "product_price" ADD COLUMN "percent" numeric(9,6)`);
			}
			if (!(await queryRunner.hasColumn(table, 'baseSource'))) {
				await queryRunner.query(`ALTER TABLE "product_price" ADD COLUMN "baseSource" character varying(16)`);
			}
			if (!(await queryRunner.hasColumn(table, 'basePriceListId'))) {
				await queryRunner.query(`ALTER TABLE "product_price" ADD COLUMN "basePriceListId" uuid`);
			}
			if (!(await queryRunner.hasColumn(table, 'roundTo'))) {
				await queryRunner.query(`ALTER TABLE "product_price" ADD COLUMN "roundTo" numeric(20,6)`);
			}
			if (!(await queryRunner.hasColumn(table, 'unitId'))) {
				await queryRunner.query(`ALTER TABLE "product_price" ADD COLUMN "unitId" uuid`);
			}

			return;
		}

		if (dialect === 'mysql') {
			if (!(await queryRunner.hasColumn(table, 'computeMode'))) {
				await queryRunner.query(
					`ALTER TABLE \`product_price\` ADD COLUMN \`computeMode\` varchar(16) NOT NULL DEFAULT 'AMOUNT'`
				);
			}
			if (!(await queryRunner.hasColumn(table, 'percent'))) {
				await queryRunner.query(`ALTER TABLE \`product_price\` ADD COLUMN \`percent\` decimal(9,6) NULL`);
			}
			if (!(await queryRunner.hasColumn(table, 'baseSource'))) {
				await queryRunner.query(`ALTER TABLE \`product_price\` ADD COLUMN \`baseSource\` varchar(16) NULL`);
			}
			if (!(await queryRunner.hasColumn(table, 'basePriceListId'))) {
				await queryRunner.query(
					`ALTER TABLE \`product_price\` ADD COLUMN \`basePriceListId\` varchar(36) NULL`
				);
			}
			if (!(await queryRunner.hasColumn(table, 'roundTo'))) {
				await queryRunner.query(`ALTER TABLE \`product_price\` ADD COLUMN \`roundTo\` decimal(20,6) NULL`);
			}
			if (!(await queryRunner.hasColumn(table, 'unitId'))) {
				await queryRunner.query(`ALTER TABLE \`product_price\` ADD COLUMN \`unitId\` varchar(36) NULL`);
			}

			return;
		}

		if (!(await queryRunner.hasColumn(table, 'computeMode'))) {
			await queryRunner.query(
				`ALTER TABLE "product_price" ADD COLUMN "computeMode" varchar(16) NOT NULL DEFAULT ('AMOUNT')`
			);
		}
		if (!(await queryRunner.hasColumn(table, 'percent'))) {
			await queryRunner.query(`ALTER TABLE "product_price" ADD COLUMN "percent" numeric(9,6)`);
		}
		if (!(await queryRunner.hasColumn(table, 'baseSource'))) {
			await queryRunner.query(`ALTER TABLE "product_price" ADD COLUMN "baseSource" varchar(16)`);
		}
		if (!(await queryRunner.hasColumn(table, 'basePriceListId'))) {
			await queryRunner.query(`ALTER TABLE "product_price" ADD COLUMN "basePriceListId" varchar`);
		}
		if (!(await queryRunner.hasColumn(table, 'roundTo'))) {
			await queryRunner.query(`ALTER TABLE "product_price" ADD COLUMN "roundTo" numeric(20,6)`);
		}
		if (!(await queryRunner.hasColumn(table, 'unitId'))) {
			await queryRunner.query(`ALTER TABLE "product_price" ADD COLUMN "unitId" varchar`);
		}
	}

	/**
	 * Removes the computation columns, in the reverse order they were added.
	 *
	 * @param queryRunner The query runner.
	 * @param dialect The dialect being migrated.
	 */
	private async removeComputationColumns(
		queryRunner: QueryRunner,
		dialect: 'postgres' | 'mysql' | 'sqlite'
	): Promise<void> {
		const table = AddPriceComputationColumns1791000000135.PRICE_TABLE;
		const columns = ['unitId', 'roundTo', 'basePriceListId', 'baseSource', 'percent', 'computeMode'];

		for (const column of columns) {
			if (!(await queryRunner.hasColumn(table, column))) {
				continue;
			}

			if (dialect === 'mysql') {
				await queryRunner.query(`ALTER TABLE \`product_price\` DROP COLUMN \`${column}\``);
			} else {
				await queryRunner.query(`ALTER TABLE "product_price" DROP COLUMN "${column}"`);
			}
		}
	}

	/**
	 * Relaxes the two columns a derivation makes optional: `variantId`, because an open-scoped row has
	 * none, and `amount`, because a derived row stores no number.
	 *
	 * @param queryRunner The query runner.
	 * @param dialect The dialect being migrated.
	 */
	private async relaxVariant(queryRunner: QueryRunner, dialect: 'postgres' | 'mysql'): Promise<void> {
		if (dialect === 'mysql') {
			await queryRunner.query(`ALTER TABLE \`product_price\` MODIFY COLUMN \`variantId\` varchar(36) NULL`);
			await queryRunner.query(`ALTER TABLE \`product_price\` MODIFY COLUMN \`amount\` decimal(20,6) NULL`);

			return;
		}

		await queryRunner.query(`ALTER TABLE "product_price" ALTER COLUMN "variantId" DROP NOT NULL`);
		await queryRunner.query(`ALTER TABLE "product_price" ALTER COLUMN "amount" DROP NOT NULL`);
	}

	/**
	 * Puts `variantId` and `amount` back to mandatory.
	 *
	 * Refused by the database itself when an open-scoped or derived row exists: neither can be expressed
	 * by a column that requires a value, and failing loudly is the right answer to a rollback that would
	 * have to discard one.
	 *
	 * @param queryRunner The query runner.
	 * @param dialect The dialect being migrated.
	 */
	private async restoreVariant(queryRunner: QueryRunner, dialect: 'postgres' | 'mysql'): Promise<void> {
		if (dialect === 'mysql') {
			await queryRunner.query(
				`ALTER TABLE \`product_price\` MODIFY COLUMN \`variantId\` varchar(36) NOT NULL`
			);
			await queryRunner.query(
				`ALTER TABLE \`product_price\` MODIFY COLUMN \`amount\` decimal(20,6) NOT NULL`
			);

			return;
		}

		await queryRunner.query(`ALTER TABLE "product_price" ALTER COLUMN "variantId" SET NOT NULL`);
		await queryRunner.query(`ALTER TABLE "product_price" ALTER COLUMN "amount" SET NOT NULL`);
	}

	/*
	|--------------------------------------------------------------------------
	| The indexes
	|--------------------------------------------------------------------------
	*/

	/**
	 * Creates the three indexes the derivation reads.
	 *
	 * `IDX_price_base_list` is what the cycle check and the "which rows derive from this list" query
	 * read; `IDX_price_unit` is what the tier-in-its-unit read uses; and `IDX_price_open_scope` is what
	 * makes the open-scoped candidate set a range scan rather than a full one, which is the query the
	 * nullable `variantId` introduced.
	 *
	 * @param queryRunner The query runner.
	 * @param dialect The dialect being migrated.
	 */
	private async addComputationIndexes(
		queryRunner: QueryRunner,
		dialect: 'postgres' | 'mysql' | 'sqlite'
	): Promise<void> {
		if (dialect === 'mysql') {
			if (!(await this.hasIndex(queryRunner, 'IDX_price_base_list'))) {
				await queryRunner.query(
					`CREATE INDEX \`IDX_price_base_list\` ON \`product_price\` (\`basePriceListId\`)`
				);
			}
			if (!(await this.hasIndex(queryRunner, 'IDX_price_unit'))) {
				await queryRunner.query(`CREATE INDEX \`IDX_price_unit\` ON \`product_price\` (\`unitId\`)`);
			}
			if (!(await this.hasIndex(queryRunner, 'IDX_price_open_scope'))) {
				await queryRunner.query(
					`CREATE INDEX \`IDX_price_open_scope\` ON \`product_price\` (\`organizationId\`, \`currency\`, \`status\`)`
				);
			}

			return;
		}

		await queryRunner.query(
			`CREATE INDEX IF NOT EXISTS "IDX_price_base_list" ON "product_price" ("basePriceListId") WHERE "basePriceListId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX IF NOT EXISTS "IDX_price_unit" ON "product_price" ("unitId") WHERE "unitId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX IF NOT EXISTS "IDX_price_open_scope" ON "product_price" ("organizationId", "currency", "status") WHERE "variantId" IS NULL AND "deletedAt" IS NULL`
		);
	}

	/**
	 * Drops the three indexes, guarded the same way as their creation.
	 *
	 * @param queryRunner The query runner.
	 * @param dialect The dialect being migrated.
	 */
	private async removeComputationIndexes(
		queryRunner: QueryRunner,
		dialect: 'postgres' | 'mysql' | 'sqlite'
	): Promise<void> {
		if (dialect === 'mysql') {
			for (const name of ['IDX_price_open_scope', 'IDX_price_unit', 'IDX_price_base_list']) {
				if (await this.hasIndex(queryRunner, name)) {
					await queryRunner.query(`DROP INDEX \`${name}\` ON \`product_price\``);
				}
			}

			return;
		}

		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_price_open_scope"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_price_unit"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_price_base_list"`);
	}

	/**
	 * @param queryRunner The query runner.
	 * @param name The index name.
	 * @returns True when MySQL already carries an index of that name.
	 */
	private async hasIndex(queryRunner: QueryRunner, name: string): Promise<boolean> {
		const rows: Array<{ counted?: string | number }> = await queryRunner.query(
			`SELECT COUNT(*) AS counted FROM information_schema.statistics WHERE table_schema = DATABASE() AND index_name = '${name}'`
		);

		return Number(rows?.[0]?.counted ?? 0) > 0;
	}

	/*
	|--------------------------------------------------------------------------
	| The SQLite rebuild
	|--------------------------------------------------------------------------
	*/

	/**
	 * Rebuilds `product_price` from its own recorded definition.
	 *
	 * The definition is read back from `sqlite_master`, handed to the caller's transform and written as
	 * a replacement table; the rows are copied across by name, the original is dropped and the
	 * replacement takes its name. Reading the definition rather than restating it is what keeps this
	 * file from drifting away from the shape the shipped migration created.
	 *
	 * **The indexes are read before the rebuild and replayed after it, which is the part that is easy to
	 * lose.** SQLite moves a table's indexes with it when it is renamed and drops them with it when it is
	 * dropped, so a rebuilt table comes back with none at all unless they are recreated — and the
	 * business key `UQ_price_tier` is what stops two rows describing one tier, so losing it would let a
	 * duplicate in silently. The definitions are read first because a rename rewrites the table name
	 * inside them, and the replacement is built under a temporary name and renamed into place last, so
	 * no reference another table holds to the original is ever rewritten to a name about to be dropped.
	 *
	 * The transform returning its input unchanged is what makes a second run a no-op: nothing is
	 * created, nothing is copied and nothing is dropped — which matters here, because the transform is
	 * what makes the column nullable and the second run must not rebuild a table that already is.
	 *
	 * @param queryRunner The query runner.
	 * @param transform Turns the current definition into the wanted one.
	 */
	private async rebuildSqliteTable(
		queryRunner: QueryRunner,
		transform: (definition: string) => string
	): Promise<void> {
		const table = AddPriceComputationColumns1791000000135.PRICE_TABLE;
		const current = await this.readSqliteTable(queryRunner, table);

		if (!current) {
			return;
		}

		const rebuilt = transform(current.definition);

		if (!rebuilt || rebuilt === current.definition) {
			return;
		}

		const replacement = `${table}${AddPriceComputationColumns1791000000135.REBUILD_SUFFIX}`;
		const columns = current.columns.map((column) => `"${column}"`).join(', ');
		const created = rebuilt.replace(new RegExp(`^(CREATE TABLE\\s+)"?${table}"?`), `$1"${replacement}"`);

		// The name belongs to this migration, so a replacement left behind by an attempt that failed
		// half-way is discarded rather than allowed to block the retry.
		await queryRunner.query(`DROP TABLE IF EXISTS "${replacement}"`);
		await queryRunner.query(created);
		await queryRunner.query(`INSERT INTO "${replacement}" (${columns}) SELECT ${columns} FROM "${table}"`);
		await queryRunner.query(`DROP TABLE "${table}"`);
		await queryRunner.query(`ALTER TABLE "${replacement}" RENAME TO "${table}"`);

		for (const index of current.indexes) {
			await queryRunner.query(index);
		}

		console.log(chalk.gray(`Rebuilt ${table} for the price computation revision.`));
	}

	/**
	 * Reads a SQLite table's definition, its column names and the indexes defined over it.
	 *
	 * @param queryRunner The query runner.
	 * @param table The table.
	 * @returns The definition, the columns in order and the index statements, or null when the table does
	 * not exist.
	 */
	private async readSqliteTable(
		queryRunner: QueryRunner,
		table: string
	): Promise<{ definition: string; columns: string[]; indexes: string[] } | null> {
		const tables: Array<{ sql?: string }> = await queryRunner.query(
			`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?`,
			[table]
		);
		const definition = tables?.[0]?.sql;

		if (!definition) {
			return null;
		}

		const described: Array<{ name?: string }> = await queryRunner.query(`PRAGMA table_info("${table}")`);
		const indexes: Array<{ sql?: string }> = await queryRunner.query(
			`SELECT sql FROM sqlite_master WHERE type = 'index' AND tbl_name = ? AND sql IS NOT NULL`,
			[table]
		);

		return {
			definition,
			columns: (described ?? []).map((column) => String(column.name)),
			indexes: (indexes ?? []).map((index) => String(index.sql)).filter(Boolean)
		};
	}

	/**
	 * @param definition A SQLite `CREATE TABLE` statement.
	 * @param column The column whose nullability is being relaxed.
	 * @returns The statement with `NOT NULL` removed from that column, unchanged when it is already
	 * nullable.
	 */
	private makeSqliteColumnNullable(definition: string, column: string): string {
		const span = this.sqliteColumnSpan(definition, column);

		if (!span) {
			return definition;
		}

		const text = definition.slice(span.start, span.end);

		if (!/\s+NOT NULL/i.test(text)) {
			return definition;
		}

		return definition.slice(0, span.start) + text.replace(/\s+NOT NULL/i, '') + definition.slice(span.end);
	}

	/**
	 * @param definition A SQLite `CREATE TABLE` statement.
	 * @param column The column whose nullability is being restored.
	 * @returns The statement with `NOT NULL` on that column, unchanged when it already carries it.
	 */
	private makeSqliteColumnRequired(definition: string, column: string): string {
		const span = this.sqliteColumnSpan(definition, column);

		if (!span) {
			return definition;
		}

		const text = definition.slice(span.start, span.end);

		if (/\s+NOT NULL/i.test(text)) {
			return definition;
		}

		const trimmed = text.replace(/\s+$/, '');

		return definition.slice(0, span.start) + `${trimmed} NOT NULL` + definition.slice(span.end);
	}

	/**
	 * Finds where one column's own definition starts and ends inside a SQLite `CREATE TABLE` statement.
	 *
	 * A column definition may contain commas — `numeric(20,6)` is one — so the end of the definition is
	 * the next comma **at paren depth zero**, or the closing parenthesis of the column list. Reading the
	 * span this way is what keeps a transform from editing inside a type declaration, which is exactly
	 * how a naive replacement once produced `numeric(20 NOT NULL,6)`.
	 *
	 * @param definition A SQLite `CREATE TABLE` statement.
	 * @param column The column to locate.
	 * @returns The span of the column's definition, or undefined when the statement does not declare it.
	 */
	private sqliteColumnSpan(definition: string, column: string): { start: number; end: number } | undefined {
		const marker = new RegExp(`"${column}"\\s`).exec(definition);

		if (!marker) {
			return undefined;
		}

		const start = marker.index;
		let index = marker.index + marker[0].length;
		let depth = 0;

		for (; index < definition.length; index++) {
			const character = definition[index];

			if (character === '(') {
				depth++;
				continue;
			}

			if (character === ')') {
				if (depth === 0) {
					break;
				}

				depth--;
				continue;
			}

			if (depth === 0 && (character === ',' || character === '\n')) {
				break;
			}
		}

		return { start, end: index };
	}
}
