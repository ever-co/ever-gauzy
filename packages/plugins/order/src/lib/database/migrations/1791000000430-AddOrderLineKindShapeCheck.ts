import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';
import { addCheckConstraint, dropCheckConstraint, ICheckConstraintDefinition } from '@gauzy/core';

/**
 * Adds the rule the order chapter states about a line that is not a line.
 *
 * ## Why a tick of its own
 *
 * `order_line` is created by `1791000000220-CreateOrderTables`, this package's first tick. The `kind`
 * column exists for a reason: an order carries lines that are not things that were sold — a rounding
 * line, a note, a placeholder for a bundle's parent — and those lines must not carry a quantity, a price
 * or a product, because every figure computed over the order's lines would otherwise pick up a line that
 * never existed. Stating the rule here, rather than leaving it to the writers, is what holds an import, a
 * seed and a manual correction to it as well.
 *
 * ## The rule
 *
 * **`CHK_order_line_kind_shape` — a line of any other kind than `ITEM` has no quantity, no price and no
 * product or variant.** `quantity = 0 AND unitPrice = 0` rather than merely "empty": a line that carries
 * a zero is a line that took part in the arithmetic and contributed nothing, which is exactly what a
 * non-item line is, and a NULL would leave every sum over the lines undefined instead.
 *
 * The rule is stated as an implication from the kind rather than as a list of forbidden kinds, so a kind
 * added later is a real line until it says otherwise; the failure mode of the other direction is an order
 * whose new kind of line silently carries no quantity.
 *
 * The probes, the dialect choice and the embedded dialect's documented no-op are the shared helper's;
 * this class states only what is being added.
 */
export class AddOrderLineKindShapeCheck1791000000430 implements MigrationInterface {
	name = 'AddOrderLineKindShapeCheck1791000000430';

	/** The one rule this tick carries. */
	private static readonly CONSTRAINTS: readonly ICheckConstraintDefinition[] = [
		{
			table: 'order_line',
			name: 'CHK_order_line_kind_shape',
			columns: ['kind', 'quantity', 'unitPrice', 'productId', 'variantId'],
			postgres: `ALTER TABLE "order_line" ADD CONSTRAINT "CHK_order_line_kind_shape" CHECK ("kind" = 'ITEM' OR ("quantity" = 0 AND "unitPrice" = 0 AND "productId" IS NULL AND "variantId" IS NULL))`,
			mysql: `ALTER TABLE \`order_line\` ADD CONSTRAINT \`CHK_order_line_kind_shape\` CHECK (\`kind\` = 'ITEM' OR (\`quantity\` = 0 AND \`unitPrice\` = 0 AND \`productId\` IS NULL AND \`variantId\` IS NULL))`
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
		for (const constraint of AddOrderLineKindShapeCheck1791000000430.CONSTRAINTS) {
			await addCheckConstraint(queryRunner, constraint, this.name);
		}
	}

	/**
	 * Drops every rule this tick carries.
	 *
	 * @param queryRunner The runner the migration is executing on.
	 */
	private async dropAll(queryRunner: QueryRunner): Promise<void> {
		for (const constraint of AddOrderLineKindShapeCheck1791000000430.CONSTRAINTS) {
			await dropCheckConstraint(queryRunner, constraint);
		}
	}
}
