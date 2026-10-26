import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';
import { addCheckConstraint, dropCheckConstraint, ICheckConstraintDefinition } from '@gauzy/core';

/**
 * Adds the rules the returns chapter states about the two resolution line tables.
 *
 * ## Why a tick of its own
 *
 * `order_claim_line` and `order_exchange_line` are created by `1791000000300-CreateReturnTables`, this
 * package's first tick. Both are lines of a *resolution*: a claim asks for units to be replaced, an
 * exchange ships a replacement out. Neither is a sale, so neither goes through the cart — which is
 * exactly why the rule that a resolution line asks for a positive quantity has to be the table's own
 * rather than a writer's habit: the writers of these rows are the claim and exchange services, the
 * `CLAIM_RESOLVE` and `EXCHANGE_RESOLVE` operations and, on an import, whatever produced the file.
 *
 * ## The rules
 *
 * **`CHK_order_claim_line_positive` — a claim claims a positive quantity.** A claim line of zero would
 * put a line on a claim that asks for nothing, and the replacement allowance the claim is checked
 * against is computed from these quantities: a zero line would make the sum indifferent to a row that
 * exists, so a claim could grow without bound in rows while its total stayed put.
 *
 * **`CHK_order_exchange_line_positive` — an exchange ships a positive quantity.** An exchange line of
 * zero would reserve nothing outbound while still appearing as a line of the exchange, and the
 * reservation is what the outbound stock accounting is built from.
 *
 * Both services already refuse a non-positive line with a documented message; the constraints make the
 * rule the table's, so the same refusal happens on every path.
 *
 * The probes, the dialect choice and the embedded dialect's documented no-op are the shared helper's;
 * this class states only what is being added.
 */
export class AddReturnsLinePositiveChecks1791000000432 implements MigrationInterface {
	name = 'AddReturnsLinePositiveChecks1791000000432';

	/** The two rules this tick carries. */
	private static readonly CONSTRAINTS: readonly ICheckConstraintDefinition[] = [
		{
			table: 'order_claim_line',
			name: 'CHK_order_claim_line_positive',
			columns: ['quantity'],
			postgres: `ALTER TABLE "order_claim_line" ADD CONSTRAINT "CHK_order_claim_line_positive" CHECK ("quantity" > 0)`,
			mysql: `ALTER TABLE \`order_claim_line\` ADD CONSTRAINT \`CHK_order_claim_line_positive\` CHECK (\`quantity\` > 0)`
		},
		{
			table: 'order_exchange_line',
			name: 'CHK_order_exchange_line_positive',
			columns: ['quantity'],
			postgres: `ALTER TABLE "order_exchange_line" ADD CONSTRAINT "CHK_order_exchange_line_positive" CHECK ("quantity" > 0)`,
			mysql: `ALTER TABLE \`order_exchange_line\` ADD CONSTRAINT \`CHK_order_exchange_line_positive\` CHECK (\`quantity\` > 0)`
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
		for (const constraint of AddReturnsLinePositiveChecks1791000000432.CONSTRAINTS) {
			await addCheckConstraint(queryRunner, constraint, this.name);
		}
	}

	/**
	 * Drops every rule this tick carries.
	 *
	 * @param queryRunner The runner the migration is executing on.
	 */
	private async dropAll(queryRunner: QueryRunner): Promise<void> {
		for (const constraint of AddReturnsLinePositiveChecks1791000000432.CONSTRAINTS) {
			await dropCheckConstraint(queryRunner, constraint);
		}
	}
}
