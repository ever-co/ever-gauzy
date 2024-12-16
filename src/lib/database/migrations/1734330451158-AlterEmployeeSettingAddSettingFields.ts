import { Logger } from '@nestjs/common';
import { MigrationInterface, QueryRunner } from 'typeorm';
import { yellow } from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class AlterEmployeeSettingAddSettingFields1734330451158 implements MigrationInterface {
	name = 'AlterEmployeeSettingAddSettingFields1734330451158';

	/**
	 * Up Migration
	 *
	 * @param queryRunner
	 */
	public async up(queryRunner: QueryRunner): Promise<void> {
		Logger.debug(yellow(this.name + ' start running!'), 'Migration');

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

	/**
	 * PostgresDB Up Migration
	 *
	 * @param queryRunner
	 */
	public async postgresUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "public"."IDX_710c71526edb89b2a7033abcdf"`);
		await queryRunner.query(`ALTER TABLE "employee_setting" DROP COLUMN "month"`);
		await queryRunner.query(`ALTER TABLE "employee_setting" DROP COLUMN "year"`);
		await queryRunner.query(`ALTER TABLE "employee_setting" DROP COLUMN "value"`);
		await queryRunner.query(`ALTER TABLE "employee_setting" DROP COLUMN "currency"`);
		await queryRunner.query(`ALTER TABLE "employee_setting" ADD "entityId" character varying`);
		await queryRunner.query(`ALTER TABLE "employee_setting" ADD "entity" character varying`);
		await queryRunner.query(`ALTER TABLE "employee_setting" ADD "data" jsonb`);
		await queryRunner.query(`ALTER TABLE "employee_setting" ADD "defaultData" jsonb`);
		await queryRunner.query(`ALTER TABLE "employee_setting" ALTER COLUMN "settingType" DROP NOT NULL`);
		await queryRunner.query(`ALTER TABLE "employee_setting" ALTER COLUMN "settingType" SET DEFAULT 'Normal'`);
		await queryRunner.query(`CREATE INDEX "IDX_cb9a229d96e9357c823e0c1940" ON "employee_setting" ("entityId") `);
		await queryRunner.query(`CREATE INDEX "IDX_4862a2b518e38fe3942e6be210" ON "employee_setting" ("entity") `);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "public"."IDX_4862a2b518e38fe3942e6be210"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_cb9a229d96e9357c823e0c1940"`);
		await queryRunner.query(`ALTER TABLE "employee_setting" ALTER COLUMN "settingType" DROP DEFAULT`);
		await queryRunner.query(`ALTER TABLE "employee_setting" ALTER COLUMN "settingType" SET NOT NULL`);
		await queryRunner.query(`ALTER TABLE "employee_setting" DROP COLUMN "defaultData"`);
		await queryRunner.query(`ALTER TABLE "employee_setting" DROP COLUMN "data"`);
		await queryRunner.query(`ALTER TABLE "employee_setting" DROP COLUMN "entity"`);
		await queryRunner.query(`ALTER TABLE "employee_setting" DROP COLUMN "entityId"`);
		await queryRunner.query(`ALTER TABLE "employee_setting" ADD "currency" character varying NOT NULL`);
		await queryRunner.query(`ALTER TABLE "employee_setting" ADD "value" integer NOT NULL`);
		await queryRunner.query(`ALTER TABLE "employee_setting" ADD "year" integer NOT NULL`);
		await queryRunner.query(`ALTER TABLE "employee_setting" ADD "month" integer NOT NULL`);
		await queryRunner.query(`CREATE INDEX "IDX_710c71526edb89b2a7033abcdf" ON "employee_setting" ("currency") `);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {}
}
