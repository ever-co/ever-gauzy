import { MigrationInterface, QueryRunner } from 'typeorm';
import { yellow } from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class CreateProjectModuleTable1724929664505 implements MigrationInterface {
	name = 'CreateProjectModuleTable1724929664505';

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
		await queryRunner.query(
			`CREATE TABLE "organization_project_module" ("deletedAt" TIMESTAMP, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "tenantId" uuid, "organizationId" uuid, "name" character varying NOT NULL, "description" text, "status" character varying, "startDate" TIMESTAMP, "endDate" TIMESTAMP, "public" boolean DEFAULT false, "isFavorite" boolean DEFAULT false, "parentId" uuid, "projectId" uuid, "creatorId" uuid, "managerId" uuid, CONSTRAINT "PK_61c6dccd818b5e91c438dcd9901" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_f33638d289aff2306328c32a8c" ON "organization_project_module" ("isActive") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_a56086e95fb2627ba2a3dd2eaa" ON "organization_project_module" ("isArchived") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_8a7a4d4206c003c3827c5afe5d" ON "organization_project_module" ("tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_cd928adcb5ebb00c9f2c57e390" ON "organization_project_module" ("organizationId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_86438fbaa1d857f32f66b24885" ON "organization_project_module" ("status") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_7fd3c8f54c01943b283080aefa" ON "organization_project_module" ("projectId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_8f2054a6a2d4b9c17624b9c8a0" ON "organization_project_module" ("creatorId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_e6b6555e5fc6c5120110a0195c" ON "organization_project_module" ("managerId") `
		);
		await queryRunner.query(
			`CREATE TABLE "project_module_sprint" ("organizationProjectModuleId" uuid NOT NULL, "organizationSprintId" uuid NOT NULL, CONSTRAINT "PK_7e6929079783cb90588e0f93762" PRIMARY KEY ("organizationProjectModuleId", "organizationSprintId"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_c91ef400079e93fec908cf9384" ON "project_module_sprint" ("organizationProjectModuleId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_7af935d75a7e21fd76f072fbc0" ON "project_module_sprint" ("organizationSprintId") `
		);
		await queryRunner.query(
			`CREATE TABLE "project_module_team" ("organizationProjectModuleId" uuid NOT NULL, "organizationTeamId" uuid NOT NULL, CONSTRAINT "PK_64723331f528c88f4037f0bf437" PRIMARY KEY ("organizationProjectModuleId", "organizationTeamId"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_42c46289259b3fcdf2dc61744a" ON "project_module_team" ("organizationProjectModuleId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_d14aeb1b3e08d80eb32dd05934" ON "project_module_team" ("organizationTeamId") `
		);
		await queryRunner.query(
			`CREATE TABLE "project_module_employee" ("organizationProjectModuleId" uuid NOT NULL, "employeeId" uuid NOT NULL, CONSTRAINT "PK_809c3beb646a1666d4d8161b637" PRIMARY KEY ("organizationProjectModuleId", "employeeId"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_e9fd7310fc93849b1d55e64d28" ON "project_module_employee" ("organizationProjectModuleId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_18e428e909e48a4b7df43d7e01" ON "project_module_employee" ("employeeId") `
		);
		await queryRunner.query(`ALTER TABLE "task" ADD "projectModuleId" uuid`);
		await queryRunner.query(`CREATE INDEX "IDX_579534d8e12f22d308d6bd5f42" ON "task" ("projectModuleId") `);
		await queryRunner.query(
			`ALTER TABLE "organization_project_module" ADD CONSTRAINT "FK_8a7a4d4206c003c3827c5afe5dc" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_module" ADD CONSTRAINT "FK_cd928adcb5ebb00c9f2c57e3908" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_module" ADD CONSTRAINT "FK_4bb6fbfa64cf5d5977c2e5346a9" FOREIGN KEY ("parentId") REFERENCES "organization_project_module"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_module" ADD CONSTRAINT "FK_7fd3c8f54c01943b283080aefa3" FOREIGN KEY ("projectId") REFERENCES "organization_project"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_module" ADD CONSTRAINT "FK_8f2054a6a2d4b9c17624b9c8a01" FOREIGN KEY ("creatorId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_module" ADD CONSTRAINT "FK_e6b6555e5fc6c5120110a0195cd" FOREIGN KEY ("managerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "task" ADD CONSTRAINT "FK_579534d8e12f22d308d6bd5f428" FOREIGN KEY ("projectModuleId") REFERENCES "organization_project_module"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "project_module_sprint" ADD CONSTRAINT "FK_c91ef400079e93fec908cf93845" FOREIGN KEY ("organizationProjectModuleId") REFERENCES "organization_project_module"("id") ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE "project_module_sprint" ADD CONSTRAINT "FK_7af935d75a7e21fd76f072fbc03" FOREIGN KEY ("organizationSprintId") REFERENCES "organization_sprint"("id") ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE "project_module_team" ADD CONSTRAINT "FK_42c46289259b3fcdf2dc61744a7" FOREIGN KEY ("organizationProjectModuleId") REFERENCES "organization_project_module"("id") ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE "project_module_team" ADD CONSTRAINT "FK_d14aeb1b3e08d80eb32dd05934b" FOREIGN KEY ("organizationTeamId") REFERENCES "organization_team"("id") ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE "project_module_employee" ADD CONSTRAINT "FK_e9fd7310fc93849b1d55e64d280" FOREIGN KEY ("organizationProjectModuleId") REFERENCES "organization_project_module"("id") ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE "project_module_employee" ADD CONSTRAINT "FK_18e428e909e48a4b7df43d7e01e" FOREIGN KEY ("employeeId") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE CASCADE`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`ALTER TABLE "project_module_employee" DROP CONSTRAINT "FK_18e428e909e48a4b7df43d7e01e"`
		);
		await queryRunner.query(
			`ALTER TABLE "project_module_employee" DROP CONSTRAINT "FK_e9fd7310fc93849b1d55e64d280"`
		);
		await queryRunner.query(`ALTER TABLE "project_module_team" DROP CONSTRAINT "FK_d14aeb1b3e08d80eb32dd05934b"`);
		await queryRunner.query(`ALTER TABLE "project_module_team" DROP CONSTRAINT "FK_42c46289259b3fcdf2dc61744a7"`);
		await queryRunner.query(`ALTER TABLE "project_module_sprint" DROP CONSTRAINT "FK_7af935d75a7e21fd76f072fbc03"`);
		await queryRunner.query(`ALTER TABLE "project_module_sprint" DROP CONSTRAINT "FK_c91ef400079e93fec908cf93845"`);
		await queryRunner.query(`ALTER TABLE "task" DROP CONSTRAINT "FK_579534d8e12f22d308d6bd5f428"`);
		await queryRunner.query(
			`ALTER TABLE "organization_project_module" DROP CONSTRAINT "FK_e6b6555e5fc6c5120110a0195cd"`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_module" DROP CONSTRAINT "FK_8f2054a6a2d4b9c17624b9c8a01"`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_module" DROP CONSTRAINT "FK_7fd3c8f54c01943b283080aefa3"`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_module" DROP CONSTRAINT "FK_4bb6fbfa64cf5d5977c2e5346a9"`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_module" DROP CONSTRAINT "FK_cd928adcb5ebb00c9f2c57e3908"`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_module" DROP CONSTRAINT "FK_8a7a4d4206c003c3827c5afe5dc"`
		);
		await queryRunner.query(`DROP INDEX "public"."IDX_579534d8e12f22d308d6bd5f42"`);
		await queryRunner.query(`ALTER TABLE "task" DROP COLUMN "projectModuleId"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_18e428e909e48a4b7df43d7e01"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_e9fd7310fc93849b1d55e64d28"`);
		await queryRunner.query(`DROP TABLE "project_module_employee"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_d14aeb1b3e08d80eb32dd05934"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_42c46289259b3fcdf2dc61744a"`);
		await queryRunner.query(`DROP TABLE "project_module_team"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_7af935d75a7e21fd76f072fbc0"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_c91ef400079e93fec908cf9384"`);
		await queryRunner.query(`DROP TABLE "project_module_sprint"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_e6b6555e5fc6c5120110a0195c"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_8f2054a6a2d4b9c17624b9c8a0"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_7fd3c8f54c01943b283080aefa"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_86438fbaa1d857f32f66b24885"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_cd928adcb5ebb00c9f2c57e390"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_8a7a4d4206c003c3827c5afe5d"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_a56086e95fb2627ba2a3dd2eaa"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_f33638d289aff2306328c32a8c"`);
		await queryRunner.query(`DROP TABLE "organization_project_module"`);
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
