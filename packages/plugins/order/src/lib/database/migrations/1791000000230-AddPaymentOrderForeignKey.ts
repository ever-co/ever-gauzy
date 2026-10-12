import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * Adds the foreign keys the platform's own tables declare towards the order aggregate.
 *
 * Two columns point at `order` from outside this package, and neither could carry its constraint at the
 * moment it was created: the kernel's additive `payment.orderId` column exists before `order` does, and
 * the cart's `commerce_cart.orderId` is created by a set that runs before this one because the order
 * package depends on the cart and never the reverse.
 *
 * The rule the migration plan states is exactly this: a column whose target table is created by a later
 * set is created without its foreign key, and the set that creates the target adds the constraint in a
 * migration of its own. This is that migration.
 *
 * Both constraints are `ON DELETE SET NULL` and both are added only when the column is present, so the
 * file is safe on an installation that has not applied the kernel's alteration yet — the order set is
 * installable on its own, and a missing optional column is not a reason to fail.
 */
export class AddPaymentOrderForeignKey1791000000230 implements MigrationInterface {
	name = 'AddPaymentOrderForeignKey1791000000230';

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
		// A payment settles an invoice or an order: the column is the documented core-to-plugin
		// reference, and it is nullable so that the payment domain keeps working without this package.
		if (await queryRunner.hasColumn('payment', 'orderId')) {
			await queryRunner.query(
				`ALTER TABLE "payment" ADD CONSTRAINT "FK_payment_order" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
			);
		}

		// The reverse direction: the cart records which order it became. Nullable, because an active
		// cart has no order and a cart whose order is deleted stays readable.
		await queryRunner.query(
			`ALTER TABLE "commerce_cart" ADD CONSTRAINT "FK_commerce_cart_order" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE "commerce_cart" DROP CONSTRAINT "FK_commerce_cart_order"`);

		if (await queryRunner.hasColumn('payment', 'orderId')) {
			await queryRunner.query(`ALTER TABLE "payment" DROP CONSTRAINT "FK_payment_order"`);
		}
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * SQLite cannot add a foreign key to an existing table, so the constraint is expressed the way SQLite
	 * expresses every constraint change: the table is rebuilt from its own definition with the constraint
	 * included, its rows copied across, and the indexes recreated. The rebuild is done in one transaction
	 * so a reader never sees an empty table.
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query('PRAGMA foreign_keys = OFF');

		if (await queryRunner.hasColumn('payment', 'orderId')) {
			await this.rebuildSqliteTableWithOrderForeignKey(queryRunner, 'payment', `"orderId" varchar`);
		}

		await this.rebuildSqliteTableWithOrderForeignKey(queryRunner, 'commerce_cart', `"orderId" varchar`);

		await queryRunner.query('PRAGMA foreign_keys = ON');
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * SQLite drops a table's foreign keys with the table, so the inverse rebuilds the two tables without
	 * the constraint — the same operation in the opposite direction, and the only way to remove a
	 * constraint the dialect has no `ALTER TABLE ... DROP CONSTRAINT` for.
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query('PRAGMA foreign_keys = OFF');
		await this.rebuildSqliteTableWithoutOrderForeignKey(queryRunner, 'commerce_cart');

		if (await queryRunner.hasColumn('payment', 'orderId')) {
			await this.rebuildSqliteTableWithoutOrderForeignKey(queryRunner, 'payment');
		}

		await queryRunner.query('PRAGMA foreign_keys = ON');
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		if (await queryRunner.hasColumn('payment', 'orderId')) {
			await queryRunner.query(
				`ALTER TABLE \`payment\` ADD CONSTRAINT \`FK_payment_order\` FOREIGN KEY (\`orderId\`) REFERENCES \`order\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
			);
		}

		await queryRunner.query(
			`ALTER TABLE \`commerce_cart\` ADD CONSTRAINT \`FK_commerce_cart_order\` FOREIGN KEY (\`orderId\`) REFERENCES \`order\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE \`commerce_cart\` DROP FOREIGN KEY \`FK_commerce_cart_order\``);

		if (await queryRunner.hasColumn('payment', 'orderId')) {
			await queryRunner.query(`ALTER TABLE \`payment\` DROP FOREIGN KEY \`FK_payment_order\``);
		}
	}

