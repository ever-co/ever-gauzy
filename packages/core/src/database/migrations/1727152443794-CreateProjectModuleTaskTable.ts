import { MigrationInterface, QueryRunner } from 'typeorm';
import { yellow } from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class CreateProjectModuleTaskTable1727152443794 implements MigrationInterface {
	name = 'CreateProjectModuleTaskTable1727152443794';

	/**
	 * Up Migration
	 *
	 * @param queryRunner
	 */
	public async up(queryRunner: QueryRunner): Promise<void> {
		console.log(yellow(this.name + ' start running!'));

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
		await queryRunner.query(`ALTER TABLE "task" DROP CONSTRAINT "FK_579534d8e12f22d308d6bd5f428"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_579534d8e12f22d308d6bd5f42"`);
		await queryRunner.query(
			`CREATE TABLE "project_module_task" ("organizationProjectModuleId" uuid NOT NULL, "taskId" uuid NOT NULL, CONSTRAINT "PK_524eec559972ae7bd85df1ac492" PRIMARY KEY ("organizationProjectModuleId", "taskId"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_58941b9cf23de12b2ecea4a959" ON "project_module_task" ("organizationProjectModuleId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_d056d5ba005e15ff92d4d7a8ca" ON "project_module_task" ("taskId") `);
		await queryRunner.query(`ALTER TABLE "task" DROP COLUMN "projectModuleId"`);
		await queryRunner.query(
			`ALTER TABLE "project_module_task" ADD CONSTRAINT "FK_58941b9cf23de12b2ecea4a959f" FOREIGN KEY ("organizationProjectModuleId") REFERENCES "organization_project_module"("id") ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE "project_module_task" ADD CONSTRAINT "FK_d056d5ba005e15ff92d4d7a8ca5" FOREIGN KEY ("taskId") REFERENCES "task"("id") ON DELETE CASCADE ON UPDATE CASCADE`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE "project_module_task" DROP CONSTRAINT "FK_d056d5ba005e15ff92d4d7a8ca5"`);
		await queryRunner.query(`ALTER TABLE "project_module_task" DROP CONSTRAINT "FK_58941b9cf23de12b2ecea4a959f"`);
		await queryRunner.query(`ALTER TABLE "task" ADD "projectModuleId" uuid`);
		await queryRunner.query(`DROP INDEX "public"."IDX_d056d5ba005e15ff92d4d7a8ca"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_58941b9cf23de12b2ecea4a959"`);
		await queryRunner.query(`DROP TABLE "project_module_task"`);
		await queryRunner.query(`CREATE INDEX "IDX_579534d8e12f22d308d6bd5f42" ON "task" ("projectModuleId") `);
		await queryRunner.query(
			`ALTER TABLE "task" ADD CONSTRAINT "FK_579534d8e12f22d308d6bd5f428" FOREIGN KEY ("projectModuleId") REFERENCES "organization_project_module"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
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
