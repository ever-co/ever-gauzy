import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';
import { addCheckConstraint, ICheckConstraintDefinition } from '@gauzy/core';

/**
 * The columns the marketplace adds to tables it does not own, and the rules that come with them.
 *
 * ## Why one migration and not six
 *
 * Doc 20 §13.7 is the table of amendments: `adjustment.fundedBy`/`sellerId`,
 * `promotion.fundingType`/`sellerFundingShare`/`sellerId`, and a `sellerId` on `fulfillment`,
 * `order_return`, `product_price` and `warehouse`. They are one change because they are one fact —
 * *which seller is this row about* — recorded on the six tables a marketplace reads it from, and a
 * schema in which three of them carry it is a schema in which a seller-scoped question is answered
 * differently depending on which table it is asked of.
 *
 * The `sellerId` column on `warehouse` is the exception to where it is delivered, and deliberately so:
 * doc 20 §13.7 records the column and its index as delivered by the **inventory** set
 * (`1791000000436-AddWarehouseSellerColumn`), which runs before `seller` exists, and its foreign key as
 * deferred to here, which is where the target table's own set can constrain it.
 *
 * ## What each column means, and what the split reads
 *
 * - `adjustment.fundedBy` is *who bears the cost of this discount*, and it is on the ledger row rather
 *   than on the offer that produced it for a reason: the same promotion may be funded by the platform,
 *   by one seller, or split between them, and the split is two rows rather than a share column, so the
 *   audit question is answered by summing rows by funder instead of by interpreting a ratio. The rule the
 *   table states about the pair is that a row funded by a seller names one (`CHK_adjustment_funding`);
 *   `fundedBy` defaults to `PLATFORM`, which is what every row written before today means.
 * - `promotion.fundingType` and `sellerFundingShare` are the same fact at the offer, where the split's
 *   share is stated once; `promotion.sellerId` is what makes a seller-funded promotion's target set
 *   unambiguous — it may discount only that seller's lines. Two rules come with them:
 *   `CHK_promotion_funding_share` (a `SPLIT` promotion carries a share strictly between zero and one)
 *   and `CHK_promotion_seller_funding` (anything but `PLATFORM` names a seller).
 * - The four `sellerId` columns are the same scope recorded where it is read: a fulfilment belongs to
 *   the seller that shipped it, a return to the seller it is returned to, a price row to the seller who
 *   set it, and a location to the seller whose stock it holds. Each carries the index its reader asks
 *   for, and a foreign key to `seller` that releases rather than cascades — a seller is retired, never
 *   deleted, and a document that outlives it must not lose the row it points at.
 *
 * ## Backfill
 *
 * Every added column is nullable or defaulted, so existing rows are valid the moment the `ALTER`
 * returns: `fundedBy` and `fundingType` take `PLATFORM`, `sellerFundingShare` takes `0`, and every
 * `sellerId` stays null — a row written before the marketplace existed belongs to no seller, and
 * inventing one would be a statement about money nobody made.
 *
 * ## Dialects
 *
 * Every dialect adds a nullable column and creates an index, so the columns and the indexes are created
 * everywhere. What the embedded dialect cannot do is add a **constraint** to an existing table, so the
 * foreign keys and the three `CHECK`s are stated by the shared helper, which reports the embedded
 * dialect's branch as the documented no-op it is: the rules there rest on the write paths and the nightly
 * audit. The extended `UQ_price_tier` is MySQL-and-PostgreSQL only for the same reason — SQLite cannot
 * drop and recreate a unique index in place, and the price table's own set declared the tuple it has.
 */
export class AddMarketplaceAmendmentColumns1791000000435 implements MigrationInterface {
	name = 'AddMarketplaceAmendmentColumns1791000000435';

