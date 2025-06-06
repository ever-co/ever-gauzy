import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class CreateProjectModuleTaskTable1727152443794 implements MigrationInterface {
	name = 'CreateProjectModuleTaskTable1727152443794';

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
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
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
		await queryRunner.query(
			`CREATE TABLE "temporary_task" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "title" varchar NOT NULL, "description" varchar, "status" varchar, "estimate" integer, "dueDate" datetime, "projectId" varchar, "creatorId" varchar, "organizationSprintId" varchar, "number" integer, "prefix" varchar, "priority" varchar, "size" varchar, "public" boolean DEFAULT (1), "startDate" datetime, "resolvedAt" datetime, "version" varchar, "issueType" varchar, "parentId" varchar, "taskStatusId" varchar, "taskSizeId" varchar, "taskPriorityId" varchar, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "deletedAt" datetime, "projectModuleId" varchar, "isDraft" boolean DEFAULT (0), "archivedAt" datetime, CONSTRAINT "FK_8c9920b5fb32c3d8453f64b705c" FOREIGN KEY ("parentId") REFERENCES "task" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_1e1f64696aa3a26d3e12c840e55" FOREIGN KEY ("organizationSprintId") REFERENCES "organization_sprint" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_94fe6b3a5aec5f85427df4f8cd7" FOREIGN KEY ("creatorId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_3797a20ef5553ae87af126bc2fe" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_5b0272d923a31c972bed1a1ac4d" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_e91cbff3d206f150ccc14d0c3a1" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_0cbe714983eb0aae5feeee8212b" FOREIGN KEY ("taskStatusId") REFERENCES "task_status" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_2f4bdd2593fd6038aaa91fd1076" FOREIGN KEY ("taskSizeId") REFERENCES "task_size" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_b8616deefe44d0622233e73fbf9" FOREIGN KEY ("taskPriorityId") REFERENCES "task_priority" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_task"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "title", "description", "status", "estimate", "dueDate", "projectId", "creatorId", "organizationSprintId", "number", "prefix", "priority", "size", "public", "startDate", "resolvedAt", "version", "issueType", "parentId", "taskStatusId", "taskSizeId", "taskPriorityId", "isActive", "isArchived", "deletedAt", "projectModuleId", "isDraft", "archivedAt") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "title", "description", "status", "estimate", "dueDate", "projectId", "creatorId", "organizationSprintId", "number", "prefix", "priority", "size", "public", "startDate", "resolvedAt", "version", "issueType", "parentId", "taskStatusId", "taskSizeId", "taskPriorityId", "isActive", "isArchived", "deletedAt", "projectModuleId", "isDraft", "archivedAt" FROM "task"`
		);
		await queryRunner.query(`DROP TABLE "task"`);
		await queryRunner.query(`ALTER TABLE "temporary_task" RENAME TO "task"`);
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
		await queryRunner.query(`DROP INDEX "IDX_579534d8e12f22d308d6bd5f42"`);
		await queryRunner.query(
			`CREATE TABLE "project_module_task" ("organizationProjectModuleId" varchar NOT NULL, "taskId" varchar NOT NULL, PRIMARY KEY ("organizationProjectModuleId", "taskId"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_58941b9cf23de12b2ecea4a959" ON "project_module_task" ("organizationProjectModuleId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_d056d5ba005e15ff92d4d7a8ca" ON "project_module_task" ("taskId") `);
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
		await queryRunner.query(
			`CREATE TABLE "temporary_task" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "title" varchar NOT NULL, "description" varchar, "status" varchar, "estimate" integer, "dueDate" datetime, "projectId" varchar, "creatorId" varchar, "organizationSprintId" varchar, "number" integer, "prefix" varchar, "priority" varchar, "size" varchar, "public" boolean DEFAULT (1), "startDate" datetime, "resolvedAt" datetime, "version" varchar, "issueType" varchar, "parentId" varchar, "taskStatusId" varchar, "taskSizeId" varchar, "taskPriorityId" varchar, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "deletedAt" datetime, "isDraft" boolean DEFAULT (0), "archivedAt" datetime, CONSTRAINT "FK_8c9920b5fb32c3d8453f64b705c" FOREIGN KEY ("parentId") REFERENCES "task" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_1e1f64696aa3a26d3e12c840e55" FOREIGN KEY ("organizationSprintId") REFERENCES "organization_sprint" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_94fe6b3a5aec5f85427df4f8cd7" FOREIGN KEY ("creatorId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_3797a20ef5553ae87af126bc2fe" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_5b0272d923a31c972bed1a1ac4d" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_e91cbff3d206f150ccc14d0c3a1" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_0cbe714983eb0aae5feeee8212b" FOREIGN KEY ("taskStatusId") REFERENCES "task_status" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_2f4bdd2593fd6038aaa91fd1076" FOREIGN KEY ("taskSizeId") REFERENCES "task_size" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_b8616deefe44d0622233e73fbf9" FOREIGN KEY ("taskPriorityId") REFERENCES "task_priority" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_task"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "title", "description", "status", "estimate", "dueDate", "projectId", "creatorId", "organizationSprintId", "number", "prefix", "priority", "size", "public", "startDate", "resolvedAt", "version", "issueType", "parentId", "taskStatusId", "taskSizeId", "taskPriorityId", "isActive", "isArchived", "deletedAt", "isDraft", "archivedAt") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "title", "description", "status", "estimate", "dueDate", "projectId", "creatorId", "organizationSprintId", "number", "prefix", "priority", "size", "public", "startDate", "resolvedAt", "version", "issueType", "parentId", "taskStatusId", "taskSizeId", "taskPriorityId", "isActive", "isArchived", "deletedAt", "isDraft", "archivedAt" FROM "task"`
		);
		await queryRunner.query(`DROP TABLE "task"`);
		await queryRunner.query(`ALTER TABLE "temporary_task" RENAME TO "task"`);
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
		await queryRunner.query(`DROP INDEX "IDX_58941b9cf23de12b2ecea4a959"`);
		await queryRunner.query(`DROP INDEX "IDX_d056d5ba005e15ff92d4d7a8ca"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_project_module_task" ("organizationProjectModuleId" varchar NOT NULL, "taskId" varchar NOT NULL, CONSTRAINT "FK_58941b9cf23de12b2ecea4a959f" FOREIGN KEY ("organizationProjectModuleId") REFERENCES "organization_project_module" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_d056d5ba005e15ff92d4d7a8ca5" FOREIGN KEY ("taskId") REFERENCES "task" ("id") ON DELETE CASCADE ON UPDATE CASCADE, PRIMARY KEY ("organizationProjectModuleId", "taskId"))`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_project_module_task"("organizationProjectModuleId", "taskId") SELECT "organizationProjectModuleId", "taskId" FROM "project_module_task"`
		);
		await queryRunner.query(`DROP TABLE "project_module_task"`);
		await queryRunner.query(`ALTER TABLE "temporary_project_module_task" RENAME TO "project_module_task"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_58941b9cf23de12b2ecea4a959" ON "project_module_task" ("organizationProjectModuleId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_d056d5ba005e15ff92d4d7a8ca" ON "project_module_task" ("taskId") `);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_d056d5ba005e15ff92d4d7a8ca"`);
		await queryRunner.query(`DROP INDEX "IDX_58941b9cf23de12b2ecea4a959"`);
		await queryRunner.query(`ALTER TABLE "project_module_task" RENAME TO "temporary_project_module_task"`);
		await queryRunner.query(
			`CREATE TABLE "project_module_task" ("organizationProjectModuleId" varchar NOT NULL, "taskId" varchar NOT NULL, PRIMARY KEY ("organizationProjectModuleId", "taskId"))`
		);
		await queryRunner.query(
			`INSERT INTO "project_module_task"("organizationProjectModuleId", "taskId") SELECT "organizationProjectModuleId", "taskId" FROM "temporary_project_module_task"`
		);
		await queryRunner.query(`DROP TABLE "temporary_project_module_task"`);
		await queryRunner.query(`CREATE INDEX "IDX_d056d5ba005e15ff92d4d7a8ca" ON "project_module_task" ("taskId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_58941b9cf23de12b2ecea4a959" ON "project_module_task" ("organizationProjectModuleId") `
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
		await queryRunner.query(`ALTER TABLE "task" RENAME TO "temporary_task"`);
		await queryRunner.query(
			`CREATE TABLE "task" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "title" varchar NOT NULL, "description" varchar, "status" varchar, "estimate" integer, "dueDate" datetime, "projectId" varchar, "creatorId" varchar, "organizationSprintId" varchar, "number" integer, "prefix" varchar, "priority" varchar, "size" varchar, "public" boolean DEFAULT (1), "startDate" datetime, "resolvedAt" datetime, "version" varchar, "issueType" varchar, "parentId" varchar, "taskStatusId" varchar, "taskSizeId" varchar, "taskPriorityId" varchar, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "deletedAt" datetime, "projectModuleId" varchar, "isDraft" boolean DEFAULT (0), "archivedAt" datetime, CONSTRAINT "FK_8c9920b5fb32c3d8453f64b705c" FOREIGN KEY ("parentId") REFERENCES "task" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_1e1f64696aa3a26d3e12c840e55" FOREIGN KEY ("organizationSprintId") REFERENCES "organization_sprint" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_94fe6b3a5aec5f85427df4f8cd7" FOREIGN KEY ("creatorId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_3797a20ef5553ae87af126bc2fe" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_5b0272d923a31c972bed1a1ac4d" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_e91cbff3d206f150ccc14d0c3a1" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_0cbe714983eb0aae5feeee8212b" FOREIGN KEY ("taskStatusId") REFERENCES "task_status" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_2f4bdd2593fd6038aaa91fd1076" FOREIGN KEY ("taskSizeId") REFERENCES "task_size" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_b8616deefe44d0622233e73fbf9" FOREIGN KEY ("taskPriorityId") REFERENCES "task_priority" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "task"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "title", "description", "status", "estimate", "dueDate", "projectId", "creatorId", "organizationSprintId", "number", "prefix", "priority", "size", "public", "startDate", "resolvedAt", "version", "issueType", "parentId", "taskStatusId", "taskSizeId", "taskPriorityId", "isActive", "isArchived", "deletedAt", "isDraft", "archivedAt") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "title", "description", "status", "estimate", "dueDate", "projectId", "creatorId", "organizationSprintId", "number", "prefix", "priority", "size", "public", "startDate", "resolvedAt", "version", "issueType", "parentId", "taskStatusId", "taskSizeId", "taskPriorityId", "isActive", "isArchived", "deletedAt", "isDraft", "archivedAt" FROM "temporary_task"`
		);
		await queryRunner.query(`DROP TABLE "temporary_task"`);
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
		await queryRunner.query(`DROP INDEX "IDX_d056d5ba005e15ff92d4d7a8ca"`);
		await queryRunner.query(`DROP INDEX "IDX_58941b9cf23de12b2ecea4a959"`);
		await queryRunner.query(`DROP TABLE "project_module_task"`);
		await queryRunner.query(`CREATE INDEX "IDX_579534d8e12f22d308d6bd5f42" ON "task" ("projectModuleId") `);
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
		await queryRunner.query(`ALTER TABLE "task" RENAME TO "temporary_task"`);
		await queryRunner.query(
			`CREATE TABLE "task" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "title" varchar NOT NULL, "description" varchar, "status" varchar, "estimate" integer, "dueDate" datetime, "projectId" varchar, "creatorId" varchar, "organizationSprintId" varchar, "number" integer, "prefix" varchar, "priority" varchar, "size" varchar, "public" boolean DEFAULT (1), "startDate" datetime, "resolvedAt" datetime, "version" varchar, "issueType" varchar, "parentId" varchar, "taskStatusId" varchar, "taskSizeId" varchar, "taskPriorityId" varchar, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "deletedAt" datetime, "projectModuleId" varchar, "isDraft" boolean DEFAULT (0), "archivedAt" datetime, CONSTRAINT "FK_579534d8e12f22d308d6bd5f428" FOREIGN KEY ("projectModuleId") REFERENCES "organization_project_module" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_8c9920b5fb32c3d8453f64b705c" FOREIGN KEY ("parentId") REFERENCES "task" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_1e1f64696aa3a26d3e12c840e55" FOREIGN KEY ("organizationSprintId") REFERENCES "organization_sprint" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_94fe6b3a5aec5f85427df4f8cd7" FOREIGN KEY ("creatorId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_3797a20ef5553ae87af126bc2fe" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_5b0272d923a31c972bed1a1ac4d" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_e91cbff3d206f150ccc14d0c3a1" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_0cbe714983eb0aae5feeee8212b" FOREIGN KEY ("taskStatusId") REFERENCES "task_status" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_2f4bdd2593fd6038aaa91fd1076" FOREIGN KEY ("taskSizeId") REFERENCES "task_size" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_b8616deefe44d0622233e73fbf9" FOREIGN KEY ("taskPriorityId") REFERENCES "task_priority" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "task"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "title", "description", "status", "estimate", "dueDate", "projectId", "creatorId", "organizationSprintId", "number", "prefix", "priority", "size", "public", "startDate", "resolvedAt", "version", "issueType", "parentId", "taskStatusId", "taskSizeId", "taskPriorityId", "isActive", "isArchived", "deletedAt", "projectModuleId", "isDraft", "archivedAt") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "title", "description", "status", "estimate", "dueDate", "projectId", "creatorId", "organizationSprintId", "number", "prefix", "priority", "size", "public", "startDate", "resolvedAt", "version", "issueType", "parentId", "taskStatusId", "taskSizeId", "taskPriorityId", "isActive", "isArchived", "deletedAt", "projectModuleId", "isDraft", "archivedAt" FROM "temporary_task"`
		);
		await queryRunner.query(`DROP TABLE "temporary_task"`);
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
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE \`task\` DROP FOREIGN KEY \`FK_579534d8e12f22d308d6bd5f428\``);
		await queryRunner.query(`DROP INDEX \`IDX_579534d8e12f22d308d6bd5f42\` ON \`task\``);
		await queryRunner.query(
			`CREATE TABLE \`project_module_task\` (\`organizationProjectModuleId\` varchar(36) NOT NULL, \`taskId\` varchar(36) NOT NULL, INDEX \`IDX_58941b9cf23de12b2ecea4a959\` (\`organizationProjectModuleId\`), INDEX \`IDX_d056d5ba005e15ff92d4d7a8ca\` (\`taskId\`), PRIMARY KEY (\`organizationProjectModuleId\`, \`taskId\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(`ALTER TABLE \`task\` DROP COLUMN \`projectModuleId\``);
		await queryRunner.query(
			`ALTER TABLE \`project_module_task\` ADD CONSTRAINT \`FK_58941b9cf23de12b2ecea4a959f\` FOREIGN KEY (\`organizationProjectModuleId\`) REFERENCES \`organization_project_module\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`project_module_task\` ADD CONSTRAINT \`FK_d056d5ba005e15ff92d4d7a8ca5\` FOREIGN KEY (\`taskId\`) REFERENCES \`task\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`ALTER TABLE \`project_module_task\` DROP FOREIGN KEY \`FK_d056d5ba005e15ff92d4d7a8ca5\``
		);
		await queryRunner.query(
			`ALTER TABLE \`project_module_task\` DROP FOREIGN KEY \`FK_58941b9cf23de12b2ecea4a959f\``
		);
		await queryRunner.query(`ALTER TABLE \`task\` ADD \`projectModuleId\` varchar(255) NULL`);
		await queryRunner.query(`DROP INDEX \`IDX_d056d5ba005e15ff92d4d7a8ca\` ON \`project_module_task\``);
		await queryRunner.query(`DROP INDEX \`IDX_58941b9cf23de12b2ecea4a959\` ON \`project_module_task\``);
		await queryRunner.query(`DROP TABLE \`project_module_task\``);
		await queryRunner.query(`CREATE INDEX \`IDX_579534d8e12f22d308d6bd5f42\` ON \`task\` (\`projectModuleId\`)`);
		await queryRunner.query(
			`ALTER TABLE \`task\` ADD CONSTRAINT \`FK_579534d8e12f22d308d6bd5f428\` FOREIGN KEY (\`projectModuleId\`) REFERENCES \`organization_project_module\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}
}
