import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * Stamps the scope on the stock rows that were written without one.
 *
 * ## Why this migration exists
 *
 * A stock level and the movement that explains it are both read through tenant-scoped queries — the
 * availability lookups filter on `tenantId`, and the ledger, the bin reads and the reconciliation all
 * do the same. The write path created both rows without a tenant and without an organization: the
 * level was created from its aggregate but copied nothing across, and the movement was created from the
 * level. The aggregate itself was stamped, because the product it belongs to is.
 *
 * The consequence was invisible on a single-tenant installation and wrong on every other one: a level
 * row that no scoped read can see, a movement no ledger reports, and a reconciliation that compares two
 * figures and calls the difference drift. The write path is fixed in `StockLevelService` — new rows
 * carry the aggregate's scope — and this migration repairs the rows that were written before it.
 *
 * ## What it does
 *
 * Both tables take their scope from the `warehouse_product` aggregate they name, which is the same
 * source the fixed write path reads it from. The statements are correlated subqueries rather than an
 * `UPDATE … FROM`, because all three dialects in this platform accept the correlated form and MySQL's
 * multi-table update is not one of them. Only rows that are **missing** a scope are touched, so a row an
 * operator stamped by hand keeps what it carries, and a re-run is a no-op.
 *
 * ## Reversal
 *
 * There is nothing to reverse. A backfill that fills a column from the row's own parent is not a change
 * of meaning: the value it writes is the value the row always meant, and the rows it skips are the ones
 * already carrying it. `down` is therefore a documented no-op, as every data-only migration in this
 * platform is.
 */
export class BackfillStockRowScope1791000000405 implements MigrationInterface {
	name = 'BackfillStockRowScope1791000000405';

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
		// Nothing to reverse: the value written is the value the row always meant. See the class comment.
	}

	/**
	 * PostgresDB Up Migration
	 *
	 * @param queryRunner
	 */
	public async postgresUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.backfill(queryRunner, '"', '"');
	}

	/**
	 * SqliteDB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.backfill(queryRunner, '"', '"');
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.backfill(queryRunner, '`', '`');
	}

	/**
	 * Fills the scope of both stock tables from the aggregate they name.
	 *
	 * @param queryRunner The runner the migration is executing on.
	 * @param open The dialect's identifier quote.
	 * @param close The dialect's closing identifier quote.
	 */
	private async backfill(queryRunner: QueryRunner, open: string, close: string): Promise<void> {
		const tables = [
			{ table: 'stock_movement', aggregateColumn: 'warehouseProductId' },
			{ table: 'warehouse_product_variant', aggregateColumn: 'warehouseProductId' }
		];

		for (const { table, aggregateColumn } of tables) {
			if (!(await queryRunner.hasTable(table))) {
				continue;
			}
			if (!(await queryRunner.hasColumn(table, 'tenantId'))) {
				continue;
			}

			const quote = (name: string) => `${open}${name}${close}`;

			await queryRunner.query(
				`UPDATE ${quote(table)} SET ` +
					`${quote('tenantId')} = (SELECT ${quote('tenantId')} FROM ${quote('warehouse_product')} ` +
					`WHERE ${quote('warehouse_product')}.${quote('id')} = ${quote(table)}.${quote(aggregateColumn)}), ` +
					`${quote('organizationId')} = (SELECT ${quote('organizationId')} FROM ${quote('warehouse_product')} ` +
					`WHERE ${quote('warehouse_product')}.${quote('id')} = ${quote(table)}.${quote(aggregateColumn)}) ` +
					`WHERE ${quote('tenantId')} IS NULL AND ${quote(aggregateColumn)} IS NOT NULL`
			);
		}
	}
}
