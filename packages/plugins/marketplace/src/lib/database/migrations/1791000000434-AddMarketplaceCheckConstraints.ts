import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';
import { addCheckConstraint, dropCheckConstraint, ICheckConstraintDefinition } from '@gauzy/core';

/**
 * Adds the three rules the marketplace chapters state about a seller's money.
 *
 * ## Why a tick of its own
 *
 * `seller`, `seller_payout` and `seller_settlement` are created by
 * `1791000000380-CreateMarketplaceTables`, this package's first tick, and each rule here is about an
 * amount a later writer must not be able to contradict. The transaction row already carries its own
 * identity constraints, which that migration created with the table; these are the three that were
 * stated by the chapters and not yet created, which the gate
 * `tools/scripts/constraint-parity-check.mjs` reported as gaps.
 *
 * ## The rules
 *
 * **`CHK_seller_commission_range` — a commission rate is a fraction.** `defaultCommissionRate` is the
 * rate a seller's offerings inherit, and every rate in this domain is a fraction of the basis
 * (`seller_transaction.commissionRate` is constrained exactly this way), so a default of `10` meant as
 * "ten per cent" would charge ten times the basket. The column is nullable — a seller that inherits the
 * platform's rate states none — so the rule applies only when a rate is stated, and the basis that
 * involves no rate at all (`FIXED_PER_ITEM`) is unaffected because it reads its own fee column.
 *
 * **`CHK_seller_payout_total` — the instructed amount is the net less the fee and the reserve.** The
 * payout's `netAmount` is what the seller earned, `feeAmount` is what the provider charges to move it,
 * `reserveAmount` is what the agreement holds back, and `paidAmount` is what is actually instructed.
 * The four are computed together and the identity is exact decimal arithmetic on equal scales, which is
 * what makes a payout explainable after the fact rather than only reproducible.
 *
 * **`CHK_seller_settlement_net` — the provider's net is its gross less the commission and the fee.** The
 * settlement is the provider's own record of the transfer, reconciled against the platform's instruction;
 * an identity it does not obey is a discrepancy the reconciliation would have to invent a reason for.
 *
 * The three amounts are written by the payout and settlement services, which compute them from already
 * rounded values rather than re-deriving them, so the constraints hold by construction for every writer
 * and refuse a row that any other path produces.
 *
 * The probes, the dialect choice and the embedded dialect's documented no-op are the shared helper's;
 * this class states only what is being added.
 */
export class AddMarketplaceCheckConstraints1791000000434 implements MigrationInterface {
	name = 'AddMarketplaceCheckConstraints1791000000434';

	/** The three rules this tick carries. */
	private static readonly CONSTRAINTS: readonly ICheckConstraintDefinition[] = [
		{
			table: 'seller',
			name: 'CHK_seller_commission_range',
			columns: ['defaultCommissionRate'],
			postgres: `ALTER TABLE "seller" ADD CONSTRAINT "CHK_seller_commission_range" CHECK ("defaultCommissionRate" IS NULL OR ("defaultCommissionRate" >= 0 AND "defaultCommissionRate" <= 1))`,
			mysql: `ALTER TABLE \`seller\` ADD CONSTRAINT \`CHK_seller_commission_range\` CHECK (\`defaultCommissionRate\` IS NULL OR (\`defaultCommissionRate\` >= 0 AND \`defaultCommissionRate\` <= 1))`
		},
		{
			table: 'seller_payout',
			name: 'CHK_seller_payout_total',
			columns: ['netAmount', 'feeAmount', 'reserveAmount', 'paidAmount'],
			postgres: `ALTER TABLE "seller_payout" ADD CONSTRAINT "CHK_seller_payout_total" CHECK ("paidAmount" = "netAmount" - "feeAmount" - "reserveAmount")`,
			mysql: `ALTER TABLE \`seller_payout\` ADD CONSTRAINT \`CHK_seller_payout_total\` CHECK (\`paidAmount\` = \`netAmount\` - \`feeAmount\` - \`reserveAmount\`)`
		},
		{
			table: 'seller_settlement',
			name: 'CHK_seller_settlement_net',
			columns: ['netAmount', 'grossAmount', 'commissionAmount', 'feeAmount'],
			postgres: `ALTER TABLE "seller_settlement" ADD CONSTRAINT "CHK_seller_settlement_net" CHECK ("netAmount" = "grossAmount" - "commissionAmount" - "feeAmount")`,
			mysql: `ALTER TABLE \`seller_settlement\` ADD CONSTRAINT \`CHK_seller_settlement_net\` CHECK (\`netAmount\` = \`grossAmount\` - \`commissionAmount\` - \`feeAmount\`)`
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
		for (const constraint of AddMarketplaceCheckConstraints1791000000434.CONSTRAINTS) {
			await addCheckConstraint(queryRunner, constraint, this.name);
		}
	}

	/**
	 * Drops every rule this tick carries.
	 *
	 * @param queryRunner The runner the migration is executing on.
	 */
	private async dropAll(queryRunner: QueryRunner): Promise<void> {
		for (const constraint of AddMarketplaceCheckConstraints1791000000434.CONSTRAINTS) {
			await dropCheckConstraint(queryRunner, constraint);
		}
	}
}