	/** The three rules this tick carries, in the form the shared helper adds them. */
	private static readonly CONSTRAINTS: readonly ICheckConstraintDefinition[] = [
		{
			table: 'adjustment',
			name: 'CHK_adjustment_funding',
			columns: ['fundedBy', 'sellerId'],
			postgres: `ALTER TABLE "adjustment" ADD CONSTRAINT "CHK_adjustment_funding" CHECK ("fundedBy" <> 'SELLER' OR "sellerId" IS NOT NULL)`,
			mysql: `ALTER TABLE \`adjustment\` ADD CONSTRAINT \`CHK_adjustment_funding\` CHECK (\`fundedBy\` <> 'SELLER' OR \`sellerId\` IS NOT NULL)`
		},
		{
			table: 'promotion',
			name: 'CHK_promotion_funding_share',
			columns: ['fundingType', 'sellerFundingShare'],
			postgres: `ALTER TABLE "promotion" ADD CONSTRAINT "CHK_promotion_funding_share" CHECK ("fundingType" <> 'SPLIT' OR ("sellerFundingShare" > 0 AND "sellerFundingShare" < 1))`,
			mysql: `ALTER TABLE \`promotion\` ADD CONSTRAINT \`CHK_promotion_funding_share\` CHECK (\`fundingType\` <> 'SPLIT' OR (\`sellerFundingShare\` > 0 AND \`sellerFundingShare\` < 1))`
		},
		{
			table: 'promotion',
			name: 'CHK_promotion_seller_funding',
			columns: ['fundingType', 'sellerId'],
			postgres: `ALTER TABLE "promotion" ADD CONSTRAINT "CHK_promotion_seller_funding" CHECK ("fundingType" = 'PLATFORM' OR "sellerId" IS NOT NULL)`,
			mysql: `ALTER TABLE \`promotion\` ADD CONSTRAINT \`CHK_promotion_seller_funding\` CHECK (\`fundingType\` = 'PLATFORM' OR \`sellerId\` IS NOT NULL)`
		}
	];

	/** The `sellerId` references this tick constrains, once `seller` exists. */
	private static readonly REFERENCES: ReadonlyArray<{ table: string; constraint: string }> = [
		{ table: 'adjustment', constraint: 'FK_adjustment_seller' },
		{ table: 'promotion', constraint: 'FK_promotion_seller' },
		{ table: 'fulfillment', constraint: 'FK_fulfillment_seller' },
		{ table: 'order_return', constraint: 'FK_order_return_seller' },
		{ table: 'product_price', constraint: 'FK_product_price_seller' },
		{ table: 'warehouse', constraint: 'FK_warehouse_seller' }
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
	 * SqliteDB Up Migration
	 *
	 * The columns and the indexes, which this dialect supports; no constraint, which it does not.
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		for (const column of this.columnsFor('sqlite')) {
			await this.addColumn(queryRunner, column);
		}

		await this.addIndexes(queryRunner, 'sqlite');
		await this.extendPriceTuple(queryRunner, 'sqlite');
	}

	/**
	 * SqliteDB Down Migration
	 *
	 * The columns are left in place: SQLite cannot drop one without rebuilding the table, and a rebuild
	 * of the price and promotion tables to undo an additive column is exactly the destructive `ALTER` the
	 * conventions chapter forbids. The indexes go, because a `DROP INDEX` is supported.
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.restorePriceTuple(queryRunner, 'sqlite');
		await this.dropIndexes(queryRunner, 'sqlite');
	}

	/**
	 * PostgresDB Up Migration
	 *
	 * @param queryRunner
	 */
	public async postgresUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		for (const column of this.columnsFor('postgres')) {
			await this.addColumn(queryRunner, column);
		}

		await this.addIndexes(queryRunner, 'postgres');
		await this.extendPriceTuple(queryRunner, 'postgres');

