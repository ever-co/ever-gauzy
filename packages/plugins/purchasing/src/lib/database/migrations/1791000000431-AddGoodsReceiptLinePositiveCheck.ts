import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';
import { addCheckConstraint, dropCheckConstraint, ICheckConstraintDefinition } from '@gauzy/core';

/**
 * Adds the rule the purchasing chapter states about a receipt line.
 *
 * ## Why a tick of its own
 *
 * `goods_receipt_line` is created by `1791000000340-CreatePurchasingTables`, this package's first tick.
 * The receipt is what turns an order into stock: a line of it records what arrived, and what arrived
 * damaged. A line that recorded neither is a line that says a delivery happened and describes nothing —
 * it would move no stock, produce no `RECEIPT` or `DAMAGE` movement, and still count as a received line
 * against the purchase order's counters, so the order would report itself fulfilled by a receipt that
 * brought nothing. The service already refuses such a line; stating the rule on the table as well is what
 * holds a bulk import, a seed and a manual correction to it.
 *
 * ## The rule
 *
 * **`CHK_goods_receipt_line_positive` — `quantity + damagedQuantity > 0`.** The two are counted together
 * because both are units that arrived: damaged units are received into quarantine rather than into
 * sellable stock, and a receipt of nothing but damaged units is still a receipt. The sum is strictly
 * greater than zero, not merely non-negative, because zero of each is the case the rule exists to refuse.
 *
 * The probes, the dialect choice and the embedded dialect's documented no-op are the shared helper's;
 * this class states only what is being added.
 */
export class AddGoodsReceiptLinePositiveCheck1791000000431 implements MigrationInterface {
	name = 'AddGoodsReceiptLinePositiveCheck1791000000431';

	/** The one rule this tick carries. */
	private static readonly CONSTRAINTS: readonly ICheckConstraintDefinition[] = [
		{
			table: 'goods_receipt_line',
			name: 'CHK_goods_receipt_line_positive',
			columns: ['quantity', 'damagedQuantity'],
			postgres: `ALTER TABLE "goods_receipt_line" ADD CONSTRAINT "CHK_goods_receipt_line_positive" CHECK ("quantity" + "damagedQuantity" > 0)`,
			mysql: `ALTER TABLE \`goods_receipt_line\` ADD CONSTRAINT \`CHK_goods_receipt_line_positive\` CHECK (\`quantity\` + \`damagedQuantity\` > 0)`
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
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.addAll(queryRunner);
	}

	/**
	 * SqliteDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.dropAll(queryRunner);
	}

	/**
	 * PostgresDB Up Migration
	 *
	 * @param queryRunner
	 */
	public async postgresUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.addAll(queryRunner);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.dropAll(queryRunner);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.addAll(queryRunner);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.dropAll(queryRunner);
	}

	/**
	 * Adds every rule this tick carries.
	 *
	 * @param queryRunner The runner the migration is executing on.
	 */
	private async addAll(queryRunner: QueryRunner): Promise<void> {
		for (const constraint of AddGoodsReceiptLinePositiveCheck1791000000431.CONSTRAINTS) {
			await addCheckConstraint(queryRunner, constraint, this.name);
		}
	}

	/**
	 * Drops every rule this tick carries.
	 *
	 * @param queryRunner The runner the migration is executing on.
	 */
	private async dropAll(queryRunner: QueryRunner): Promise<void> {
		for (const constraint of AddGoodsReceiptLinePositiveCheck1791000000431.CONSTRAINTS) {
			await dropCheckConstraint(queryRunner, constraint);
		}
	}
}
