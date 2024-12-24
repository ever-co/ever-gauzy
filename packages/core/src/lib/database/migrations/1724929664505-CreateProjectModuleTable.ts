import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class CreateProjectModuleTable1724929664505 implements MigrationInterface {
	name = 'CreateProjectModuleTable1724929664505';

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
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE "organization_project_module" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "description" text, "status" varchar, "startDate" datetime, "endDate" datetime, "public" boolean DEFAULT (0), "isFavorite" boolean DEFAULT (0), "parentId" varchar, "projectId" varchar, "creatorId" varchar, "managerId" varchar)`
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
			`CREATE TABLE "project_module_sprint" ("organizationProjectModuleId" varchar NOT NULL, "organizationSprintId" varchar NOT NULL, PRIMARY KEY ("organizationProjectModuleId", "organizationSprintId"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_c91ef400079e93fec908cf9384" ON "project_module_sprint" ("organizationProjectModuleId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_7af935d75a7e21fd76f072fbc0" ON "project_module_sprint" ("organizationSprintId") `
		);
		await queryRunner.query(
			`CREATE TABLE "project_module_team" ("organizationProjectModuleId" varchar NOT NULL, "organizationTeamId" varchar NOT NULL, PRIMARY KEY ("organizationProjectModuleId", "organizationTeamId"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_42c46289259b3fcdf2dc61744a" ON "project_module_team" ("organizationProjectModuleId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_d14aeb1b3e08d80eb32dd05934" ON "project_module_team" ("organizationTeamId") `
		);
		await queryRunner.query(
			`CREATE TABLE "project_module_employee" ("organizationProjectModuleId" varchar NOT NULL, "employeeId" varchar NOT NULL, PRIMARY KEY ("organizationProjectModuleId", "employeeId"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_e9fd7310fc93849b1d55e64d28" ON "project_module_employee" ("organizationProjectModuleId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_18e428e909e48a4b7df43d7e01" ON "project_module_employee" ("employeeId") `
		);
		await queryRunner.query(`DROP INDEX "IDX_b8616deefe44d0622233e73fbf"`);
		await queryRunner.query(`DROP INDEX "IDX_2f4bdd2593fd6038aaa91fd107"`);
		await queryRunner.query(`DROP INDEX "IDX_0cbe714983eb0aae5feeee8212"`);
		await queryRunner.query(`DROP INDEX "IDX_ed5441fb13e82854a994da5a78"`);
		await queryRunner.query(`DROP INDEX "IDX_7127880d6fae956ecc1c84ac31"`);
		await queryRunner.query(`DROP INDEX "IDX_f092f3386f10f2e2ef5b0b6ad1"`);
		await queryRunner.query(`DROP INDEX "IDX_2fe7a278e6f08d2be55740a939"`);
		await queryRunner.query(`DROP INDEX "IDX_e91cbff3d206f150ccc14d0c3a"`);
		await queryRunner.query(`DROP INDEX "IDX_5b0272d923a31c972bed1a1ac4"`);
		await queryRunner.query(`DROP INDEX "IDX_3797a20ef5553ae87af126bc2f"`);
		await queryRunner.query(`DROP INDEX "IDX_94fe6b3a5aec5f85427df4f8cd"`);
		await queryRunner.query(`DROP INDEX "IDX_1e1f64696aa3a26d3e12c840e5"`);
		await queryRunner.query(`DROP INDEX "taskNumber"`);
		await queryRunner.query(`DROP INDEX "IDX_3e16c81005c389a4db83c0e5e3"`);
		await queryRunner.query(`DROP INDEX "IDX_ca2f7edd5a5ce8f14b257c9d54"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_task" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "title" varchar NOT NULL, "description" varchar, "status" varchar, "estimate" integer, "dueDate" datetime, "projectId" varchar, "creatorId" varchar, "organizationSprintId" varchar, "number" integer, "prefix" varchar, "priority" varchar, "size" varchar, "public" boolean DEFAULT (1), "startDate" datetime, "resolvedAt" datetime, "version" varchar, "issueType" varchar, "parentId" varchar, "taskStatusId" varchar, "taskSizeId" varchar, "taskPriorityId" varchar, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "deletedAt" datetime, "projectModuleId" varchar, CONSTRAINT "FK_b8616deefe44d0622233e73fbf9" FOREIGN KEY ("taskPriorityId") REFERENCES "task_priority" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_2f4bdd2593fd6038aaa91fd1076" FOREIGN KEY ("taskSizeId") REFERENCES "task_size" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_0cbe714983eb0aae5feeee8212b" FOREIGN KEY ("taskStatusId") REFERENCES "task_status" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_e91cbff3d206f150ccc14d0c3a1" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_5b0272d923a31c972bed1a1ac4d" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_3797a20ef5553ae87af126bc2fe" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_94fe6b3a5aec5f85427df4f8cd7" FOREIGN KEY ("creatorId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_1e1f64696aa3a26d3e12c840e55" FOREIGN KEY ("organizationSprintId") REFERENCES "organization_sprint" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_8c9920b5fb32c3d8453f64b705c" FOREIGN KEY ("parentId") REFERENCES "task" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_task"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "title", "description", "status", "estimate", "dueDate", "projectId", "creatorId", "organizationSprintId", "number", "prefix", "priority", "size", "public", "startDate", "resolvedAt", "version", "issueType", "parentId", "taskStatusId", "taskSizeId", "taskPriorityId", "isActive", "isArchived", "deletedAt") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "title", "description", "status", "estimate", "dueDate", "projectId", "creatorId", "organizationSprintId", "number", "prefix", "priority", "size", "public", "startDate", "resolvedAt", "version", "issueType", "parentId", "taskStatusId", "taskSizeId", "taskPriorityId", "isActive", "isArchived", "deletedAt" FROM "task"`
		);
		await queryRunner.query(`DROP TABLE "task"`);
		await queryRunner.query(`ALTER TABLE "temporary_task" RENAME TO "task"`);
		await queryRunner.query(`CREATE INDEX "IDX_b8616deefe44d0622233e73fbf" ON "task" ("taskPriorityId") `);
		await queryRunner.query(`CREATE INDEX "IDX_2f4bdd2593fd6038aaa91fd107" ON "task" ("taskSizeId") `);
		await queryRunner.query(`CREATE INDEX "IDX_0cbe714983eb0aae5feeee8212" ON "task" ("taskStatusId") `);
		await queryRunner.query(`CREATE INDEX "IDX_ed5441fb13e82854a994da5a78" ON "task" ("issueType") `);
		await queryRunner.query(`CREATE INDEX "IDX_7127880d6fae956ecc1c84ac31" ON "task" ("size") `);
		await queryRunner.query(`CREATE INDEX "IDX_f092f3386f10f2e2ef5b0b6ad1" ON "task" ("priority") `);
		await queryRunner.query(`CREATE INDEX "IDX_2fe7a278e6f08d2be55740a939" ON "task" ("status") `);
		await queryRunner.query(`CREATE INDEX "IDX_e91cbff3d206f150ccc14d0c3a" ON "task" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_5b0272d923a31c972bed1a1ac4" ON "task" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_3797a20ef5553ae87af126bc2f" ON "task" ("projectId") `);
		await queryRunner.query(`CREATE INDEX "IDX_94fe6b3a5aec5f85427df4f8cd" ON "task" ("creatorId") `);
		await queryRunner.query(`CREATE INDEX "IDX_1e1f64696aa3a26d3e12c840e5" ON "task" ("organizationSprintId") `);
		await queryRunner.query(`CREATE UNIQUE INDEX "taskNumber" ON "task" ("projectId", "number") `);
		await queryRunner.query(`CREATE INDEX "IDX_3e16c81005c389a4db83c0e5e3" ON "task" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_ca2f7edd5a5ce8f14b257c9d54" ON "task" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_579534d8e12f22d308d6bd5f42" ON "task" ("projectModuleId") `);
		await queryRunner.query(`DROP INDEX "IDX_f33638d289aff2306328c32a8c"`);
		await queryRunner.query(`DROP INDEX "IDX_a56086e95fb2627ba2a3dd2eaa"`);
		await queryRunner.query(`DROP INDEX "IDX_8a7a4d4206c003c3827c5afe5d"`);
		await queryRunner.query(`DROP INDEX "IDX_cd928adcb5ebb00c9f2c57e390"`);
		await queryRunner.query(`DROP INDEX "IDX_86438fbaa1d857f32f66b24885"`);
		await queryRunner.query(`DROP INDEX "IDX_7fd3c8f54c01943b283080aefa"`);
		await queryRunner.query(`DROP INDEX "IDX_8f2054a6a2d4b9c17624b9c8a0"`);
		await queryRunner.query(`DROP INDEX "IDX_e6b6555e5fc6c5120110a0195c"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_organization_project_module" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "description" text, "status" varchar, "startDate" datetime, "endDate" datetime, "public" boolean DEFAULT (0), "isFavorite" boolean DEFAULT (0), "parentId" varchar, "projectId" varchar, "creatorId" varchar, "managerId" varchar, CONSTRAINT "FK_8a7a4d4206c003c3827c5afe5dc" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_cd928adcb5ebb00c9f2c57e3908" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_4bb6fbfa64cf5d5977c2e5346a9" FOREIGN KEY ("parentId") REFERENCES "organization_project_module" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_7fd3c8f54c01943b283080aefa3" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_8f2054a6a2d4b9c17624b9c8a01" FOREIGN KEY ("creatorId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_e6b6555e5fc6c5120110a0195cd" FOREIGN KEY ("managerId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_organization_project_module"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "tenantId", "organizationId", "name", "description", "status", "startDate", "endDate", "public", "isFavorite", "parentId", "projectId", "creatorId", "managerId") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "tenantId", "organizationId", "name", "description", "status", "startDate", "endDate", "public", "isFavorite", "parentId", "projectId", "creatorId", "managerId" FROM "organization_project_module"`
		);
		await queryRunner.query(`DROP TABLE "organization_project_module"`);
		await queryRunner.query(
			`ALTER TABLE "temporary_organization_project_module" RENAME TO "organization_project_module"`
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
		await queryRunner.query(`DROP INDEX "IDX_b8616deefe44d0622233e73fbf"`);
		await queryRunner.query(`DROP INDEX "IDX_2f4bdd2593fd6038aaa91fd107"`);
		await queryRunner.query(`DROP INDEX "IDX_0cbe714983eb0aae5feeee8212"`);
		await queryRunner.query(`DROP INDEX "IDX_ed5441fb13e82854a994da5a78"`);
		await queryRunner.query(`DROP INDEX "IDX_7127880d6fae956ecc1c84ac31"`);
		await queryRunner.query(`DROP INDEX "IDX_f092f3386f10f2e2ef5b0b6ad1"`);
		await queryRunner.query(`DROP INDEX "IDX_2fe7a278e6f08d2be55740a939"`);
		await queryRunner.query(`DROP INDEX "IDX_e91cbff3d206f150ccc14d0c3a"`);
		await queryRunner.query(`DROP INDEX "IDX_5b0272d923a31c972bed1a1ac4"`);
		await queryRunner.query(`DROP INDEX "IDX_3797a20ef5553ae87af126bc2f"`);
		await queryRunner.query(`DROP INDEX "IDX_94fe6b3a5aec5f85427df4f8cd"`);
		await queryRunner.query(`DROP INDEX "IDX_1e1f64696aa3a26d3e12c840e5"`);
		await queryRunner.query(`DROP INDEX "taskNumber"`);
		await queryRunner.query(`DROP INDEX "IDX_3e16c81005c389a4db83c0e5e3"`);
		await queryRunner.query(`DROP INDEX "IDX_ca2f7edd5a5ce8f14b257c9d54"`);
		await queryRunner.query(`DROP INDEX "IDX_579534d8e12f22d308d6bd5f42"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_task" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "title" varchar NOT NULL, "description" varchar, "status" varchar, "estimate" integer, "dueDate" datetime, "projectId" varchar, "creatorId" varchar, "organizationSprintId" varchar, "number" integer, "prefix" varchar, "priority" varchar, "size" varchar, "public" boolean DEFAULT (1), "startDate" datetime, "resolvedAt" datetime, "version" varchar, "issueType" varchar, "parentId" varchar, "taskStatusId" varchar, "taskSizeId" varchar, "taskPriorityId" varchar, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "deletedAt" datetime, "projectModuleId" varchar, CONSTRAINT "FK_b8616deefe44d0622233e73fbf9" FOREIGN KEY ("taskPriorityId") REFERENCES "task_priority" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_2f4bdd2593fd6038aaa91fd1076" FOREIGN KEY ("taskSizeId") REFERENCES "task_size" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_0cbe714983eb0aae5feeee8212b" FOREIGN KEY ("taskStatusId") REFERENCES "task_status" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_e91cbff3d206f150ccc14d0c3a1" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_5b0272d923a31c972bed1a1ac4d" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_3797a20ef5553ae87af126bc2fe" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_94fe6b3a5aec5f85427df4f8cd7" FOREIGN KEY ("creatorId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_1e1f64696aa3a26d3e12c840e55" FOREIGN KEY ("organizationSprintId") REFERENCES "organization_sprint" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_8c9920b5fb32c3d8453f64b705c" FOREIGN KEY ("parentId") REFERENCES "task" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_579534d8e12f22d308d6bd5f428" FOREIGN KEY ("projectModuleId") REFERENCES "organization_project_module" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_task"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "title", "description", "status", "estimate", "dueDate", "projectId", "creatorId", "organizationSprintId", "number", "prefix", "priority", "size", "public", "startDate", "resolvedAt", "version", "issueType", "parentId", "taskStatusId", "taskSizeId", "taskPriorityId", "isActive", "isArchived", "deletedAt", "projectModuleId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "title", "description", "status", "estimate", "dueDate", "projectId", "creatorId", "organizationSprintId", "number", "prefix", "priority", "size", "public", "startDate", "resolvedAt", "version", "issueType", "parentId", "taskStatusId", "taskSizeId", "taskPriorityId", "isActive", "isArchived", "deletedAt", "projectModuleId" FROM "task"`
		);
		await queryRunner.query(`DROP TABLE "task"`);
		await queryRunner.query(`ALTER TABLE "temporary_task" RENAME TO "task"`);
		await queryRunner.query(`CREATE INDEX "IDX_b8616deefe44d0622233e73fbf" ON "task" ("taskPriorityId") `);
		await queryRunner.query(`CREATE INDEX "IDX_2f4bdd2593fd6038aaa91fd107" ON "task" ("taskSizeId") `);
		await queryRunner.query(`CREATE INDEX "IDX_0cbe714983eb0aae5feeee8212" ON "task" ("taskStatusId") `);
		await queryRunner.query(`CREATE INDEX "IDX_ed5441fb13e82854a994da5a78" ON "task" ("issueType") `);
		await queryRunner.query(`CREATE INDEX "IDX_7127880d6fae956ecc1c84ac31" ON "task" ("size") `);
		await queryRunner.query(`CREATE INDEX "IDX_f092f3386f10f2e2ef5b0b6ad1" ON "task" ("priority") `);
		await queryRunner.query(`CREATE INDEX "IDX_2fe7a278e6f08d2be55740a939" ON "task" ("status") `);
		await queryRunner.query(`CREATE INDEX "IDX_e91cbff3d206f150ccc14d0c3a" ON "task" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_5b0272d923a31c972bed1a1ac4" ON "task" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_3797a20ef5553ae87af126bc2f" ON "task" ("projectId") `);
		await queryRunner.query(`CREATE INDEX "IDX_94fe6b3a5aec5f85427df4f8cd" ON "task" ("creatorId") `);
		await queryRunner.query(`CREATE INDEX "IDX_1e1f64696aa3a26d3e12c840e5" ON "task" ("organizationSprintId") `);
		await queryRunner.query(`CREATE UNIQUE INDEX "taskNumber" ON "task" ("projectId", "number") `);
		await queryRunner.query(`CREATE INDEX "IDX_3e16c81005c389a4db83c0e5e3" ON "task" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_ca2f7edd5a5ce8f14b257c9d54" ON "task" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_579534d8e12f22d308d6bd5f42" ON "task" ("projectModuleId") `);
		await queryRunner.query(`DROP INDEX "IDX_c91ef400079e93fec908cf9384"`);
		await queryRunner.query(`DROP INDEX "IDX_7af935d75a7e21fd76f072fbc0"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_project_module_sprint" ("organizationProjectModuleId" varchar NOT NULL, "organizationSprintId" varchar NOT NULL, CONSTRAINT "FK_c91ef400079e93fec908cf93845" FOREIGN KEY ("organizationProjectModuleId") REFERENCES "organization_project_module" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_7af935d75a7e21fd76f072fbc03" FOREIGN KEY ("organizationSprintId") REFERENCES "organization_sprint" ("id") ON DELETE CASCADE ON UPDATE CASCADE, PRIMARY KEY ("organizationProjectModuleId", "organizationSprintId"))`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_project_module_sprint"("organizationProjectModuleId", "organizationSprintId") SELECT "organizationProjectModuleId", "organizationSprintId" FROM "project_module_sprint"`
		);
		await queryRunner.query(`DROP TABLE "project_module_sprint"`);
		await queryRunner.query(`ALTER TABLE "temporary_project_module_sprint" RENAME TO "project_module_sprint"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_c91ef400079e93fec908cf9384" ON "project_module_sprint" ("organizationProjectModuleId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_7af935d75a7e21fd76f072fbc0" ON "project_module_sprint" ("organizationSprintId") `
		);
		await queryRunner.query(`DROP INDEX "IDX_42c46289259b3fcdf2dc61744a"`);
		await queryRunner.query(`DROP INDEX "IDX_d14aeb1b3e08d80eb32dd05934"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_project_module_team" ("organizationProjectModuleId" varchar NOT NULL, "organizationTeamId" varchar NOT NULL, CONSTRAINT "FK_42c46289259b3fcdf2dc61744a7" FOREIGN KEY ("organizationProjectModuleId") REFERENCES "organization_project_module" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_d14aeb1b3e08d80eb32dd05934b" FOREIGN KEY ("organizationTeamId") REFERENCES "organization_team" ("id") ON DELETE CASCADE ON UPDATE CASCADE, PRIMARY KEY ("organizationProjectModuleId", "organizationTeamId"))`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_project_module_team"("organizationProjectModuleId", "organizationTeamId") SELECT "organizationProjectModuleId", "organizationTeamId" FROM "project_module_team"`
		);
		await queryRunner.query(`DROP TABLE "project_module_team"`);
		await queryRunner.query(`ALTER TABLE "temporary_project_module_team" RENAME TO "project_module_team"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_42c46289259b3fcdf2dc61744a" ON "project_module_team" ("organizationProjectModuleId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_d14aeb1b3e08d80eb32dd05934" ON "project_module_team" ("organizationTeamId") `
		);
		await queryRunner.query(`DROP INDEX "IDX_e9fd7310fc93849b1d55e64d28"`);
		await queryRunner.query(`DROP INDEX "IDX_18e428e909e48a4b7df43d7e01"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_project_module_employee" ("organizationProjectModuleId" varchar NOT NULL, "employeeId" varchar NOT NULL, CONSTRAINT "FK_e9fd7310fc93849b1d55e64d280" FOREIGN KEY ("organizationProjectModuleId") REFERENCES "organization_project_module" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_18e428e909e48a4b7df43d7e01e" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE, PRIMARY KEY ("organizationProjectModuleId", "employeeId"))`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_project_module_employee"("organizationProjectModuleId", "employeeId") SELECT "organizationProjectModuleId", "employeeId" FROM "project_module_employee"`
		);
		await queryRunner.query(`DROP TABLE "project_module_employee"`);
		await queryRunner.query(`ALTER TABLE "temporary_project_module_employee" RENAME TO "project_module_employee"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_e9fd7310fc93849b1d55e64d28" ON "project_module_employee" ("organizationProjectModuleId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_18e428e909e48a4b7df43d7e01" ON "project_module_employee" ("employeeId") `
		);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_18e428e909e48a4b7df43d7e01"`);
		await queryRunner.query(`DROP INDEX "IDX_e9fd7310fc93849b1d55e64d28"`);
		await queryRunner.query(`ALTER TABLE "project_module_employee" RENAME TO "temporary_project_module_employee"`);
		await queryRunner.query(
			`CREATE TABLE "project_module_employee" ("organizationProjectModuleId" varchar NOT NULL, "employeeId" varchar NOT NULL, PRIMARY KEY ("organizationProjectModuleId", "employeeId"))`
		);
		await queryRunner.query(
			`INSERT INTO "project_module_employee"("organizationProjectModuleId", "employeeId") SELECT "organizationProjectModuleId", "employeeId" FROM "temporary_project_module_employee"`
		);
		await queryRunner.query(`DROP TABLE "temporary_project_module_employee"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_18e428e909e48a4b7df43d7e01" ON "project_module_employee" ("employeeId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_e9fd7310fc93849b1d55e64d28" ON "project_module_employee" ("organizationProjectModuleId") `
		);
		await queryRunner.query(`DROP INDEX "IDX_d14aeb1b3e08d80eb32dd05934"`);
		await queryRunner.query(`DROP INDEX "IDX_42c46289259b3fcdf2dc61744a"`);
		await queryRunner.query(`ALTER TABLE "project_module_team" RENAME TO "temporary_project_module_team"`);
		await queryRunner.query(
			`CREATE TABLE "project_module_team" ("organizationProjectModuleId" varchar NOT NULL, "organizationTeamId" varchar NOT NULL, PRIMARY KEY ("organizationProjectModuleId", "organizationTeamId"))`
		);
		await queryRunner.query(
			`INSERT INTO "project_module_team"("organizationProjectModuleId", "organizationTeamId") SELECT "organizationProjectModuleId", "organizationTeamId" FROM "temporary_project_module_team"`
		);
		await queryRunner.query(`DROP TABLE "temporary_project_module_team"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_d14aeb1b3e08d80eb32dd05934" ON "project_module_team" ("organizationTeamId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_42c46289259b3fcdf2dc61744a" ON "project_module_team" ("organizationProjectModuleId") `
		);
		await queryRunner.query(`DROP INDEX "IDX_7af935d75a7e21fd76f072fbc0"`);
		await queryRunner.query(`DROP INDEX "IDX_c91ef400079e93fec908cf9384"`);
		await queryRunner.query(`ALTER TABLE "project_module_sprint" RENAME TO "temporary_project_module_sprint"`);
		await queryRunner.query(
			`CREATE TABLE "project_module_sprint" ("organizationProjectModuleId" varchar NOT NULL, "organizationSprintId" varchar NOT NULL, PRIMARY KEY ("organizationProjectModuleId", "organizationSprintId"))`
		);
		await queryRunner.query(
			`INSERT INTO "project_module_sprint"("organizationProjectModuleId", "organizationSprintId") SELECT "organizationProjectModuleId", "organizationSprintId" FROM "temporary_project_module_sprint"`
		);
		await queryRunner.query(`DROP TABLE "temporary_project_module_sprint"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_7af935d75a7e21fd76f072fbc0" ON "project_module_sprint" ("organizationSprintId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_c91ef400079e93fec908cf9384" ON "project_module_sprint" ("organizationProjectModuleId") `
		);
		await queryRunner.query(`DROP INDEX "IDX_579534d8e12f22d308d6bd5f42"`);
		await queryRunner.query(`DROP INDEX "IDX_ca2f7edd5a5ce8f14b257c9d54"`);
		await queryRunner.query(`DROP INDEX "IDX_3e16c81005c389a4db83c0e5e3"`);
		await queryRunner.query(`DROP INDEX "taskNumber"`);
		await queryRunner.query(`DROP INDEX "IDX_1e1f64696aa3a26d3e12c840e5"`);
		await queryRunner.query(`DROP INDEX "IDX_94fe6b3a5aec5f85427df4f8cd"`);
		await queryRunner.query(`DROP INDEX "IDX_3797a20ef5553ae87af126bc2f"`);
		await queryRunner.query(`DROP INDEX "IDX_5b0272d923a31c972bed1a1ac4"`);
		await queryRunner.query(`DROP INDEX "IDX_e91cbff3d206f150ccc14d0c3a"`);
		await queryRunner.query(`DROP INDEX "IDX_2fe7a278e6f08d2be55740a939"`);
		await queryRunner.query(`DROP INDEX "IDX_f092f3386f10f2e2ef5b0b6ad1"`);
		await queryRunner.query(`DROP INDEX "IDX_7127880d6fae956ecc1c84ac31"`);
		await queryRunner.query(`DROP INDEX "IDX_ed5441fb13e82854a994da5a78"`);
		await queryRunner.query(`DROP INDEX "IDX_0cbe714983eb0aae5feeee8212"`);
		await queryRunner.query(`DROP INDEX "IDX_2f4bdd2593fd6038aaa91fd107"`);
		await queryRunner.query(`DROP INDEX "IDX_b8616deefe44d0622233e73fbf"`);
		await queryRunner.query(`ALTER TABLE "task" RENAME TO "temporary_task"`);
		await queryRunner.query(
			`CREATE TABLE "task" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "title" varchar NOT NULL, "description" varchar, "status" varchar, "estimate" integer, "dueDate" datetime, "projectId" varchar, "creatorId" varchar, "organizationSprintId" varchar, "number" integer, "prefix" varchar, "priority" varchar, "size" varchar, "public" boolean DEFAULT (1), "startDate" datetime, "resolvedAt" datetime, "version" varchar, "issueType" varchar, "parentId" varchar, "taskStatusId" varchar, "taskSizeId" varchar, "taskPriorityId" varchar, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "deletedAt" datetime, "projectModuleId" varchar, CONSTRAINT "FK_b8616deefe44d0622233e73fbf9" FOREIGN KEY ("taskPriorityId") REFERENCES "task_priority" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_2f4bdd2593fd6038aaa91fd1076" FOREIGN KEY ("taskSizeId") REFERENCES "task_size" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_0cbe714983eb0aae5feeee8212b" FOREIGN KEY ("taskStatusId") REFERENCES "task_status" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_e91cbff3d206f150ccc14d0c3a1" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_5b0272d923a31c972bed1a1ac4d" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_3797a20ef5553ae87af126bc2fe" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_94fe6b3a5aec5f85427df4f8cd7" FOREIGN KEY ("creatorId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_1e1f64696aa3a26d3e12c840e55" FOREIGN KEY ("organizationSprintId") REFERENCES "organization_sprint" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_8c9920b5fb32c3d8453f64b705c" FOREIGN KEY ("parentId") REFERENCES "task" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "task"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "title", "description", "status", "estimate", "dueDate", "projectId", "creatorId", "organizationSprintId", "number", "prefix", "priority", "size", "public", "startDate", "resolvedAt", "version", "issueType", "parentId", "taskStatusId", "taskSizeId", "taskPriorityId", "isActive", "isArchived", "deletedAt", "projectModuleId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "title", "description", "status", "estimate", "dueDate", "projectId", "creatorId", "organizationSprintId", "number", "prefix", "priority", "size", "public", "startDate", "resolvedAt", "version", "issueType", "parentId", "taskStatusId", "taskSizeId", "taskPriorityId", "isActive", "isArchived", "deletedAt", "projectModuleId" FROM "temporary_task"`
		);
		await queryRunner.query(`DROP TABLE "temporary_task"`);
		await queryRunner.query(`CREATE INDEX "IDX_579534d8e12f22d308d6bd5f42" ON "task" ("projectModuleId") `);
		await queryRunner.query(`CREATE INDEX "IDX_ca2f7edd5a5ce8f14b257c9d54" ON "task" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_3e16c81005c389a4db83c0e5e3" ON "task" ("isActive") `);
		await queryRunner.query(`CREATE UNIQUE INDEX "taskNumber" ON "task" ("projectId", "number") `);
		await queryRunner.query(`CREATE INDEX "IDX_1e1f64696aa3a26d3e12c840e5" ON "task" ("organizationSprintId") `);
		await queryRunner.query(`CREATE INDEX "IDX_94fe6b3a5aec5f85427df4f8cd" ON "task" ("creatorId") `);
		await queryRunner.query(`CREATE INDEX "IDX_3797a20ef5553ae87af126bc2f" ON "task" ("projectId") `);
		await queryRunner.query(`CREATE INDEX "IDX_5b0272d923a31c972bed1a1ac4" ON "task" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_e91cbff3d206f150ccc14d0c3a" ON "task" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_2fe7a278e6f08d2be55740a939" ON "task" ("status") `);
		await queryRunner.query(`CREATE INDEX "IDX_f092f3386f10f2e2ef5b0b6ad1" ON "task" ("priority") `);
		await queryRunner.query(`CREATE INDEX "IDX_7127880d6fae956ecc1c84ac31" ON "task" ("size") `);
		await queryRunner.query(`CREATE INDEX "IDX_ed5441fb13e82854a994da5a78" ON "task" ("issueType") `);
		await queryRunner.query(`CREATE INDEX "IDX_0cbe714983eb0aae5feeee8212" ON "task" ("taskStatusId") `);
		await queryRunner.query(`CREATE INDEX "IDX_2f4bdd2593fd6038aaa91fd107" ON "task" ("taskSizeId") `);
		await queryRunner.query(`CREATE INDEX "IDX_b8616deefe44d0622233e73fbf" ON "task" ("taskPriorityId") `);
		await queryRunner.query(`DROP INDEX "IDX_e6b6555e5fc6c5120110a0195c"`);
		await queryRunner.query(`DROP INDEX "IDX_8f2054a6a2d4b9c17624b9c8a0"`);
		await queryRunner.query(`DROP INDEX "IDX_7fd3c8f54c01943b283080aefa"`);
		await queryRunner.query(`DROP INDEX "IDX_86438fbaa1d857f32f66b24885"`);
		await queryRunner.query(`DROP INDEX "IDX_cd928adcb5ebb00c9f2c57e390"`);
		await queryRunner.query(`DROP INDEX "IDX_8a7a4d4206c003c3827c5afe5d"`);
		await queryRunner.query(`DROP INDEX "IDX_a56086e95fb2627ba2a3dd2eaa"`);
		await queryRunner.query(`DROP INDEX "IDX_f33638d289aff2306328c32a8c"`);
		await queryRunner.query(
			`ALTER TABLE "organization_project_module" RENAME TO "temporary_organization_project_module"`
		);
		await queryRunner.query(
			`CREATE TABLE "organization_project_module" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "description" text, "status" varchar, "startDate" datetime, "endDate" datetime, "public" boolean DEFAULT (0), "isFavorite" boolean DEFAULT (0), "parentId" varchar, "projectId" varchar, "creatorId" varchar, "managerId" varchar)`
		);
		await queryRunner.query(
			`INSERT INTO "organization_project_module"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "tenantId", "organizationId", "name", "description", "status", "startDate", "endDate", "public", "isFavorite", "parentId", "projectId", "creatorId", "managerId") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "tenantId", "organizationId", "name", "description", "status", "startDate", "endDate", "public", "isFavorite", "parentId", "projectId", "creatorId", "managerId" FROM "temporary_organization_project_module"`
		);
		await queryRunner.query(`DROP TABLE "temporary_organization_project_module"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_e6b6555e5fc6c5120110a0195c" ON "organization_project_module" ("managerId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_8f2054a6a2d4b9c17624b9c8a0" ON "organization_project_module" ("creatorId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_7fd3c8f54c01943b283080aefa" ON "organization_project_module" ("projectId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_86438fbaa1d857f32f66b24885" ON "organization_project_module" ("status") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_cd928adcb5ebb00c9f2c57e390" ON "organization_project_module" ("organizationId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_8a7a4d4206c003c3827c5afe5d" ON "organization_project_module" ("tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_a56086e95fb2627ba2a3dd2eaa" ON "organization_project_module" ("isArchived") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_f33638d289aff2306328c32a8c" ON "organization_project_module" ("isActive") `
		);
		await queryRunner.query(`DROP INDEX "IDX_579534d8e12f22d308d6bd5f42"`);
		await queryRunner.query(`DROP INDEX "IDX_ca2f7edd5a5ce8f14b257c9d54"`);
		await queryRunner.query(`DROP INDEX "IDX_3e16c81005c389a4db83c0e5e3"`);
		await queryRunner.query(`DROP INDEX "taskNumber"`);
		await queryRunner.query(`DROP INDEX "IDX_1e1f64696aa3a26d3e12c840e5"`);
		await queryRunner.query(`DROP INDEX "IDX_94fe6b3a5aec5f85427df4f8cd"`);
		await queryRunner.query(`DROP INDEX "IDX_3797a20ef5553ae87af126bc2f"`);
		await queryRunner.query(`DROP INDEX "IDX_5b0272d923a31c972bed1a1ac4"`);
		await queryRunner.query(`DROP INDEX "IDX_e91cbff3d206f150ccc14d0c3a"`);
		await queryRunner.query(`DROP INDEX "IDX_2fe7a278e6f08d2be55740a939"`);
		await queryRunner.query(`DROP INDEX "IDX_f092f3386f10f2e2ef5b0b6ad1"`);
		await queryRunner.query(`DROP INDEX "IDX_7127880d6fae956ecc1c84ac31"`);
		await queryRunner.query(`DROP INDEX "IDX_ed5441fb13e82854a994da5a78"`);
		await queryRunner.query(`DROP INDEX "IDX_0cbe714983eb0aae5feeee8212"`);
		await queryRunner.query(`DROP INDEX "IDX_2f4bdd2593fd6038aaa91fd107"`);
		await queryRunner.query(`DROP INDEX "IDX_b8616deefe44d0622233e73fbf"`);
		await queryRunner.query(`ALTER TABLE "task" RENAME TO "temporary_task"`);
		await queryRunner.query(
			`CREATE TABLE "task" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "title" varchar NOT NULL, "description" varchar, "status" varchar, "estimate" integer, "dueDate" datetime, "projectId" varchar, "creatorId" varchar, "organizationSprintId" varchar, "number" integer, "prefix" varchar, "priority" varchar, "size" varchar, "public" boolean DEFAULT (1), "startDate" datetime, "resolvedAt" datetime, "version" varchar, "issueType" varchar, "parentId" varchar, "taskStatusId" varchar, "taskSizeId" varchar, "taskPriorityId" varchar, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "deletedAt" datetime, CONSTRAINT "FK_b8616deefe44d0622233e73fbf9" FOREIGN KEY ("taskPriorityId") REFERENCES "task_priority" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_2f4bdd2593fd6038aaa91fd1076" FOREIGN KEY ("taskSizeId") REFERENCES "task_size" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_0cbe714983eb0aae5feeee8212b" FOREIGN KEY ("taskStatusId") REFERENCES "task_status" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_e91cbff3d206f150ccc14d0c3a1" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_5b0272d923a31c972bed1a1ac4d" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_3797a20ef5553ae87af126bc2fe" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_94fe6b3a5aec5f85427df4f8cd7" FOREIGN KEY ("creatorId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_1e1f64696aa3a26d3e12c840e55" FOREIGN KEY ("organizationSprintId") REFERENCES "organization_sprint" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_8c9920b5fb32c3d8453f64b705c" FOREIGN KEY ("parentId") REFERENCES "task" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "task"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "title", "description", "status", "estimate", "dueDate", "projectId", "creatorId", "organizationSprintId", "number", "prefix", "priority", "size", "public", "startDate", "resolvedAt", "version", "issueType", "parentId", "taskStatusId", "taskSizeId", "taskPriorityId", "isActive", "isArchived", "deletedAt") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "title", "description", "status", "estimate", "dueDate", "projectId", "creatorId", "organizationSprintId", "number", "prefix", "priority", "size", "public", "startDate", "resolvedAt", "version", "issueType", "parentId", "taskStatusId", "taskSizeId", "taskPriorityId", "isActive", "isArchived", "deletedAt" FROM "temporary_task"`
		);
		await queryRunner.query(`DROP TABLE "temporary_task"`);
		await queryRunner.query(`CREATE INDEX "IDX_ca2f7edd5a5ce8f14b257c9d54" ON "task" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_3e16c81005c389a4db83c0e5e3" ON "task" ("isActive") `);
		await queryRunner.query(`CREATE UNIQUE INDEX "taskNumber" ON "task" ("projectId", "number") `);
		await queryRunner.query(`CREATE INDEX "IDX_1e1f64696aa3a26d3e12c840e5" ON "task" ("organizationSprintId") `);
		await queryRunner.query(`CREATE INDEX "IDX_94fe6b3a5aec5f85427df4f8cd" ON "task" ("creatorId") `);
		await queryRunner.query(`CREATE INDEX "IDX_3797a20ef5553ae87af126bc2f" ON "task" ("projectId") `);
		await queryRunner.query(`CREATE INDEX "IDX_5b0272d923a31c972bed1a1ac4" ON "task" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_e91cbff3d206f150ccc14d0c3a" ON "task" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_2fe7a278e6f08d2be55740a939" ON "task" ("status") `);
		await queryRunner.query(`CREATE INDEX "IDX_f092f3386f10f2e2ef5b0b6ad1" ON "task" ("priority") `);
		await queryRunner.query(`CREATE INDEX "IDX_7127880d6fae956ecc1c84ac31" ON "task" ("size") `);
		await queryRunner.query(`CREATE INDEX "IDX_ed5441fb13e82854a994da5a78" ON "task" ("issueType") `);
		await queryRunner.query(`CREATE INDEX "IDX_0cbe714983eb0aae5feeee8212" ON "task" ("taskStatusId") `);
		await queryRunner.query(`CREATE INDEX "IDX_2f4bdd2593fd6038aaa91fd107" ON "task" ("taskSizeId") `);
		await queryRunner.query(`CREATE INDEX "IDX_b8616deefe44d0622233e73fbf" ON "task" ("taskPriorityId") `);
		await queryRunner.query(`DROP INDEX "IDX_18e428e909e48a4b7df43d7e01"`);
		await queryRunner.query(`DROP INDEX "IDX_e9fd7310fc93849b1d55e64d28"`);
		await queryRunner.query(`DROP TABLE "project_module_employee"`);
		await queryRunner.query(`DROP INDEX "IDX_d14aeb1b3e08d80eb32dd05934"`);
		await queryRunner.query(`DROP INDEX "IDX_42c46289259b3fcdf2dc61744a"`);
		await queryRunner.query(`DROP TABLE "project_module_team"`);
		await queryRunner.query(`DROP INDEX "IDX_7af935d75a7e21fd76f072fbc0"`);
		await queryRunner.query(`DROP INDEX "IDX_c91ef400079e93fec908cf9384"`);
		await queryRunner.query(`DROP TABLE "project_module_sprint"`);
		await queryRunner.query(`DROP INDEX "IDX_e6b6555e5fc6c5120110a0195c"`);
		await queryRunner.query(`DROP INDEX "IDX_8f2054a6a2d4b9c17624b9c8a0"`);
		await queryRunner.query(`DROP INDEX "IDX_7fd3c8f54c01943b283080aefa"`);
		await queryRunner.query(`DROP INDEX "IDX_86438fbaa1d857f32f66b24885"`);
		await queryRunner.query(`DROP INDEX "IDX_cd928adcb5ebb00c9f2c57e390"`);
		await queryRunner.query(`DROP INDEX "IDX_8a7a4d4206c003c3827c5afe5d"`);
		await queryRunner.query(`DROP INDEX "IDX_a56086e95fb2627ba2a3dd2eaa"`);
		await queryRunner.query(`DROP INDEX "IDX_f33638d289aff2306328c32a8c"`);
		await queryRunner.query(`DROP TABLE "organization_project_module"`);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE \`organization_project_module\` (\`deletedAt\` datetime(6) NULL, \`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`name\` varchar(255) NOT NULL, \`description\` text NULL, \`status\` varchar(255) NULL, \`startDate\` datetime NULL, \`endDate\` datetime NULL, \`public\` tinyint NULL DEFAULT 0, \`isFavorite\` tinyint NULL DEFAULT 0, \`parentId\` varchar(255) NULL, \`projectId\` varchar(255) NULL, \`creatorId\` varchar(255) NULL, \`managerId\` varchar(255) NULL, INDEX \`IDX_f33638d289aff2306328c32a8c\` (\`isActive\`), INDEX \`IDX_a56086e95fb2627ba2a3dd2eaa\` (\`isArchived\`), INDEX \`IDX_8a7a4d4206c003c3827c5afe5d\` (\`tenantId\`), INDEX \`IDX_cd928adcb5ebb00c9f2c57e390\` (\`organizationId\`), INDEX \`IDX_86438fbaa1d857f32f66b24885\` (\`status\`), INDEX \`IDX_7fd3c8f54c01943b283080aefa\` (\`projectId\`), INDEX \`IDX_8f2054a6a2d4b9c17624b9c8a0\` (\`creatorId\`), INDEX \`IDX_e6b6555e5fc6c5120110a0195c\` (\`managerId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`project_module_sprint\` (\`organizationProjectModuleId\` varchar(36) NOT NULL, \`organizationSprintId\` varchar(36) NOT NULL, INDEX \`IDX_c91ef400079e93fec908cf9384\` (\`organizationProjectModuleId\`), INDEX \`IDX_7af935d75a7e21fd76f072fbc0\` (\`organizationSprintId\`), PRIMARY KEY (\`organizationProjectModuleId\`, \`organizationSprintId\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`project_module_team\` (\`organizationProjectModuleId\` varchar(36) NOT NULL, \`organizationTeamId\` varchar(36) NOT NULL, INDEX \`IDX_42c46289259b3fcdf2dc61744a\` (\`organizationProjectModuleId\`), INDEX \`IDX_d14aeb1b3e08d80eb32dd05934\` (\`organizationTeamId\`), PRIMARY KEY (\`organizationProjectModuleId\`, \`organizationTeamId\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`project_module_employee\` (\`organizationProjectModuleId\` varchar(36) NOT NULL, \`employeeId\` varchar(36) NOT NULL, INDEX \`IDX_e9fd7310fc93849b1d55e64d28\` (\`organizationProjectModuleId\`), INDEX \`IDX_18e428e909e48a4b7df43d7e01\` (\`employeeId\`), PRIMARY KEY (\`organizationProjectModuleId\`, \`employeeId\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(`ALTER TABLE \`task\` ADD \`projectModuleId\` varchar(255) NULL`);
		await queryRunner.query(`CREATE INDEX \`IDX_579534d8e12f22d308d6bd5f42\` ON \`task\` (\`projectModuleId\`)`);
		await queryRunner.query(
			`ALTER TABLE \`organization_project_module\` ADD CONSTRAINT \`FK_8a7a4d4206c003c3827c5afe5dc\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_project_module\` ADD CONSTRAINT \`FK_cd928adcb5ebb00c9f2c57e3908\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_project_module\` ADD CONSTRAINT \`FK_4bb6fbfa64cf5d5977c2e5346a9\` FOREIGN KEY (\`parentId\`) REFERENCES \`organization_project_module\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_project_module\` ADD CONSTRAINT \`FK_7fd3c8f54c01943b283080aefa3\` FOREIGN KEY (\`projectId\`) REFERENCES \`organization_project\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_project_module\` ADD CONSTRAINT \`FK_8f2054a6a2d4b9c17624b9c8a01\` FOREIGN KEY (\`creatorId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_project_module\` ADD CONSTRAINT \`FK_e6b6555e5fc6c5120110a0195cd\` FOREIGN KEY (\`managerId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`task\` ADD CONSTRAINT \`FK_579534d8e12f22d308d6bd5f428\` FOREIGN KEY (\`projectModuleId\`) REFERENCES \`organization_project_module\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`project_module_sprint\` ADD CONSTRAINT \`FK_c91ef400079e93fec908cf93845\` FOREIGN KEY (\`organizationProjectModuleId\`) REFERENCES \`organization_project_module\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`project_module_sprint\` ADD CONSTRAINT \`FK_7af935d75a7e21fd76f072fbc03\` FOREIGN KEY (\`organizationSprintId\`) REFERENCES \`organization_sprint\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`project_module_team\` ADD CONSTRAINT \`FK_42c46289259b3fcdf2dc61744a7\` FOREIGN KEY (\`organizationProjectModuleId\`) REFERENCES \`organization_project_module\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`project_module_team\` ADD CONSTRAINT \`FK_d14aeb1b3e08d80eb32dd05934b\` FOREIGN KEY (\`organizationTeamId\`) REFERENCES \`organization_team\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`project_module_employee\` ADD CONSTRAINT \`FK_e9fd7310fc93849b1d55e64d280\` FOREIGN KEY (\`organizationProjectModuleId\`) REFERENCES \`organization_project_module\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`project_module_employee\` ADD CONSTRAINT \`FK_18e428e909e48a4b7df43d7e01e\` FOREIGN KEY (\`employeeId\`) REFERENCES \`employee\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`ALTER TABLE \`project_module_employee\` DROP FOREIGN KEY \`FK_18e428e909e48a4b7df43d7e01e\``
		);
		await queryRunner.query(
			`ALTER TABLE \`project_module_employee\` DROP FOREIGN KEY \`FK_e9fd7310fc93849b1d55e64d280\``
		);
		await queryRunner.query(
			`ALTER TABLE \`project_module_team\` DROP FOREIGN KEY \`FK_d14aeb1b3e08d80eb32dd05934b\``
		);
		await queryRunner.query(
			`ALTER TABLE \`project_module_team\` DROP FOREIGN KEY \`FK_42c46289259b3fcdf2dc61744a7\``
		);
		await queryRunner.query(
			`ALTER TABLE \`project_module_sprint\` DROP FOREIGN KEY \`FK_7af935d75a7e21fd76f072fbc03\``
		);
		await queryRunner.query(
			`ALTER TABLE \`project_module_sprint\` DROP FOREIGN KEY \`FK_c91ef400079e93fec908cf93845\``
		);
		await queryRunner.query(`ALTER TABLE \`task\` DROP FOREIGN KEY \`FK_579534d8e12f22d308d6bd5f428\``);
		await queryRunner.query(
			`ALTER TABLE \`organization_project_module\` DROP FOREIGN KEY \`FK_e6b6555e5fc6c5120110a0195cd\``
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_project_module\` DROP FOREIGN KEY \`FK_8f2054a6a2d4b9c17624b9c8a01\``
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_project_module\` DROP FOREIGN KEY \`FK_7fd3c8f54c01943b283080aefa3\``
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_project_module\` DROP FOREIGN KEY \`FK_4bb6fbfa64cf5d5977c2e5346a9\``
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_project_module\` DROP FOREIGN KEY \`FK_cd928adcb5ebb00c9f2c57e3908\``
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_project_module\` DROP FOREIGN KEY \`FK_8a7a4d4206c003c3827c5afe5dc\``
		);
		await queryRunner.query(`DROP INDEX \`IDX_579534d8e12f22d308d6bd5f42\` ON \`task\``);
		await queryRunner.query(`ALTER TABLE \`task\` DROP COLUMN \`projectModuleId\``);
		await queryRunner.query(`DROP INDEX \`IDX_18e428e909e48a4b7df43d7e01\` ON \`project_module_employee\``);
		await queryRunner.query(`DROP INDEX \`IDX_e9fd7310fc93849b1d55e64d28\` ON \`project_module_employee\``);
		await queryRunner.query(`DROP TABLE \`project_module_employee\``);
		await queryRunner.query(`DROP INDEX \`IDX_d14aeb1b3e08d80eb32dd05934\` ON \`project_module_team\``);
		await queryRunner.query(`DROP INDEX \`IDX_42c46289259b3fcdf2dc61744a\` ON \`project_module_team\``);
		await queryRunner.query(`DROP TABLE \`project_module_team\``);
		await queryRunner.query(`DROP INDEX \`IDX_7af935d75a7e21fd76f072fbc0\` ON \`project_module_sprint\``);
		await queryRunner.query(`DROP INDEX \`IDX_c91ef400079e93fec908cf9384\` ON \`project_module_sprint\``);
		await queryRunner.query(`DROP TABLE \`project_module_sprint\``);
		await queryRunner.query(`DROP INDEX \`IDX_e6b6555e5fc6c5120110a0195c\` ON \`organization_project_module\``);
		await queryRunner.query(`DROP INDEX \`IDX_8f2054a6a2d4b9c17624b9c8a0\` ON \`organization_project_module\``);
		await queryRunner.query(`DROP INDEX \`IDX_7fd3c8f54c01943b283080aefa\` ON \`organization_project_module\``);
		await queryRunner.query(`DROP INDEX \`IDX_86438fbaa1d857f32f66b24885\` ON \`organization_project_module\``);
		await queryRunner.query(`DROP INDEX \`IDX_cd928adcb5ebb00c9f2c57e390\` ON \`organization_project_module\``);
		await queryRunner.query(`DROP INDEX \`IDX_8a7a4d4206c003c3827c5afe5d\` ON \`organization_project_module\``);
		await queryRunner.query(`DROP INDEX \`IDX_a56086e95fb2627ba2a3dd2eaa\` ON \`organization_project_module\``);
		await queryRunner.query(`DROP INDEX \`IDX_f33638d289aff2306328c32a8c\` ON \`organization_project_module\``);
		await queryRunner.query(`DROP TABLE \`organization_project_module\``);
	}
}
