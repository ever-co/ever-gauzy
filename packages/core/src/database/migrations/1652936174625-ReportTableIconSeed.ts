import { MigrationInterface, QueryRunner } from "typeorm";

export class ReportTableIconSeed1652936174625 implements MigrationInterface {

    name = 'ReportTableIconSeed1652936174625';

    public async up(queryRunner: QueryRunner): Promise<any> {
		const isSqlite = ['sqlite', 'better-sqlite3'].includes(queryRunner.connection.options.type);
		if (isSqlite) {
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
		} else {
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
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
		const isSqlite = ['sqlite', 'better-sqlite3'].includes(queryRunner.connection.options.type);
		if (isSqlite) {
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
		} else {
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
    }
}
