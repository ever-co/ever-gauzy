import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/** The table the reservation belongs to. */
const SUBSCRIPTION_TABLE = 'subscription';

/** The plan a mid-cycle change is moving a subscription onto, while the change is being settled. */
const RESERVED_PLAN_COLUMN = 'reservedPlanId';

/** The index a plan update's live-subscription check reads the reservations of a plan by. */
const RESERVED_PLAN_INDEX = 'IDX_subscription_reserved_plan';

/**
 * Adds the plan reservation to the subscription table: the column a mid-cycle change reserves the plan it moves to in.
 *
 * A plan change settles before it moves the subscription — a charge through the order path, or a `CREDIT` adjustment —
 * and a plan update could count no live subscription meanwhile and deactivate the plan, or re-price it in another
 * currency, under a change that had already been paid for. The change now writes the plan's id here, with its record,
 * under the plan row's lock before anything is settled (`SubscriptionService.reserveChange`), and the write that moves
 * the subscription or releases the change clears it; `SubscriptionPlanService.hasLiveSubscriptions` counts it. The
 * column is nullable and starts empty: no existing subscription is being moved by a change that has not yet written one.
 * The index serves that count, which asks for the subscriptions reserving one plan.
 *
 * Every statement is guarded, because this migration can meet a database that already carries what it adds: an
 * installation that has run a later release, a database restored from one, or this migration re-run after an
 * interrupted release. The column and the index are each probed before they are named, so a re-run issues no DDL at
 * all.
 *
 * All three dialects are written by hand, with the type the platform gives the table's `planId` in each, and the down
 * migration reverses the statements in the opposite order — an index cannot outlive the column it indexes.
 */
export class AddSubscriptionReservedPlan1791000003540 implements MigrationInterface {
	name = 'AddSubscriptionReservedPlan1791000003540';

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
		if (!(await queryRunner.hasTable(SUBSCRIPTION_TABLE))) {
			return;
		}

		if (!(await queryRunner.hasColumn(SUBSCRIPTION_TABLE, RESERVED_PLAN_COLUMN))) {
			await queryRunner.query(`ALTER TABLE "subscription" ADD COLUMN "reservedPlanId" uuid`);
		}

		if (!(await this.hasReservedPlanIndex(queryRunner))) {
			await queryRunner.query(`CREATE INDEX "IDX_subscription_reserved_plan" ON "subscription" ("reservedPlanId")`);
		}
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		if (!(await queryRunner.hasTable(SUBSCRIPTION_TABLE))) {
			return;
		}

		if (await this.hasReservedPlanIndex(queryRunner)) {
			await queryRunner.query(`DROP INDEX "IDX_subscription_reserved_plan"`);
		}

		if (await queryRunner.hasColumn(SUBSCRIPTION_TABLE, RESERVED_PLAN_COLUMN)) {
			await queryRunner.query(`ALTER TABLE "subscription" DROP COLUMN "reservedPlanId"`);
		}
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * SQLite adds a nullable column with no default to an existing table in place, so the table is not rebuilt and the
	 * subscriptions it holds, their constraints and their indexes are left exactly as they are.
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		if (!(await queryRunner.hasTable(SUBSCRIPTION_TABLE))) {
			return;
		}

		if (!(await queryRunner.hasColumn(SUBSCRIPTION_TABLE, RESERVED_PLAN_COLUMN))) {
			await queryRunner.query(`ALTER TABLE "subscription" ADD COLUMN "reservedPlanId" varchar`);
		}

		if (!(await this.hasReservedPlanIndex(queryRunner))) {
			await queryRunner.query(`CREATE INDEX "IDX_subscription_reserved_plan" ON "subscription" ("reservedPlanId")`);
		}
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		if (!(await queryRunner.hasTable(SUBSCRIPTION_TABLE))) {
			return;
		}

		if (await this.hasReservedPlanIndex(queryRunner)) {
			await queryRunner.query(`DROP INDEX "IDX_subscription_reserved_plan"`);
		}

		if (await queryRunner.hasColumn(SUBSCRIPTION_TABLE, RESERVED_PLAN_COLUMN)) {
			await queryRunner.query(`ALTER TABLE "subscription" DROP COLUMN "reservedPlanId"`);
		}
	}

	/**
	 * MySQL Up Migration
	 *
	 * The index is created after the column and only when it is not already there, because MySQL has no
	 * `CREATE INDEX IF NOT EXISTS` and a re-run that named an existing index would abort the migration rather than leave
	 * the database as it found it.
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		if (!(await queryRunner.hasTable(SUBSCRIPTION_TABLE))) {
			return;
		}

		if (!(await queryRunner.hasColumn(SUBSCRIPTION_TABLE, RESERVED_PLAN_COLUMN))) {
			await queryRunner.query(`ALTER TABLE \`subscription\` ADD COLUMN \`reservedPlanId\` varchar(36) NULL`);
		}

		if (!(await this.hasReservedPlanIndex(queryRunner))) {
			await queryRunner.query(
				`CREATE INDEX \`IDX_subscription_reserved_plan\` ON \`subscription\` (\`reservedPlanId\`)`
			);
		}
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		if (!(await queryRunner.hasTable(SUBSCRIPTION_TABLE))) {
			return;
		}

		if (await this.hasReservedPlanIndex(queryRunner)) {
			await queryRunner.query(`DROP INDEX \`IDX_subscription_reserved_plan\` ON \`subscription\``);
		}

		if (await queryRunner.hasColumn(SUBSCRIPTION_TABLE, RESERVED_PLAN_COLUMN)) {
			await queryRunner.query(`ALTER TABLE \`subscription\` DROP COLUMN \`reservedPlanId\``);
		}
	}

	/**
	 * Whether the reservation index is already there.
	 *
	 * The catalogue is asked rather than the dialect: the dialects this platform runs disagree about whether an index can
	 * be created or dropped conditionally, and the table's own index list is the one answer all three give.
	 *
	 * @param queryRunner The query runner.
	 * @returns True when the index exists.
	 */
	private async hasReservedPlanIndex(queryRunner: QueryRunner): Promise<boolean> {
		const table = await queryRunner.getTable(SUBSCRIPTION_TABLE);

		return (table?.indices ?? []).some((index) => index.name === RESERVED_PLAN_INDEX);
	}
}
