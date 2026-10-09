import { MigrationInterface, QueryRunner } from 'typeorm';
import { DatabaseTypeEnum } from '@gauzy/config';
import * as chalk from 'chalk';

export class AddDailyPlanEmployeeTeamDateIndex1790000023000 implements MigrationInterface {
	name = 'AddDailyPlanEmployeeTeamDateIndex1790000023000';

	/**
	 * Up Migration
	 *
	 * Adds a composite index on `daily_plan (employeeId, organizationTeamId, date)`, the name the
	 * `DailyPlan` entity declares. Creating a plan looks up the employee's plan for that day in that
	 * team, and removing a task from upcoming plans reads the employee's plans from today on. `date`
	 * had no index at all, so both lookups read every plan the employee ever had and filtered on the
	 * date afterwards.
	 *
	 * NOTE: On existing large deployments, create the index out-of-band first with
	 * `CREATE INDEX CONCURRENTLY` (the Postgres/SQLite branches use `IF NOT EXISTS`, so this migration
	 * is then a no-op for them), so the in-transaction build does not hold a write lock on `daily_plan`.
	 *
	 * @param queryRunner
	 */
	public async up(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' start running!'));

		switch (queryRunner.connection.options.type as DatabaseTypeEnum) {
			case DatabaseTypeEnum.sqlite:
			case DatabaseTypeEnum.betterSqlite3:
			case DatabaseTypeEnum.postgres:
				// Both accept double-quoted identifiers and `IF NOT EXISTS`.
				await queryRunner.query(
					`CREATE INDEX IF NOT EXISTS "IDX_daily_plan_employee_team_date" ON "daily_plan" ("employeeId", "organizationTeamId", "date")`
				);
				break;
			case DatabaseTypeEnum.mysql:
				// MySQL has no `CREATE INDEX ... IF NOT EXISTS`, and is not part of the out-of-band path.
				await queryRunner.query(
					`CREATE INDEX \`IDX_daily_plan_employee_team_date\` ON \`daily_plan\` (\`employeeId\`, \`organizationTeamId\`, \`date\`)`
				);
				break;
			default:
				throw new Error(`Unsupported database: ${queryRunner.connection.options.type}`);
		}
	}

	/**
	 * Down Migration
	 *
	 * @param queryRunner
	 */
	public async down(queryRunner: QueryRunner): Promise<void> {
		switch (queryRunner.connection.options.type as DatabaseTypeEnum) {
			case DatabaseTypeEnum.sqlite:
			case DatabaseTypeEnum.betterSqlite3:
			case DatabaseTypeEnum.postgres:
				await queryRunner.query(`DROP INDEX IF EXISTS "IDX_daily_plan_employee_team_date"`);
				break;
			case DatabaseTypeEnum.mysql:
				await queryRunner.query(`DROP INDEX \`IDX_daily_plan_employee_team_date\` ON \`daily_plan\``);
				break;
			default:
				throw new Error(`Unsupported database: ${queryRunner.connection.options.type}`);
		}
	}
}
