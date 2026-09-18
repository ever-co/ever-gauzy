import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * Activates the foreign keys onto `channel` and `region` that the delivered migrations could not add.
 *
 * **Why this companion exists at all.** Every constraint onto the two tables was written **guarded**:
 * `1791000000100-CreateCatalogTables` and the migrations after it add their constraint only when
 * `channel` / `region` already exists, which is the rule that lets a plugin migration run against a
 * database where the kernel set has not been applied. On a fresh installation those guards now pass —
 * `1791000000085-CreateChannelAndRegionTables` creates the five tables — but on an installation that
 * already ran the referencing migrations the guard was false **at the time it ran**, and a migration
 * never runs twice. Adding the tables leaves that installation with the columns and without the
 * constraints, which is exactly the state this file repairs: it adds, one by one, only the constraints
 * that are missing.
 *
 * **It also writes the constraints that were never written at all.** Six columns that name a channel and
 * two that name a region were declared with no attempt at a constraint anywhere in the tree, because
 * the table they name did not exist and no migration could name it: `tenant_setting.channelId`,
 * `organization_contact.channelId`, `sequence.channelId`, `webhook_subscription.channelId`,
 * `order.channelId`, `commerce_cart.channelId`, `order.regionId` and `commerce_cart.regionId`. For those
 * the guard is the same guard — a column that exists, a target that exists, a constraint that does not —
 * so one file covers both families.
 *
 * **Every constraint is added only where its column and its target both exist and the constraint does
 * not.** A deployment that has not installed the catalog, pricing, tax, inventory, warehouse,
 * fulfilment, promotion, order or cart set has no table to alter, and this file must leave it alone
 * rather than fail its boot. The probe is three reads — `hasTable` on the referencing table, `hasTable`
 * on the target, `hasColumn` on the column — plus a catalog read for the constraint itself, because
 * `QueryRunner` exposes `hasTable` and `hasColumn` and no `hasConstraint`, so the existence of the
 * constraint is read from `information_schema.table_constraints` (PostgreSQL and MySQL both).
 *
 * **The columns this file constrains, and why each one's `onDelete` is what it is** (the buckets are the
 * schema chapter's §1.7a policy):
 *
 * | table | column | target | onDelete | bucket |
 * |---|---|---|---|---|
 * | `organization_contact` | `channelId` | `channel` | `SET NULL` | 4 — an optional context on a party |
 * | `tenant_setting` | `channelId` | `channel` | `SET NULL` | 4 — an optional scope on a setting |
 * | `sequence` | `channelId` | `channel` | `CASCADE` | 3 — a numbering series belongs to its channel |
 * | `webhook_subscription` | `channelId` | `channel` | `SET NULL` | 4 — an optional scope on an endpoint |
 * | `collection_channel` | `channelId` | `channel` | `CASCADE` | 2 — pivot, both sides are peers |
 * | `product_channel` | `channelId` | `channel` | `CASCADE` | 2 — pivot |
 * | `product_variant_channel` | `channelId` | `channel` | `CASCADE` | 2 — pivot |
 * | `price_list` | `channelId` | `channel` | `SET NULL` | 4 — a price list survives its channel |
 * | `channel_warehouse` | `channelId` | `channel` | `CASCADE` | 2 — pivot |
 * | `order` | `channelId` | `channel` | `RESTRICT` | 5 — a channel with orders is archived, not deleted |
 * | `commerce_cart` | `channelId` | `channel` | `RESTRICT` | 5 — a cart belongs to exactly one channel |
 * | `pick_wave` | `channelId` | `channel` | `SET NULL` | 4 — an optional filter on a wave |
 * | `promotion` | `channelId` | `channel` | `SET NULL` | 4 — an optional scope on a promotion |
 * | `shipping_option` | `channelId` | `channel` | `SET NULL` | 4 — an optional scope on an option |
 * | `price_list` | `regionId` | `region` | `SET NULL` | 4 |
 * | `tax_rate` | `regionId` | `region` | `SET NULL` | 4 |
 * | `tax_regime` | `regionId` | `region` | `SET NULL` | 4 |
 * | `order` | `regionId` | `region` | `SET NULL` | 4 — the order keeps the geography it snapshotted |
 * | `commerce_cart` | `regionId` | `region` | `SET NULL` | 4 |
 * | `shipping_option` | `regionId` | `region` | `SET NULL` | 4 |
 *
 * The names are the ones the delivered migrations already use where a name exists
 * (`FK_collection_channel_channel`, `FK_price_list_region`, `FK_tax_rate_region`, …), so an installation
 * that *did* get a constraint from its own migration and an installation repaired by this file end up
 * with the same schema and not with two spellings of it.
 *
 * **Why the tick is late.** A constraint may be added to a table that already exists, on an installation
 * that has been running for a while, and every table named above is created by a migration between
 * `1791000000000` and `1791000000380`. `1791000000530` runs after all of them, which is what makes the
 * `hasTable` guards meaningful: at an earlier tick half of these tables would not exist yet on a fresh
 * installation and the file would have to be run again to finish its work.
 *
 * **SQLite is a documented no-op for a stated reason.** That dialect cannot add a foreign key to an
 * existing table — the constraint has to be part of the `CREATE TABLE` — so a file like this one is not
 * expressible there at all. It does not need to be: a **fresh** SQLite installation gets every one of
 * these constraints inline from the migration that creates each table (`1791000000085` declares its own
 * three inline, and every delivered migration declares its own in its SQLite `CREATE TABLE`), and a
 * SQLite database that was synchronised from the entities instead is a development database whose
 * schema is rebuilt from the entities, not patched. Both `sqliteUpQueryRunner` and
 * `sqliteDownQueryRunner` therefore do nothing and say so.
 */
