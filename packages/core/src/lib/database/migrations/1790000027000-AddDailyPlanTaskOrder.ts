import { MigrationInterface, QueryRunner } from 'typeorm';
import { DatabaseTypeEnum } from '@gauzy/config';
import * as chalk from 'chalk';

export class AddDailyPlanTaskOrder1790000027000 implements MigrationInterface {
	name = 'AddDailyPlanTaskOrder1790000027000';

	/**
	 * Up Migration
	 *
	 * Adds the nullable `daily_plan.taskOrder` column: the ids of the plan's tasks in the order the
	 * owner arranged them, as a JSON array. Existing plans keep `NULL`, which clients read as "no
	 * order saved yet". The type matches the entity: `jsonb` on Postgres, `json` elsewhere (TypeORM and
	 * MikroORM both (de)serialize a `json` column on SQLite, where it is stored as text).
	 *
	 * SQLite accepts a nullable `ADD COLUMN` in place, so the table is not rebuilt.
	 *
	 * @param queryRunner
	 */
	public async up(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' start running!'));

		switch (queryRunner.connection.options.type as DatabaseTypeEnum) {
			case DatabaseTypeEnum.sqlite:
			case DatabaseTypeEnum.betterSqlite3:
				await queryRunner.query(`ALTER TABLE "daily_plan" ADD COLUMN "taskOrder" json`);
				break;
			case DatabaseTypeEnum.postgres:
				await queryRunner.query(`ALTER TABLE "daily_plan" ADD "taskOrder" jsonb`);
				break;
			case DatabaseTypeEnum.mysql:
				await queryRunner.query(`ALTER TABLE \`daily_plan\` ADD \`taskOrder\` json NULL`);
				break;
			default:
				throw new Error(`Unsupported database: ${queryRunner.connection.options.type}`);
		}
	}

	/**
	 * Down Migration
	 *
	 * `DROP COLUMN` on SQLite needs 3.35 or later; the bundled better-sqlite3 ships a newer one.
	 *
	 * @param queryRunner
	 */
	public async down(queryRunner: QueryRunner): Promise<void> {
		switch (queryRunner.connection.options.type as DatabaseTypeEnum) {
			case DatabaseTypeEnum.sqlite:
			case DatabaseTypeEnum.betterSqlite3:
			case DatabaseTypeEnum.postgres:
				await queryRunner.query(`ALTER TABLE "daily_plan" DROP COLUMN "taskOrder"`);
				break;
			case DatabaseTypeEnum.mysql:
				await queryRunner.query(`ALTER TABLE \`daily_plan\` DROP COLUMN \`taskOrder\``);
				break;
			default:
				throw new Error(`Unsupported database: ${queryRunner.connection.options.type}`);
		}
	}
}
