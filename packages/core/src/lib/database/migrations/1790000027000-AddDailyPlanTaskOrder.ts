import { MigrationInterface, QueryRunner } from 'typeorm';
import { DatabaseTypeEnum } from '@gauzy/config';
import * as chalk from 'chalk';

/**
 * The statements that add and drop `daily_plan.taskOrder` on the current database. The type matches the
 * entity: `jsonb` on Postgres, `json` elsewhere (TypeORM and MikroORM both (de)serialize a `json` column
 * on SQLite, where it is stored as text). SQLite accepts a nullable `ADD COLUMN` in place, so the table
 * is not rebuilt, and its `DROP COLUMN` needs 3.35 or later, which the bundled better-sqlite3 ships.
 *
 * @param queryRunner
 */
function taskOrderStatements(queryRunner: QueryRunner): { add: string; drop: string } {
	const type = queryRunner.connection.options.type as DatabaseTypeEnum;
	switch (type) {
		case DatabaseTypeEnum.postgres:
			return {
				add: `ALTER TABLE "daily_plan" ADD "taskOrder" jsonb`,
				drop: `ALTER TABLE "daily_plan" DROP COLUMN "taskOrder"`
			};
		case DatabaseTypeEnum.sqlite:
		case DatabaseTypeEnum.betterSqlite3:
			return {
				add: `ALTER TABLE "daily_plan" ADD COLUMN "taskOrder" json`,
				drop: `ALTER TABLE "daily_plan" DROP COLUMN "taskOrder"`
			};
		case DatabaseTypeEnum.mysql:
			return {
				add: 'ALTER TABLE `daily_plan` ADD `taskOrder` json NULL',
				drop: 'ALTER TABLE `daily_plan` DROP COLUMN `taskOrder`'
			};
		default:
			throw new Error(`Unsupported database: ${type}`);
	}
}

export class AddDailyPlanTaskOrder1790000027000 implements MigrationInterface {
	name = 'AddDailyPlanTaskOrder1790000027000';

	/**
	 * Up Migration
	 *
	 * Adds the nullable `daily_plan.taskOrder` column: the ids of the plan's tasks in the order the
	 * owner arranged them, as a JSON array. Existing plans keep `NULL`, which clients read as "no
	 * order saved yet".
	 *
	 * The column check makes a retry safe: MySQL commits DDL on its own, so a run interrupted before
	 * the migration is recorded would otherwise fail on the column it already added.
	 *
	 * @param queryRunner
	 */
	public async up(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' start running!'));

		const { add } = taskOrderStatements(queryRunner);
		if (!(await queryRunner.hasColumn('daily_plan', 'taskOrder'))) {
			await queryRunner.query(add);
		}
	}

	/**
	 * Down Migration
	 *
	 * @param queryRunner
	 */
	public async down(queryRunner: QueryRunner): Promise<void> {
		const { drop } = taskOrderStatements(queryRunner);
		if (await queryRunner.hasColumn('daily_plan', 'taskOrder')) {
			await queryRunner.query(drop);
		}
	}
}
