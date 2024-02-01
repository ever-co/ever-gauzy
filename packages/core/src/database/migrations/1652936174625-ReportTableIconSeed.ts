import { MigrationInterface, QueryRunner } from "typeorm";
import * as chalk from "chalk";
import { DatabaseTypeEnum } from "@gauzy/config";

export class ReportTableIconSeed1652936174625 implements MigrationInterface {

	name = 'ReportTableIconSeed1652936174625';

	/**
	 * Up Migration
	 *
	 * @param queryRunner
	 */
	public async up(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' start running!'));

		switch (queryRunner.connection.options.type) {
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
		switch (queryRunner.connection.options.type) {
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

	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		console.log(chalk.yellow(this.name + ' start running!'));

		await queryRunner.connection.query(`UPDATE "report" SET "iconClass" = ? WHERE "slug" = ?`, ['far fa-clock', 'time-activity']);
		await queryRunner.connection.query(`UPDATE "report" SET "iconClass" = ? WHERE "slug" = ?`, ['fas fa-calendar-alt', 'weekly']);
		await queryRunner.connection.query(`UPDATE "report" SET "iconClass" = ? WHERE "slug" = ?`, ['far fa-window-maximize', 'apps-urls']);
		await queryRunner.connection.query(`UPDATE "report" SET "iconClass" = ? WHERE "slug" = ?`, ['far fa-window-maximize', 'manual-time-edits']);
		await queryRunner.connection.query(`UPDATE "report" SET "iconClass" = ? WHERE "slug" = ?`, ['far fa-credit-card', 'expense']);
		await queryRunner.connection.query(`UPDATE "report" SET "iconClass" = ? WHERE "slug" = ?`, ['far fa-credit-card', 'amounts-owed']);
		await queryRunner.connection.query(`UPDATE "report" SET "iconClass" = ? WHERE "slug" = ?`, ['far fa-credit-card', 'payments']);
		await queryRunner.connection.query(`UPDATE "report" SET "iconClass" = ? WHERE "slug" = ?`, ['far fa-clock', 'weekly-limits']);
		await queryRunner.connection.query(`UPDATE "report" SET "iconClass" = ? WHERE "slug" = ?`, ['far fa-clock', 'daily-limits']);
		await queryRunner.connection.query(`UPDATE "report" SET "iconClass" = ? WHERE "slug" = ?`, ['far fa-credit-card', 'project-budgets']);
		await queryRunner.connection.query(`UPDATE "report" SET "iconClass" = ? WHERE "slug" = ?`, ['far fa-credit-card', 'client-budgets']);

	}

	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.connection.query(`UPDATE "report" SET "iconClass" = ? WHERE "slug" = ?`, ['clock-outline', 'time-activity']);
		await queryRunner.connection.query(`UPDATE "report" SET "iconClass" = ? WHERE "slug" = ?`, ['calendar-outline', 'weekly']);
		await queryRunner.connection.query(`UPDATE "report" SET "iconClass" = ? WHERE "slug" = ?`, ['browser-outline', 'apps-urls']);
		await queryRunner.connection.query(`UPDATE "report" SET "iconClass" = ? WHERE "slug" = ?`, ['browser-outline', 'manual-time-edits']);
		await queryRunner.connection.query(`UPDATE "report" SET "iconClass" = ? WHERE "slug" = ?`, ['credit-card-outline', 'expense']);
		await queryRunner.connection.query(`UPDATE "report" SET "iconClass" = ? WHERE "slug" = ?`, ['credit-card-outline', 'amounts-owed']);
		await queryRunner.connection.query(`UPDATE "report" SET "iconClass" = ? WHERE "slug" = ?`, ['credit-card-outline', 'payments']);
		await queryRunner.connection.query(`UPDATE "report" SET "iconClass" = ? WHERE "slug" = ?`, ['clock-outline', 'weekly-limits']);
		await queryRunner.connection.query(`UPDATE "report" SET "iconClass" = ? WHERE "slug" = ?`, ['clock-outline', 'daily-limits']);
		await queryRunner.connection.query(`UPDATE "report" SET "iconClass" = ? WHERE "slug" = ?`, ['credit-card-outline', 'project-budgets']);
		await queryRunner.connection.query(`UPDATE "report" SET "iconClass" = ? WHERE "slug" = ?`, ['credit-card-outline', 'client-budgets']);
	}

	public async postgresUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		console.log(chalk.yellow(this.name + ' start running!'));

		await queryRunner.connection.query(`UPDATE "report" SET "iconClass" = $1 WHERE "slug" = $2`, ['far fa-clock', 'time-activity']);
		await queryRunner.connection.query(`UPDATE "report" SET "iconClass" = $1 WHERE "slug" = $2`, ['fas fa-calendar-alt', 'weekly']);
		await queryRunner.connection.query(`UPDATE "report" SET "iconClass" = $1 WHERE "slug" = $2`, ['far fa-window-maximize', 'apps-urls']);
		await queryRunner.connection.query(`UPDATE "report" SET "iconClass" = $1 WHERE "slug" = $2`, ['far fa-window-maximize', 'manual-time-edits']);
		await queryRunner.connection.query(`UPDATE "report" SET "iconClass" = $1 WHERE "slug" = $2`, ['far fa-credit-card', 'expense']);
		await queryRunner.connection.query(`UPDATE "report" SET "iconClass" = $1 WHERE "slug" = $2`, ['far fa-credit-card', 'amounts-owed']);
		await queryRunner.connection.query(`UPDATE "report" SET "iconClass" = $1 WHERE "slug" = $2`, ['far fa-credit-card', 'payments']);
		await queryRunner.connection.query(`UPDATE "report" SET "iconClass" = $1 WHERE "slug" = $2`, ['far fa-clock', 'weekly-limits']);
		await queryRunner.connection.query(`UPDATE "report" SET "iconClass" = $1 WHERE "slug" = $2`, ['far fa-clock', 'daily-limits']);
		await queryRunner.connection.query(`UPDATE "report" SET "iconClass" = $1 WHERE "slug" = $2`, ['far fa-credit-card', 'project-budgets']);
		await queryRunner.connection.query(`UPDATE "report" SET "iconClass" = $1 WHERE "slug" = $2`, ['far fa-credit-card', 'client-budgets']);
	}

	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.connection.query(`UPDATE "report" SET "iconClass" = $1 WHERE "slug" = $2`, ['clock-outline', 'time-activity']);
		await queryRunner.connection.query(`UPDATE "report" SET "iconClass" = $1 WHERE "slug" = $2`, ['calendar-outline', 'weekly']);
		await queryRunner.connection.query(`UPDATE "report" SET "iconClass" = $1 WHERE "slug" = $2`, ['browser-outline', 'apps-urls']);
		await queryRunner.connection.query(`UPDATE "report" SET "iconClass" = $1 WHERE "slug" = $2`, ['browser-outline', 'manual-time-edits']);
		await queryRunner.connection.query(`UPDATE "report" SET "iconClass" = $1 WHERE "slug" = $2`, ['credit-card-outline', 'expense']);
		await queryRunner.connection.query(`UPDATE "report" SET "iconClass" = $1 WHERE "slug" = $2`, ['credit-card-outline', 'amounts-owed']);
		await queryRunner.connection.query(`UPDATE "report" SET "iconClass" = $1 WHERE "slug" = $2`, ['credit-card-outline', 'payments']);
		await queryRunner.connection.query(`UPDATE "report" SET "iconClass" = $1 WHERE "slug" = $2`, ['clock-outline', 'weekly-limits']);
		await queryRunner.connection.query(`UPDATE "report" SET "iconClass" = $1 WHERE "slug" = $2`, ['clock-outline', 'daily-limits']);
		await queryRunner.connection.query(`UPDATE "report" SET "iconClass" = $1 WHERE "slug" = $2`, ['credit-card-outline', 'project-budgets']);
		await queryRunner.connection.query(`UPDATE "report" SET "iconClass" = $1 WHERE "slug" = $2`, ['credit-card-outline', 'client-budgets']);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
	}
}
