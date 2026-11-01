import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/** The table the charge claim belongs to. */
const SUBSCRIPTION_BILLING_TABLE = 'subscription_billing';

/** The token of the billing pass charging a cycle right now. */
const CLAIM_TOKEN_COLUMN = 'chargeClaimToken';

/** When that pass took its claim. */
const CLAIMED_AT_COLUMN = 'chargeClaimedAt';

/**
 * Adds the charge claim to the billing-cycle table: the two columns a billing pass fences a cycle's charge with.
 *
 * A billing pass calls the order path to charge a cycle, and an operator could pay or waive the same cycle while that
 * call was in flight; the conflict was only noticed after the money was taken. The pass now writes a token and the
 * instant on the cycle before it calls the order path (`SubscriptionBillingService.claimCharge`), and the settling
 * actions refuse a cycle whose claim is live. Both columns are nullable and start empty: no existing cycle is being
 * charged by a pass that has not yet written one, and an empty claim is the state every write that ends a claim leaves.
 * Nothing reads the columns except by the cycle's id, so no index is added.
 *
 * Every statement is guarded, because this migration can meet a database that already carries what it adds: an
 * installation that has run a later release, a database restored from one, or this migration re-run after an
 * interrupted release. Each column is probed before it is named, so a re-run issues no DDL at all.
 *
 * All three dialects are written by hand, with the types the platform gives the table's other columns of the same kind
 * (`createdByUserId`'s width for the token, `paidAt`'s type for the instant), and the down migration drops the columns
 * in the opposite order.
 */
export class AddSubscriptionBillingChargeClaim1791000003520 implements MigrationInterface {
	name = 'AddSubscriptionBillingChargeClaim1791000003520';

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
		if (!(await queryRunner.hasTable(SUBSCRIPTION_BILLING_TABLE))) {
			return;
		}

		if (!(await queryRunner.hasColumn(SUBSCRIPTION_BILLING_TABLE, CLAIM_TOKEN_COLUMN))) {
			await queryRunner.query(`ALTER TABLE "subscription_billing" ADD COLUMN "chargeClaimToken" character varying(36)`);
		}

		if (!(await queryRunner.hasColumn(SUBSCRIPTION_BILLING_TABLE, CLAIMED_AT_COLUMN))) {
			await queryRunner.query(`ALTER TABLE "subscription_billing" ADD COLUMN "chargeClaimedAt" TIMESTAMP`);
		}
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		if (!(await queryRunner.hasTable(SUBSCRIPTION_BILLING_TABLE))) {
			return;
		}

		if (await queryRunner.hasColumn(SUBSCRIPTION_BILLING_TABLE, CLAIMED_AT_COLUMN)) {
			await queryRunner.query(`ALTER TABLE "subscription_billing" DROP COLUMN "chargeClaimedAt"`);
		}

		if (await queryRunner.hasColumn(SUBSCRIPTION_BILLING_TABLE, CLAIM_TOKEN_COLUMN)) {
			await queryRunner.query(`ALTER TABLE "subscription_billing" DROP COLUMN "chargeClaimToken"`);
		}
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * SQLite adds a nullable column with no default to an existing table in place, so the table is not rebuilt and the
	 * cycles it holds, their constraints and their indexes are left exactly as they are.
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		if (!(await queryRunner.hasTable(SUBSCRIPTION_BILLING_TABLE))) {
			return;
		}

		if (!(await queryRunner.hasColumn(SUBSCRIPTION_BILLING_TABLE, CLAIM_TOKEN_COLUMN))) {
			await queryRunner.query(`ALTER TABLE "subscription_billing" ADD COLUMN "chargeClaimToken" varchar(36)`);
		}

		if (!(await queryRunner.hasColumn(SUBSCRIPTION_BILLING_TABLE, CLAIMED_AT_COLUMN))) {
			await queryRunner.query(`ALTER TABLE "subscription_billing" ADD COLUMN "chargeClaimedAt" datetime`);
		}
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		if (!(await queryRunner.hasTable(SUBSCRIPTION_BILLING_TABLE))) {
			return;
		}

		if (await queryRunner.hasColumn(SUBSCRIPTION_BILLING_TABLE, CLAIMED_AT_COLUMN)) {
			await queryRunner.query(`ALTER TABLE "subscription_billing" DROP COLUMN "chargeClaimedAt"`);
		}

		if (await queryRunner.hasColumn(SUBSCRIPTION_BILLING_TABLE, CLAIM_TOKEN_COLUMN)) {
			await queryRunner.query(`ALTER TABLE "subscription_billing" DROP COLUMN "chargeClaimToken"`);
		}
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		if (!(await queryRunner.hasTable(SUBSCRIPTION_BILLING_TABLE))) {
			return;
		}

		if (!(await queryRunner.hasColumn(SUBSCRIPTION_BILLING_TABLE, CLAIM_TOKEN_COLUMN))) {
			await queryRunner.query(`ALTER TABLE \`subscription_billing\` ADD COLUMN \`chargeClaimToken\` varchar(36) NULL`);
		}

		if (!(await queryRunner.hasColumn(SUBSCRIPTION_BILLING_TABLE, CLAIMED_AT_COLUMN))) {
			await queryRunner.query(`ALTER TABLE \`subscription_billing\` ADD COLUMN \`chargeClaimedAt\` datetime NULL`);
		}
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		if (!(await queryRunner.hasTable(SUBSCRIPTION_BILLING_TABLE))) {
			return;
		}

		if (await queryRunner.hasColumn(SUBSCRIPTION_BILLING_TABLE, CLAIMED_AT_COLUMN)) {
			await queryRunner.query(`ALTER TABLE \`subscription_billing\` DROP COLUMN \`chargeClaimedAt\``);
		}

		if (await queryRunner.hasColumn(SUBSCRIPTION_BILLING_TABLE, CLAIM_TOKEN_COLUMN)) {
			await queryRunner.query(`ALTER TABLE \`subscription_billing\` DROP COLUMN \`chargeClaimToken\``);
		}
	}
}
