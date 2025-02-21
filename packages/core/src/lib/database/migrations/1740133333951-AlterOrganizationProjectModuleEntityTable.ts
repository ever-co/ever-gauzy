import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class AlterOrganizationProjectModuleEntityTable1740133333951 implements MigrationInterface {
	name = 'AlterOrganizationProjectModuleEntityTable1740133333951';

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

	/**
	 * PostgresDB Up Migration
	 *
	 * @param queryRunner
	 */
	public async postgresUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`ALTER TABLE "organization_project_module" DROP CONSTRAINT "FK_8f2054a6a2d4b9c17624b9c8a01"`
		);
		await queryRunner.query(`DROP INDEX "public"."IDX_8f2054a6a2d4b9c17624b9c8a0"`);
		await queryRunner.query(
			`ALTER TABLE "organization_project_module" RENAME COLUMN "creatorId" TO "createdByUserId"`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_4bb6fbfa64cf5d5977c2e5346a" ON "organization_project_module" ("parentId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_1b1fecc4a41d0a5c4d9493bd9d" ON "organization_project_module" ("createdByUserId") `
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_module" ADD CONSTRAINT "FK_1b1fecc4a41d0a5c4d9493bd9de" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`ALTER TABLE "organization_project_module" DROP CONSTRAINT "FK_1b1fecc4a41d0a5c4d9493bd9de"`
		);
		await queryRunner.query(`DROP INDEX "public"."IDX_1b1fecc4a41d0a5c4d9493bd9d"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_4bb6fbfa64cf5d5977c2e5346a"`);
		await queryRunner.query(
			`ALTER TABLE "organization_project_module" RENAME COLUMN "createdByUserId" TO "creatorId"`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_8f2054a6a2d4b9c17624b9c8a0" ON "organization_project_module" ("creatorId") `
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_module" ADD CONSTRAINT "FK_8f2054a6a2d4b9c17624b9c8a01" FOREIGN KEY ("creatorId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
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
