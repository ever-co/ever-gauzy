import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * Adds the foreign keys that point at `shipping_option` from the two tables that hold a chosen
 * delivery.
 *
 * Both targets of these constraints are created by this package, and both source columns were created
 * earlier by sets that could not constrain them:
 *
 * - `commerce_cart_shipping_method.shippingOptionId` — the cart set runs before this one, because the
 *   order package depends on the cart and this package depends on the order.
 * - `order_shipping_method.shippingOptionId` — the order set runs before this one too.
 *
 * The rule the migration plan states is exactly this: a column whose target table is created by a later
 * set is created without its foreign key, and the set that creates the target adds the constraint in a
 * migration of its own. This is that migration, and the columns are null-able by design — a manually
 * priced shipment has no option, and deactivating an option must not delete what a buyer already chose.
 *
 * Each constraint is added only when its column is present, so the file is safe on an installation that
 * has not applied those sets' latest shape.
 */
export class AddCartShippingOptionForeignKey1791000000250 implements MigrationInterface {
	name = 'AddCartShippingOptionForeignKey1791000000250';

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
		if (await queryRunner.hasColumn('commerce_cart_shipping_method', 'shippingOptionId')) {
			await queryRunner.query(
				`ALTER TABLE "commerce_cart_shipping_method" ADD CONSTRAINT "FK_commerce_cart_shipping_method_option" FOREIGN KEY ("shippingOptionId") REFERENCES "shipping_option"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
			);
		}

		if (await queryRunner.hasColumn('order_shipping_method', 'shippingOptionId')) {
			await queryRunner.query(
				`ALTER TABLE "order_shipping_method" ADD CONSTRAINT "FK_order_shipping_method_option" FOREIGN KEY ("shippingOptionId") REFERENCES "shipping_option"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
			);
		}
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		if (await queryRunner.hasColumn('order_shipping_method', 'shippingOptionId')) {
			await queryRunner.query(
				`ALTER TABLE "order_shipping_method" DROP CONSTRAINT "FK_order_shipping_method_option"`
			);
		}

		if (await queryRunner.hasColumn('commerce_cart_shipping_method', 'shippingOptionId')) {
			await queryRunner.query(
				`ALTER TABLE "commerce_cart_shipping_method" DROP CONSTRAINT "FK_commerce_cart_shipping_method_option"`
			);
		}
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * SQLite cannot add a constraint to an existing table, so each table is rebuilt from its own
	 * definition with the constraint appended — the same operation the order set performs for its own
	 * cross-set key, and the only way this dialect can express a constraint change.
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query('PRAGMA foreign_keys = OFF');

		if (await queryRunner.hasColumn('commerce_cart_shipping_method', 'shippingOptionId')) {
			await this.rebuildSqliteTableWithOptionForeignKey(queryRunner, 'commerce_cart_shipping_method');
		}

		if (await queryRunner.hasColumn('order_shipping_method', 'shippingOptionId')) {
			await this.rebuildSqliteTableWithOptionForeignKey(queryRunner, 'order_shipping_method');
		}

		await queryRunner.query('PRAGMA foreign_keys = ON');
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query('PRAGMA foreign_keys = OFF');

		if (await queryRunner.hasColumn('order_shipping_method', 'shippingOptionId')) {
			await this.rebuildSqliteTableWithoutOptionForeignKey(queryRunner, 'order_shipping_method');
		}

		if (await queryRunner.hasColumn('commerce_cart_shipping_method', 'shippingOptionId')) {
			await this.rebuildSqliteTableWithoutOptionForeignKey(queryRunner, 'commerce_cart_shipping_method');
		}

		await queryRunner.query('PRAGMA foreign_keys = ON');
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		if (await queryRunner.hasColumn('commerce_cart_shipping_method', 'shippingOptionId')) {
			await queryRunner.query(
				`ALTER TABLE \`commerce_cart_shipping_method\` ADD CONSTRAINT \`FK_commerce_cart_shipping_method_option\` FOREIGN KEY (\`shippingOptionId\`) REFERENCES \`shipping_option\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
			);
		}

		if (await queryRunner.hasColumn('order_shipping_method', 'shippingOptionId')) {
			await queryRunner.query(
				`ALTER TABLE \`order_shipping_method\` ADD CONSTRAINT \`FK_order_shipping_method_option\` FOREIGN KEY (\`shippingOptionId\`) REFERENCES \`shipping_option\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
			);
		}
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		if (await queryRunner.hasColumn('order_shipping_method', 'shippingOptionId')) {
			await queryRunner.query(
				`ALTER TABLE \`order_shipping_method\` DROP FOREIGN KEY \`FK_order_shipping_method_option\``
			);
		}

		if (await queryRunner.hasColumn('commerce_cart_shipping_method', 'shippingOptionId')) {
			await queryRunner.query(
				`ALTER TABLE \`commerce_cart_shipping_method\` DROP FOREIGN KEY \`FK_commerce_cart_shipping_method_option\``
			);
		}
	}

	/**
	 * Rebuilds a SQLite table with the shipping-option foreign key added.
	 *
	 * @param queryRunner The query runner.
	 * @param table The table to rebuild.
	 */
	private async rebuildSqliteTableWithOptionForeignKey(queryRunner: QueryRunner, table: string): Promise<void> {
		const definition = await this.sqliteDefinitionOf(queryRunner, table);

		if (!definition || definition.includes(`FK_${table}_option`)) {
			return;
		}

		const withConstraint = definition.replace(
			/\)\s*$/,
			`, CONSTRAINT "FK_${table}_option" FOREIGN KEY ("shippingOptionId") REFERENCES "shipping_option" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`
		);

		await queryRunner.query(`ALTER TABLE "${table}" RENAME TO "${table}_option_fk_backup"`);
		await queryRunner.query(withConstraint);
		await queryRunner.query(`INSERT INTO "${table}" SELECT * FROM "${table}_option_fk_backup"`);
		await queryRunner.query(`DROP TABLE "${table}_option_fk_backup"`);
	}

	/**
	 * Rebuilds a SQLite table with the shipping-option foreign key removed.
	 *
	 * @param queryRunner The query runner.
	 * @param table The table to rebuild.
	 */
	private async rebuildSqliteTableWithoutOptionForeignKey(
		queryRunner: QueryRunner,
		table: string
	): Promise<void> {
		const definition = await this.sqliteDefinitionOf(queryRunner, table);

		if (!definition || !definition.includes(`FK_${table}_option`)) {
			return;
		}

		const withoutConstraint = definition.replace(
			new RegExp(`,\\s*CONSTRAINT "FK_${table}_option"[^)]*\\)\\s*\\)\\s*$`),
			')'
		);

		await queryRunner.query(`ALTER TABLE "${table}" RENAME TO "${table}_option_fk_backup"`);
		await queryRunner.query(withoutConstraint);
		await queryRunner.query(`INSERT INTO "${table}" SELECT * FROM "${table}_option_fk_backup"`);
		await queryRunner.query(`DROP TABLE "${table}_option_fk_backup"`);
	}

	/**
	 * Reads a SQLite table's own `CREATE TABLE` statement.
	 *
	 * @param queryRunner The query runner.
	 * @param table The table.
	 * @returns The statement, or null when the table does not exist.
	 */
	private async sqliteDefinitionOf(queryRunner: QueryRunner, table: string): Promise<string | null> {
		const rows: Array<{ sql?: string }> = await queryRunner.query(
			`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?`,
			[table]
		);

		return rows?.[0]?.sql ?? null;
	}
}
