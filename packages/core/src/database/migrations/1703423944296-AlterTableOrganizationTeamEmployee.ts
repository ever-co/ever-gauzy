import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';

export class AlterTableOrganizationTeamEmployee1703423944296 implements MigrationInterface {
	name = 'AlterTableOrganizationTeamEmployee1703423944296';

	/**
	 * Up Migration
	 *
	 * @param queryRunner
	 */
	public async up(queryRunner: QueryRunner): Promise<any> {
		console.log(chalk.yellow(this.name + ' start running!'));

		if (['sqlite', 'better-sqlite3'].includes(queryRunner.connection.options.type)) {
			await this.sqliteUpQueryRunner(queryRunner);
		} else {
			await this.postgresUpQueryRunner(queryRunner);
		}
	}

	/**
	 * Down Migration
	 *
	 * @param queryRunner
	 */
	public async down(queryRunner: QueryRunner): Promise<any> {
		if (['sqlite', 'better-sqlite3'].includes(queryRunner.connection.options.type)) {
			await this.sqliteDownQueryRunner(queryRunner);
		} else {
			await this.postgresDownQueryRunner(queryRunner);
		}
	}

	/**
	 * PostgresDB Up Migration
	 *
	 * @param queryRunner
	 */
	public async postgresUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE "organization_team_employee" ADD "order" integer`);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE "organization_team_employee" DROP COLUMN "order"`);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
	}
}
