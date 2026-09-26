import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * Adds the two payout-account constraints the marketplace's own DDL deliberately deferred.
 *
 * ## Why they were deferred, and why they are added here
 *
 * `1791000000380-CreateMarketplaceTables` creates every reference onto a table this package does not
 * own as an **indexed column without a constraint** — `order`, `order_line`, `order_transaction`,
 * `refund`, `product_price` and the kernel's `payment_account_holder`. That is the programme's
 * convention for a cross-package reference: the constraint belongs to the migration that owns the
 * target, so a package set that is still being assembled can run in any order, and the referencing
 * migration states that it is waiting rather than assuming.
 *
 * The kernel tables arrived in `1791000000125-CreatePaymentInstrumentTables`, which runs long before
 * this package's set, so the two columns below now have a target and the constraints can exist. They are
 * added here rather than by editing the creating migration: a migration that has already run must not
 * change, or an installation that ran it keeps the schema its own run produced.
 *
 * ## What each one means
 *
 * Both are `RESTRICT`, and that is the point of the marketplace's payout model rather than a default:
 * a settlement is evidence that money left, so the account it names is not deletable, and a seller whose
 * payout account is referenced cannot lose the row that says where its money goes. A payout is built
 * only for a seller whose account holder is `ACTIVE` — the service enforces that — so the constraint's
 * job is to keep the destination from disappearing, not to judge whether it may be paid.
 *
 * ## Dialects
 *
 * PostgreSQL and MySQL add the constraints, each probed so a re-run and an installation that already has
 * them are both no-ops. SQLite cannot add a constraint to an existing table, so that branch is
 * deliberately empty and this is stated rather than silently skipped: a SQLite installation created by
 * these migrations carries the two columns unconstrained, exactly as the creating migration left them.
 */
export class AddSellerPayoutAccountForeignKeys1791000000420 implements MigrationInterface {
	name = 'AddSellerPayoutAccountForeignKeys1791000000420';

	/**
	 * The two references, each with the constraint name it is known by and the delete action the
	 * marketplace's model requires.
	 */
	private static readonly REFERENCES: ReadonlyArray<{
		readonly table: string;
		readonly column: string;
		readonly constraint: string;
		readonly target: string;
	}> = [
		{
			table: 'seller',
			column: 'payoutAccountHolderId',
			constraint: 'FK_seller_payout_account',
			target: 'payment_account_holder'
		},
		{
			table: 'seller_settlement',
			column: 'payoutAccountHolderId',
			constraint: 'FK_seller_settlement_payout_account',
			target: 'payment_account_holder'
		}
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
	 * SQLite cannot add a constraint to an existing table, so there is nothing this migration can do on
	 * that dialect: the two columns stay exactly as `1791000000380-CreateMarketplaceTables` created them.
	 * The method exists, rather than the branch being folded into `up`, because every migration in this
	 * platform declares one per dialect and a reader has to be able to see that SQLite was considered
	 * rather than forgotten.
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		console.log(
			chalk.yellow(`${this.name}: SQLite cannot add a constraint to an existing table; nothing to do.`)
		);
	}

	/**
	 * SqliteDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		// Nothing was added, so there is nothing to drop.
	}

	/**
	 * PostgresDB Up Migration
	 *
	 * @param queryRunner
	 */
	public async postgresUpQueryRunner(queryRunner: QueryRunner): Promise<any> {		for (const reference of AddSellerPayoutAccountForeignKeys1791000000420.REFERENCES) {
			if (!(await queryRunner.hasTable(reference.table))) continue;
			if (!(await queryRunner.hasColumn(reference.table, reference.column))) continue;
			if (!(await queryRunner.hasTable(reference.target))) continue;
			if (await this.hasConstraint(queryRunner, reference.table, reference.constraint)) continue;

			await queryRunner.query(
				`ALTER TABLE "${reference.table}" ADD CONSTRAINT "${reference.constraint}" FOREIGN KEY ("${reference.column}") REFERENCES "${reference.target}"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`
			);
		}
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.dropConstraints(queryRunner, '"');
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		for (const reference of AddSellerPayoutAccountForeignKeys1791000000420.REFERENCES) {
			if (!(await queryRunner.hasTable(reference.table))) continue;
			if (!(await queryRunner.hasColumn(reference.table, reference.column))) continue;
			if (!(await queryRunner.hasTable(reference.target))) continue;
			if (await this.hasConstraint(queryRunner, reference.table, reference.constraint)) continue;

			await queryRunner.query(
				`ALTER TABLE \`${reference.table}\` ADD CONSTRAINT \`${reference.constraint}\` FOREIGN KEY (\`${reference.column}\`) REFERENCES \`${reference.target}\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`
			);
		}
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.dropConstraints(queryRunner, '`');
	}

	/**
	 * Whether a table already carries a constraint of a given name.
	 *
	 * `QueryRunner.hasConstraint` exists in a newer TypeORM than the one pinned here, so the catalogue is
	 * read through a query each dialect understands — the same reason the platform's other conditional
	 * migrations probe for themselves.
	 *
	 * @param queryRunner The runner the migration is executing on.
	 * @param table The table to inspect.
	 * @param name The constraint name.
	 * @returns Whether the constraint is already there.
	 */
	private async hasConstraint(queryRunner: QueryRunner, table: string, name: string): Promise<boolean> {
		const type = queryRunner.connection.options.type as DatabaseTypeEnum;

		const sql =
			type === DatabaseTypeEnum.mysql
				? `SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = ?`
				: `SELECT constraint_name FROM information_schema.table_constraints WHERE table_name = $1 AND constraint_name = $2`;

		const rows = await queryRunner.query(sql, [table, name]);

		return Array.isArray(rows) && rows.length > 0;
	}

	/**
	 * Drops the constraints this migration added.
	 *
	 * @param queryRunner The runner the migration is executing on.
	 * @param quote The dialect's identifier quote.
	 */
	private async dropConstraints(queryRunner: QueryRunner, quote: string): Promise<void> {
		for (const reference of AddSellerPayoutAccountForeignKeys1791000000420.REFERENCES) {
			if (!(await queryRunner.hasTable(reference.table))) continue;
			if (!(await this.hasConstraint(queryRunner, reference.table, reference.constraint))) continue;

			await queryRunner.query(
				`ALTER TABLE ${quote}${reference.table}${quote} DROP CONSTRAINT ${quote}${reference.constraint}${quote}`
			);
		}
	}
}