	/**
	 * Rebuilds a SQLite table with the order foreign key added.
	 *
	 * The table's own definition is read back from `sqlite_master`, the constraint is appended to it and
	 * the rebuilt table replaces the original. Reading the definition rather than restating it is what
	 * keeps this migration from drifting away from the table's actual shape.
	 *
	 * @param queryRunner The query runner.
	 * @param table The table to rebuild.
	 * @param columnFragment The column whose constraint is being added, used only for the diagnostics.
	 */
	private async rebuildSqliteTableWithOrderForeignKey(
		queryRunner: QueryRunner,
		table: string,
		columnFragment: string
	): Promise<void> {
		const definition = await this.sqliteDefinitionOf(queryRunner, table);

		if (!definition || definition.includes('FK_' + table + '_order')) {
			return;
		}

		const withConstraint = definition.replace(
			/\)\s*$/,
			`, CONSTRAINT "FK_${table}_order" FOREIGN KEY ("orderId") REFERENCES "order" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`
		);

		/*
		 * `legacy_alter_table` keeps this rebuild from rewriting other tables' definitions. Since SQLite
		 * 3.25 a `RENAME TO` also updates the foreign keys of tables that referenced the renamed one, so
		 * renaming this table aside left every referencing table pointing at `<table>_order_fk_backup`,
		 * which the last statement drops: the definitions stayed valid and every later write to one of
		 * those tables failed with "no such table: main.<table>_order_fk_backup". The pragma restores the
		 * behaviour this rebuild was written against and is reset immediately afterwards.
		 */
		await queryRunner.query(`PRAGMA legacy_alter_table = ON`);
		try {
			await queryRunner.query(`ALTER TABLE "${table}" RENAME TO "${table}_order_fk_backup"`);
			await queryRunner.query(withConstraint);
			await queryRunner.query(
				`INSERT INTO "${table}" SELECT * FROM "${table}_order_fk_backup"`
			);
			await queryRunner.query(`DROP TABLE "${table}_order_fk_backup"`);
		} finally {
			await queryRunner.query(`PRAGMA legacy_alter_table = OFF`);
		}

		console.log(chalk.gray(`Rebuilt ${table} with the order foreign key (${columnFragment}).`));
	}

	/**
	 * Rebuilds a SQLite table with the order foreign key removed.
	 *
	 * @param queryRunner The query runner.
	 * @param table The table to rebuild.
	 */
	private async rebuildSqliteTableWithoutOrderForeignKey(queryRunner: QueryRunner, table: string): Promise<void> {
		const definition = await this.sqliteDefinitionOf(queryRunner, table);

		if (!definition || !definition.includes('FK_' + table + '_order')) {
			return;
		}

		const withoutConstraint = definition.replace(
			new RegExp(`,\\s*CONSTRAINT "FK_${table}_order"[^)]*\\)\\s*\\)\\s*$`),
			')'
		);

		// The same `legacy_alter_table` guard as the rebuild above, for the same reason: without it the
		// rename rewrites other tables' foreign keys to name the backup this method is about to drop.
		await queryRunner.query(`PRAGMA legacy_alter_table = ON`);
		try {
			await queryRunner.query(`ALTER TABLE "${table}" RENAME TO "${table}_order_fk_backup"`);
			await queryRunner.query(withoutConstraint);
			await queryRunner.query(`INSERT INTO "${table}" SELECT * FROM "${table}_order_fk_backup"`);
			await queryRunner.query(`DROP TABLE "${table}_order_fk_backup"`);
		} finally {
			await queryRunner.query(`PRAGMA legacy_alter_table = OFF`);
		}
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