export class AddChannelAndRegionForeignKeys1791000000530 implements MigrationInterface {
	name = 'AddChannelAndRegionForeignKeys1791000000530';

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
		await this.addMissing(queryRunner, 'postgres');
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.dropAdded(queryRunner, 'postgres');
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * SQLite cannot add a foreign key to an existing table, so there is nothing this file can express on
	 * this dialect — the note at the top of the class says why that is also nothing it needs to express:
	 * a fresh SQLite installation gets every constraint inline from the migration that creates its table.
	 * The method exists, and says so, rather than being absent, because a reader who finds a missing
	 * branch reads it as an oversight.
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		console.log(
			chalk.gray(
				`${this.name}: SQLite cannot add a foreign key to an existing table; a fresh SQLite installation gets these constraints inline from the migrations that create the tables. Nothing to do.`
			)
		);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * The matching no-op: this file added nothing on this dialect, so there is nothing to remove.
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		console.log(
			chalk.gray(
				`${this.name}: nothing was added on SQLite, so there is nothing to remove; the constraints live in the creating migrations.`
			)
		);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.addMissing(queryRunner, 'mysql');
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.dropAdded(queryRunner, 'mysql');
	}

	/**
	 * Adds every constraint of the catalogue that is missing, and only those.
	 *
	 * @param queryRunner
	 * @param dialect The dialect the statements are rendered for.
	 */
	private async addMissing(queryRunner: QueryRunner, dialect: Dialect): Promise<void> {
		let added = 0;
		let skipped = 0;

		for (const foreignKey of CHANNEL_REGION_FOREIGN_KEYS) {
			if (!(await this.isExpressible(queryRunner, foreignKey, dialect))) {
				skipped++;
				continue;
			}

			await queryRunner.query(this.addStatement(foreignKey, dialect));
			added++;
		}

		// Reported rather than assumed: a reviewer reading a boot log can see what the file actually did,
		// and a run that added nothing because the deployment does not install those packages is
		// distinguishable from a run that added nothing because the probes were wrong.
		console.log(
			chalk.yellow(
				`${this.name}: ${added} foreign key(s) added, ${skipped} not applicable to this installation.`
			)
		);
	}

	/**
	 * Drops every constraint this file is responsible for, in the reverse of the order it adds them.
	 *
	 * Only what exists is dropped, so a `down` on an installation that never ran the `up` — or that had
	 * already received a constraint from its own migration — is a no-op rather than an error.
	 *
	 * @param queryRunner
	 * @param dialect The dialect the statements are rendered for.
	 */
	private async dropAdded(queryRunner: QueryRunner, dialect: Dialect): Promise<void> {
		for (const foreignKey of [...CHANNEL_REGION_FOREIGN_KEYS].reverse()) {
			if (!(await queryRunner.hasTable(foreignKey.table))) {
				continue;
			}

			if (!(await this.hasConstraint(queryRunner, foreignKey, dialect))) {
				continue;
			}

			await queryRunner.query(this.dropStatement(foreignKey, dialect));

			// MySQL creates an index for a foreign key when the column has none, and drops the constraint
			// without dropping the index it invented. The index is dropped as well — but only when it is
			// named exactly like the constraint, which is the name the server itself chose, so an index a
			// migration created deliberately (`IDX_tenant_setting_channel`) is never touched.
			if (dialect === 'mysql' && (await this.hasIndex(queryRunner, foreignKey))) {
				await queryRunner.query(
					`ALTER TABLE ${this.quote('mysql', foreignKey.table)} DROP INDEX ${this.quote(
						'mysql',
						foreignKey.constraint
					)}`
				);
			}
		}
	}

	/**
	 * Whether a constraint can be added on this installation: the referencing table exists, its column
	 * exists, the target table exists, and the constraint is not already there.
	 *
	 * @param queryRunner
	 * @param foreignKey The constraint to probe for.
	 * @param dialect The dialect the probe is rendered for.
	 * @returns True when the constraint is missing and may be added.
	 */
	private async isExpressible(
		queryRunner: QueryRunner,
		foreignKey: ForeignKeyDefinition,
		dialect: Dialect
	): Promise<boolean> {
		if (!(await queryRunner.hasTable(foreignKey.table))) {
			return false;
		}

		if (!(await queryRunner.hasColumn(foreignKey.table, foreignKey.column))) {
			return false;
		}

		if (!(await queryRunner.hasTable(foreignKey.target))) {
			return false;
		}

		return !(await this.hasConstraint(queryRunner, foreignKey, dialect));
	}

	/**
	 * Whether the constraint already exists.
	 *
	 * Read from the catalog rather than from the driver: `QueryRunner` offers `hasTable` and `hasColumn`
	 * and no `hasConstraint`, and a probe that guessed from the constraint's name in a `SHOW CREATE TABLE`
	 * string would be a text match against DDL. Both dialects answer the same question from
	 * `information_schema.table_constraints`.
	 *
	 * @param queryRunner
	 * @param foreignKey The constraint to look for.
	 * @param dialect The dialect the probe is rendered for.
	 * @returns True when a constraint of that name is already on that table.
	 */
	private async hasConstraint(
		queryRunner: QueryRunner,
		foreignKey: ForeignKeyDefinition,
		dialect: Dialect
	): Promise<boolean> {
		const rows: Array<Record<string, unknown>> = await queryRunner.query(
			dialect === 'mysql'
				? `SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = ? AND CONSTRAINT_TYPE = 'FOREIGN KEY' LIMIT 1`
				: `SELECT 1 FROM information_schema.table_constraints WHERE constraint_schema = current_schema() AND table_name = $1 AND constraint_name = $2 AND constraint_type = 'FOREIGN KEY' LIMIT 1`,
			[foreignKey.table, foreignKey.constraint]
		);

		return Array.isArray(rows) && rows.length > 0;
	}

	/**
	 * Whether the index MySQL invents for a foreign key is present.
	 *
	 * @param queryRunner
	 * @param foreignKey The constraint whose index is looked for.
	 * @returns True when an index named exactly like the constraint exists on the table.
	 */
	private async hasIndex(queryRunner: QueryRunner, foreignKey: ForeignKeyDefinition): Promise<boolean> {
		const rows: Array<Record<string, unknown>> = await queryRunner.query(
			`SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ? LIMIT 1`,
			[foreignKey.table, foreignKey.constraint]
		);

		return Array.isArray(rows) && rows.length > 0;
	}

	/**
	 * Renders the `ALTER TABLE … ADD CONSTRAINT …` statement for one constraint.
	 *
	 * @param foreignKey The constraint to add.
	 * @param dialect The dialect the statement is rendered for.
	 * @returns The statement.
	 */
	private addStatement(foreignKey: ForeignKeyDefinition, dialect: Dialect): string {
		const q = (identifier: string) => this.quote(dialect, identifier);

		return (
			`ALTER TABLE ${q(foreignKey.table)} ADD CONSTRAINT ${q(foreignKey.constraint)} ` +
			`FOREIGN KEY (${q(foreignKey.column)}) REFERENCES ${q(foreignKey.target)}(${q('id')}) ` +
			`ON DELETE ${foreignKey.onDelete} ON UPDATE NO ACTION`
		);
	}

	/**
	 * Renders the statement that removes one constraint.
	 *
	 * @param foreignKey The constraint to remove.
	 * @param dialect The dialect the statement is rendered for.
	 * @returns The statement.
	 */
	private dropStatement(foreignKey: ForeignKeyDefinition, dialect: Dialect): string {
		return dialect === 'mysql'
			? `ALTER TABLE ${this.quote('mysql', foreignKey.table)} DROP FOREIGN KEY ${this.quote(
					'mysql',
					foreignKey.constraint
				)}`
			: `ALTER TABLE ${this.quote('postgres', foreignKey.table)} DROP CONSTRAINT ${this.quote(
					'postgres',
					foreignKey.constraint
				)}`;
	}

	/**
	 * Quotes an identifier for a dialect.
	 *
	 * @param dialect The dialect.
	 * @param identifier The identifier.
	 * @returns The quoted identifier.
	 */
	private quote(dialect: Dialect, identifier: string): string {
		return dialect === 'mysql' ? `\`${identifier}\`` : `"${identifier}"`;
	}
}