		for (const reference of AddMarketplaceAmendmentColumns1791000000435.REFERENCES) {
			await this.addReference(
				queryRunner,
				reference,
				`ALTER TABLE "${reference.table}" ADD CONSTRAINT "${reference.constraint}" FOREIGN KEY ("sellerId") REFERENCES "seller"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
			);
		}

		for (const constraint of AddMarketplaceAmendmentColumns1791000000435.CONSTRAINTS) {
			await addCheckConstraint(queryRunner, constraint, this.name);
		}
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		for (const constraint of AddMarketplaceAmendmentColumns1791000000435.CONSTRAINTS) {
			await this.dropConstraint(queryRunner, 'postgres', constraint.name, constraint.table);
		}

		for (const reference of AddMarketplaceAmendmentColumns1791000000435.REFERENCES) {
			await this.dropConstraint(queryRunner, 'postgres', reference.constraint, reference.table);
		}

		await this.restorePriceTuple(queryRunner, 'postgres');
		await this.dropIndexes(queryRunner, 'postgres');
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		for (const column of this.columnsFor('mysql')) {
			await this.addColumn(queryRunner, column);
		}

		await this.addIndexes(queryRunner, 'mysql');
		await this.extendPriceTuple(queryRunner, 'mysql');

		for (const reference of AddMarketplaceAmendmentColumns1791000000435.REFERENCES) {
			await this.addReference(
				queryRunner,
				reference,
				`ALTER TABLE \`${reference.table}\` ADD CONSTRAINT \`${reference.constraint}\` FOREIGN KEY (\`sellerId\`) REFERENCES \`seller\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
			);
		}

		for (const constraint of AddMarketplaceAmendmentColumns1791000000435.CONSTRAINTS) {
			await addCheckConstraint(queryRunner, constraint, this.name);
		}
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		for (const constraint of AddMarketplaceAmendmentColumns1791000000435.CONSTRAINTS) {
			await this.dropConstraint(queryRunner, 'mysql', constraint.name, constraint.table);
		}

		for (const reference of AddMarketplaceAmendmentColumns1791000000435.REFERENCES) {
			await this.dropConstraint(queryRunner, 'mysql', reference.constraint, reference.table);
		}

		await this.restorePriceTuple(queryRunner, 'mysql');
		await this.dropIndexes(queryRunner, 'mysql');
	}

	/**
	 * Every column this tick adds, as the dialect's own `ALTER TABLE … ADD COLUMN`.
	 *
	 * @param dialect The dialect the statements are written for.
	 * @returns One entry per column, in the order they are added.
	 */
	private columnsFor(dialect: 'sqlite' | 'postgres' | 'mysql'): Array<{
		table: string;
		column: string;
		statement: string;
	}> {
		const uuid = { sqlite: 'varchar', postgres: 'uuid', mysql: 'varchar(36) NULL' }[dialect];
		const quote = dialect === 'mysql' ? '`' : '"';
		const of = (table: string, column: string, type: string) => ({
			table,
			column,
			statement: `ALTER TABLE ${quote}${table}${quote} ADD COLUMN ${quote}${column}${quote} ${type}`
		});

		return [
			of('adjustment', 'fundedBy', `varchar(16) NOT NULL DEFAULT 'PLATFORM'`),
			of('adjustment', 'sellerId', uuid),
			of('promotion', 'fundingType', `varchar(16) NOT NULL DEFAULT 'PLATFORM'`),
			of('promotion', 'sellerFundingShare', 'numeric(9,6) NOT NULL DEFAULT 0'),
			of('promotion', 'sellerId', uuid),
			of('fulfillment', 'sellerId', uuid),
			of('order_return', 'sellerId', uuid),
			of('product_price', 'sellerId', uuid)
		];
	}

	/**
	 * The indexes the new columns are read through.
	 *
	 * @param queryRunner The runner the migration is executing on.
	 * @param dialect The dialect, for its quoting and its partial-index support.
	 */
	private async addIndexes(queryRunner: QueryRunner, dialect: 'sqlite' | 'postgres' | 'mysql'): Promise<void> {
		const quote = dialect === 'mysql' ? '`' : '"';
		const partial = dialect === 'mysql' ? '' : ' WHERE "sellerId" IS NOT NULL';
		const live = dialect === 'mysql' ? '' : ' AND "deletedAt" IS NULL';
		const indexes: Array<{ table: string; name: string; columns: string }> = [
			{ table: 'adjustment', name: 'IDX_adjustment_seller', columns: `("sellerId", "ownerType", "ownerId")` },
			{ table: 'promotion', name: 'IDX_promotion_seller', columns: `("sellerId", "status")` },
			{ table: 'fulfillment', name: 'IDX_fulfillment_seller', columns: `("sellerId", "status")` },
			{ table: 'order_return', name: 'IDX_order_return_seller', columns: `("sellerId", "status")` },
			{
				table: 'product_price',
				name: 'IDX_price_seller',
				columns: `("sellerId", "variantId", "currency", "status")`
			}
		];

		for (const index of indexes) {
			if (!(await queryRunner.hasTable(index.table))) continue;
			if (!(await queryRunner.hasColumn(index.table, 'sellerId'))) continue;

			const columns =
				dialect === 'mysql' ? index.columns.replace(/"/g, '`') : index.columns;

			try {
				await queryRunner.query(
					`CREATE INDEX ${quote}${index.name}${quote} ON ${quote}${index.table}${quote} ${columns}${
						dialect === 'mysql' ? '' : `${partial.replace(/"/g, quote)}${live.replace(/"/g, quote)}`
					}`
				);
			} catch (error) {
				// An index that is already there is the state this method is trying to reach; anything else
				// is re-raised, because a silently missing index is a query that reads a whole table.
				if (!/already exists|Duplicate key name/i.test(String((error as Error)?.message))) {
					throw error;
				}
			}
		}
	}

	/**
	 * Drops the indexes this tick creates.
	 *
	 * @param queryRunner The runner the migration is executing on.
	 * @param dialect The dialect, for its `DROP INDEX` form.
	 */
	private async dropIndexes(queryRunner: QueryRunner, dialect: 'sqlite' | 'postgres' | 'mysql'): Promise<void> {
		const names = [
			'IDX_adjustment_seller',
			'IDX_promotion_seller',
			'IDX_fulfillment_seller',
			'IDX_order_return_seller',
			'IDX_price_seller'
		];
		const tables = ['adjustment', 'promotion', 'fulfillment', 'order_return', 'product_price'];

		for (let index = 0; index < names.length; index += 1) {
			try {
				await queryRunner.query(
					dialect === 'mysql'
						? `DROP INDEX \`${names[index]}\` ON \`${tables[index]}\``
						: `DROP INDEX IF EXISTS "${names[index]}"`
				);
			} catch {
				// An index that is not there is the state this method is trying to reach.
			}
		}
	}

	/**
	 * Adds `sellerId` to the price table's unique tuple.
	 *
	 * The tuple is what makes one price row per seller per tier per list: without the seller in it, a
	 * seller-scoped price would collide with the platform's own row for the same variant and currency, and
	 * the second write would be refused rather than stored. The index is dropped and recreated because a
	 * tuple cannot be altered in place; both forms are the pricing set's own, with `sellerId` after
	 * `currency` — the filtered tuple on PostgreSQL and SQLite, and the generated-key form on MySQL, which
	 * has no filtered index.
	 *
	 * @param queryRunner The runner the migration is executing on.
	 * @param dialect The dialect, for its quoting and its tuple.
	 */
	private async extendPriceTuple(
		queryRunner: QueryRunner,
		dialect: 'sqlite' | 'postgres' | 'mysql'
	): Promise<void> {
		if (!(await queryRunner.hasTable('product_price'))) return;
		if (!(await queryRunner.hasColumn('product_price', 'sellerId'))) return;

		await this.replacePriceTuple(queryRunner, dialect, '"variantId", "currency", "sellerId", "priceListId", "minQuantity", "maxQuantity"');
	}

	/**
	 * Puts the price table's unique tuple back the way the pricing set declared it.
	 *
	 * @param queryRunner The runner the migration is executing on.
	 * @param dialect The dialect, for its quoting and its tuple.
	 */
	private async restorePriceTuple(
		queryRunner: QueryRunner,
		dialect: 'sqlite' | 'postgres' | 'mysql'
	): Promise<void> {
		if (!(await queryRunner.hasTable('product_price'))) return;

		await this.replacePriceTuple(queryRunner, dialect, '"variantId", "currency", "priceListId", "minQuantity", "maxQuantity"');
	}

	/**
	 * Replaces the tier index with one over the stated columns.
	 *
	 * @param queryRunner The runner the migration is executing on.
	 * @param dialect The dialect, for its quoting.
	 * @param columns The tuple, quoted for PostgreSQL.
	 */
	private async replacePriceTuple(
		queryRunner: QueryRunner,
		dialect: 'sqlite' | 'postgres' | 'mysql',
		columns: string
	): Promise<void> {
		try {
			await queryRunner.query(
				dialect === 'mysql' ? 'DROP INDEX `UQ_price_tier` ON `product_price`' : 'DROP INDEX IF EXISTS "UQ_price_tier"'
			);
		} catch {
			// A tuple this migration has already replaced, or one the table never carried.
		}

		const statement =
			dialect === 'mysql'
				? `CREATE UNIQUE INDEX \`UQ_price_tier\` ON \`product_price\` (\`variantId\`, \`currency\`${
						columns.includes('sellerId') ? ', `sellerId`' : ''
				  }, \`priceListId\`, \`minQuantity\`, \`maxQuantity\`, \`deletedKey\`)`
				: `CREATE UNIQUE INDEX "UQ_price_tier" ON "product_price" (${columns}) WHERE "deletedAt" IS NULL`;

		await queryRunner.query(statement);
	}

	/**
	 * Adds one column when the table is there and the column is not.
	 *
	 * @param queryRunner The runner the migration is executing on.
	 * @param column The table, the column and the dialect's own statement.
	 */
	private async addColumn(
		queryRunner: QueryRunner,
		column: { table: string; column: string; statement: string }
	): Promise<void> {
		if (!(await queryRunner.hasTable(column.table))) return;
		if (await queryRunner.hasColumn(column.table, column.column)) return;

		await queryRunner.query(column.statement);
		console.log(chalk.yellow(`${this.name}: added ${column.table}.${column.column}.`));
	}

	/**
	 * Adds one foreign key when the target, the column and the constraint's own absence all allow it.
	 *
	 * @param queryRunner The runner the migration is executing on.
	 * @param reference The table and the constraint's name.
	 * @param statement The dialect's own `ALTER TABLE … ADD CONSTRAINT`.
	 */
	private async addReference(
		queryRunner: QueryRunner,
		reference: { table: string; constraint: string },
		statement: string
	): Promise<void> {
		if (!(await queryRunner.hasTable('seller'))) return;
		if (!(await queryRunner.hasTable(reference.table))) return;
		if (!(await queryRunner.hasColumn(reference.table, 'sellerId'))) return;

		const described = await queryRunner.getTable(reference.table);

		if (described?.foreignKeys?.some((key) => key.name === reference.constraint)) return;

		await queryRunner.query(statement);
		console.log(chalk.yellow(`${this.name}: added ${reference.constraint} on ${reference.table}.`));
	}

	/**
	 * Drops one constraint, tolerating its absence.
	 *
	 * @param queryRunner The runner the migration is executing on.
	 * @param dialect The dialect, for its quoting.
	 * @param name The constraint's name.
	 * @param table The table it hangs off.
	 */
	private async dropConstraint(
		queryRunner: QueryRunner,
		dialect: 'sqlite' | 'postgres' | 'mysql',
		name: string,
		table: string
	): Promise<void> {
		try {
			await queryRunner.query(
				dialect === 'mysql'
					? `ALTER TABLE \`${table}\` DROP CONSTRAINT \`${name}\``
					: `ALTER TABLE "${table}" DROP CONSTRAINT "${name}"`
			);
		} catch {
			// Nothing to drop.
		}
	}
}
