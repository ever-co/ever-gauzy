import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';
import { addCheckConstraint, dropCheckConstraint, ICheckConstraintDefinition } from '@gauzy/core';

/**
 * Adds the two rules the promotion chapter states about a promotion action and a gift card.
 *
 * ## Why a tick of its own
 *
 * `promotion_action` and `gift_card` are created by `1791000000260-CreatePromotionTables`, this
 * package's first tick, and both rules are about a value a later writer must not be able to corrupt.
 *
 * ## The rules
 *
 * **`CHK_promotion_action_percent_range` — a percentage is greater than zero and at most 100.** The
 * platform states percentages on the whole-number scale (`product_price.percent` is constrained the same
 * way, and the discount computation divides by 100), so a value of `0.1` meant as "ten per cent" would be
 * a tenth of a per cent and a value of `500` would discount five times the basket. The service refuses
 * both with `ACTION_TIERS_INVALID`; the constraint states the rule for the types where it applies and
 * leaves the other types alone, because the same column carries a fixed amount, a bundle price and a
 * free-item count, where the range means nothing. The type test is written as a list of the two
 * percentage types rather than of everything else, so a type added later is unconstrained by this rule
 * until its own scale is stated.
 *
 * **`CHK_gift_card_balance_nonneg` — a stored-value balance is never negative.** The balance is a
 * materialised cache of the card's ledger, and an over-redemption is impossible on the redemption path
 * because it locks the card row and re-reads the balance before it debits it — but that is a property of
 * one writer, and a card whose cached balance went negative would be a card the platform would happily
 * spend more against. The rule makes "a card never owes the platform" the table's own statement, and the
 * redemption path's refusal (`GIFT_CARD_INSUFFICIENT_BALANCE`) is what a caller sees when it is reached.
 *
 * The probes, the dialect choice and the embedded dialect's documented no-op are the shared helper's;
 * this class states only what is being added.
 */
export class AddPromotionCheckConstraints1791000000433 implements MigrationInterface {
	name = 'AddPromotionCheckConstraints1791000000433';

	/** The two rules this tick carries. */
	private static readonly CONSTRAINTS: readonly ICheckConstraintDefinition[] = [
		{
			table: 'promotion_action',
			name: 'CHK_promotion_action_percent_range',
			columns: ['type', 'value'],
			postgres: `ALTER TABLE "promotion_action" ADD CONSTRAINT "CHK_promotion_action_percent_range" CHECK ("type" NOT IN ('PERCENTAGE', 'TIERED_PERCENTAGE') OR ("value" > 0 AND "value" <= 100))`,
			mysql: `ALTER TABLE \`promotion_action\` ADD CONSTRAINT \`CHK_promotion_action_percent_range\` CHECK (\`type\` NOT IN ('PERCENTAGE', 'TIERED_PERCENTAGE') OR (\`value\` > 0 AND \`value\` <= 100))`
		},
		{
			table: 'gift_card',
			name: 'CHK_gift_card_balance_nonneg',
			columns: ['balance'],
			postgres: `ALTER TABLE "gift_card" ADD CONSTRAINT "CHK_gift_card_balance_nonneg" CHECK ("balance" >= 0)`,
			mysql: `ALTER TABLE \`gift_card\` ADD CONSTRAINT \`CHK_gift_card_balance_nonneg\` CHECK (\`balance\` >= 0)`
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
		for (const constraint of AddPromotionCheckConstraints1791000000433.CONSTRAINTS) {
			await addCheckConstraint(queryRunner, constraint, this.name);
		}
	}

	/**
	 * Drops every rule this tick carries.
	 *
	 * @param queryRunner The runner the migration is executing on.
	 */
	private async dropAll(queryRunner: QueryRunner): Promise<void> {
		for (const constraint of AddPromotionCheckConstraints1791000000433.CONSTRAINTS) {
			await dropCheckConstraint(queryRunner, constraint);
		}
	}
}