/** The two dialects this migration expresses a constraint on. */
type Dialect = 'postgres' | 'mysql';

/**
 * One foreign key onto `channel` or `region`.
 *
 * `origin` is written down for the reviewer rather than read by the code: it names the file that declares
 * the column, so that the list can be checked against the delivered migrations without grepping for it.
 */
interface ForeignKeyDefinition {
	/** The table carrying the column. */
	readonly table: string;
	/** The column that names a channel or a region. */
	readonly column: string;
	/** The table the column names. */
	readonly target: 'channel' | 'region';
	/** The constraint name, matching the delivered spelling wherever a delivered migration already has one. */
	readonly constraint: string;
	/** What happens to the row when its channel or region is hard-deleted. */
	readonly onDelete: 'CASCADE' | 'SET NULL' | 'RESTRICT';
	/** The delivered migration that declares the column. */
	readonly origin: string;
}

/**
 * Every column of a delivered table that names a channel or a region, with the constraint it needs.
 *
 * The order is the order the constraints are added in and the reverse of the order they are dropped in;
 * it groups the channel columns before the region ones and follows the families of the schema chapter.
 */
const CHANNEL_REGION_FOREIGN_KEYS: readonly ForeignKeyDefinition[] = [
	// --- party and platform rows ------------------------------------------------------------------
	{
		table: 'organization_contact',
		column: 'channelId',
		target: 'channel',
		constraint: 'FK_organization_contact_channel',
		onDelete: 'SET NULL',
		origin: '1791000000095-AlterCoreTablesForExtensions.ts'
	},
	{
		table: 'tenant_setting',
		column: 'channelId',
		target: 'channel',
		constraint: 'FK_tenant_setting_channel',
		onDelete: 'SET NULL',
		origin: '1791000000095-AlterCoreTablesForExtensions.ts'
	},
	{
		table: 'sequence',
		column: 'channelId',
		target: 'channel',
		constraint: 'FK_sequence_channel',
		onDelete: 'CASCADE',
		origin: '1791000000000-CreateSequenceTable.ts'
	},
	{
		table: 'webhook_subscription',
		column: 'channelId',
		target: 'channel',
		constraint: 'FK_webhook_subscription_channel',
		onDelete: 'SET NULL',
		origin: '1791000000040-CreateWebhookTables.ts'
	},
	// --- catalogue publications --------------------------------------------------------------------
	{
		table: 'collection_channel',
		column: 'channelId',
		target: 'channel',
		constraint: 'FK_collection_channel_channel',
		onDelete: 'CASCADE',
		origin: '1791000000100-CreateCatalogTables.ts'
	},
	{
		table: 'product_channel',
		column: 'channelId',
		target: 'channel',
		constraint: 'FK_product_channel_channel',
		onDelete: 'CASCADE',
		origin: '1791000000100-CreateCatalogTables.ts'
	},
	{
		table: 'product_variant_channel',
		column: 'channelId',
		target: 'channel',
		constraint: 'FK_product_variant_channel_channel',
		onDelete: 'CASCADE',
		origin: '1791000000100-CreateCatalogTables.ts'
	},
	// --- pricing, tax and promotion ------------------------------------------------------------------
	{
		table: 'price_list',
		column: 'channelId',
		target: 'channel',
		constraint: 'FK_price_list_channel',
		onDelete: 'SET NULL',
		origin: '1791000000120-CreatePricingTables.ts'
	},
	{
		table: 'price_list',
		column: 'regionId',
		target: 'region',
		constraint: 'FK_price_list_region',
		onDelete: 'SET NULL',
		origin: '1791000000120-CreatePricingTables.ts'
	},
	{
		table: 'tax_rate',
		column: 'regionId',
		target: 'region',
		constraint: 'FK_tax_rate_region',
		onDelete: 'SET NULL',
		origin: '1791000000140-CreateTaxTables.ts'
	},
	{
		table: 'tax_regime',
		column: 'regionId',
		target: 'region',
		constraint: 'FK_tax_regime_region',
		onDelete: 'SET NULL',
		origin: '1791000000146-CreateTaxRegimeTables.ts'
	},
	{
		table: 'promotion',
		column: 'channelId',
		target: 'channel',
		constraint: 'FK_promotion_channel',
		onDelete: 'SET NULL',
		origin: '1791000000260-CreatePromotionTables.ts'
	},
	// --- stock, picking and fulfilment ----------------------------------------------------------------
	{
		table: 'channel_warehouse',
		column: 'channelId',
		target: 'channel',
		constraint: 'FK_channel_warehouse_channel',
		onDelete: 'CASCADE',
		origin: '1791000000160-CreateInventoryTables.ts'
	},
	{
		table: 'pick_wave',
		column: 'channelId',
		target: 'channel',
		constraint: 'FK_pick_wave_channel',
		onDelete: 'SET NULL',
		origin: '1791000000190-CreateWarehouseWorkTables.ts'
	},
	{
		table: 'shipping_option',
		column: 'channelId',
		target: 'channel',
		constraint: 'FK_shipping_option_channel',
		onDelete: 'SET NULL',
		origin: '1791000000240-CreateFulfillmentTables.ts'
	},
	{
		table: 'shipping_option',
		column: 'regionId',
		target: 'region',
		constraint: 'FK_shipping_option_region',
		onDelete: 'SET NULL',
		origin: '1791000000240-CreateFulfillmentTables.ts'
	},
	// --- the transactional documents ------------------------------------------------------------------
	{
		table: 'commerce_cart',
		column: 'channelId',
		target: 'channel',
		constraint: 'FK_commerce_cart_channel',
		onDelete: 'RESTRICT',
		origin: '1791000000200-CreateCartTables.ts'
	},
	{
		table: 'commerce_cart',
		column: 'regionId',
		target: 'region',
		constraint: 'FK_commerce_cart_region',
		onDelete: 'SET NULL',
		origin: '1791000000200-CreateCartTables.ts'
	},
	{
		table: 'order',
		column: 'channelId',
		target: 'channel',
		constraint: 'FK_order_channel',
		onDelete: 'RESTRICT',
		origin: '1791000000220-CreateOrderTables.ts'
	},
	{
		table: 'order',
		column: 'regionId',
		target: 'region',
		constraint: 'FK_order_region',
		onDelete: 'SET NULL',
		origin: '1791000000220-CreateOrderTables.ts'
	}
];
