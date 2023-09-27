import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlterTableTask1695570009125 implements MigrationInterface {
	name = 'AlterTableTask1695570009125';

	/**
	 * Up Migration
	 *
	 * @param queryRunner
	 */
	public async up(queryRunner: QueryRunner): Promise<any> {
		if (queryRunner.connection.options.type === 'sqlite') {
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
		if (queryRunner.connection.options.type === 'sqlite') {
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
		await queryRunner.query(`ALTER TABLE "task" ADD "taskStatusId" uuid`);
		await queryRunner.query(`ALTER TABLE "task" ADD "taskSizeId" uuid`);
		await queryRunner.query(`ALTER TABLE "task" ADD "taskPriorityId" uuid`);
		await queryRunner.query(
			`CREATE INDEX "IDX_0cbe714983eb0aae5feeee8212" ON "task" ("taskStatusId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_2f4bdd2593fd6038aaa91fd107" ON "task" ("taskSizeId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_b8616deefe44d0622233e73fbf" ON "task" ("taskPriorityId") `
		);
		await queryRunner.query(
			`ALTER TABLE "task" ADD CONSTRAINT "FK_0cbe714983eb0aae5feeee8212b" FOREIGN KEY ("taskStatusId") REFERENCES "task_status"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "task" ADD CONSTRAINT "FK_2f4bdd2593fd6038aaa91fd1076" FOREIGN KEY ("taskSizeId") REFERENCES "task_size"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "task" ADD CONSTRAINT "FK_b8616deefe44d0622233e73fbf9" FOREIGN KEY ("taskPriorityId") REFERENCES "task_priority"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(
		queryRunner: QueryRunner
	): Promise<any> {
		await queryRunner.query(
			`ALTER TABLE "task" DROP CONSTRAINT "FK_b8616deefe44d0622233e73fbf9"`
		);
		await queryRunner.query(
			`ALTER TABLE "task" DROP CONSTRAINT "FK_2f4bdd2593fd6038aaa91fd1076"`
		);
		await queryRunner.query(
			`ALTER TABLE "task" DROP CONSTRAINT "FK_0cbe714983eb0aae5feeee8212b"`
		);
		await queryRunner.query(
			`DROP INDEX "public"."IDX_b8616deefe44d0622233e73fbf"`
		);
		await queryRunner.query(
			`DROP INDEX "public"."IDX_2f4bdd2593fd6038aaa91fd107"`
		);
		await queryRunner.query(
			`DROP INDEX "public"."IDX_0cbe714983eb0aae5feeee8212"`
		);
		await queryRunner.query(
			`ALTER TABLE "task" DROP COLUMN "taskPriorityId"`
		);
		await queryRunner.query(`ALTER TABLE "task" DROP COLUMN "taskSizeId"`);
		await queryRunner.query(
			`ALTER TABLE "task" DROP COLUMN "taskStatusId"`
		);
	}

	/**
	 * SqliteDB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
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
		await queryRunner.query(
			`CREATE TABLE "temporary_task" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "title" varchar NOT NULL, "description" varchar, "status" varchar, "estimate" integer, "dueDate" datetime, "projectId" varchar, "creatorId" varchar, "organizationSprintId" varchar, "number" integer, "prefix" varchar, "priority" varchar, "size" varchar, "public" boolean DEFAULT (1), "startDate" datetime, "resolvedAt" datetime, "version" varchar, "issueType" varchar, "parentId" varchar, "taskStatusId" varchar, "taskSizeId" varchar, "taskPriorityId" varchar, CONSTRAINT "FK_8c9920b5fb32c3d8453f64b705c" FOREIGN KEY ("parentId") REFERENCES "task" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_1e1f64696aa3a26d3e12c840e55" FOREIGN KEY ("organizationSprintId") REFERENCES "organization_sprint" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_94fe6b3a5aec5f85427df4f8cd7" FOREIGN KEY ("creatorId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_3797a20ef5553ae87af126bc2fe" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_5b0272d923a31c972bed1a1ac4d" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_e91cbff3d206f150ccc14d0c3a1" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_task"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "title", "description", "status", "estimate", "dueDate", "projectId", "creatorId", "organizationSprintId", "number", "prefix", "priority", "size", "public", "startDate", "resolvedAt", "version", "issueType", "parentId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "title", "description", "status", "estimate", "dueDate", "projectId", "creatorId", "organizationSprintId", "number", "prefix", "priority", "size", "public", "startDate", "resolvedAt", "version", "issueType", "parentId" FROM "task"`
		);
		await queryRunner.query(`DROP TABLE "task"`);
		await queryRunner.query(
			`ALTER TABLE "temporary_task" RENAME TO "task"`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "taskNumber" ON "task" ("projectId", "number") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_1e1f64696aa3a26d3e12c840e5" ON "task" ("organizationSprintId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_94fe6b3a5aec5f85427df4f8cd" ON "task" ("creatorId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_3797a20ef5553ae87af126bc2f" ON "task" ("projectId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_5b0272d923a31c972bed1a1ac4" ON "task" ("organizationId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_e91cbff3d206f150ccc14d0c3a" ON "task" ("tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_2fe7a278e6f08d2be55740a939" ON "task" ("status") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_f092f3386f10f2e2ef5b0b6ad1" ON "task" ("priority") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_7127880d6fae956ecc1c84ac31" ON "task" ("size") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_ed5441fb13e82854a994da5a78" ON "task" ("issueType") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_0cbe714983eb0aae5feeee8212" ON "task" ("taskStatusId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_2f4bdd2593fd6038aaa91fd107" ON "task" ("taskSizeId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_b8616deefe44d0622233e73fbf" ON "task" ("taskPriorityId") `
		);
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
			`CREATE TABLE "temporary_task" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "title" varchar NOT NULL, "description" varchar, "status" varchar, "estimate" integer, "dueDate" datetime, "projectId" varchar, "creatorId" varchar, "organizationSprintId" varchar, "number" integer, "prefix" varchar, "priority" varchar, "size" varchar, "public" boolean DEFAULT (1), "startDate" datetime, "resolvedAt" datetime, "version" varchar, "issueType" varchar, "parentId" varchar, "taskStatusId" varchar, "taskSizeId" varchar, "taskPriorityId" varchar, CONSTRAINT "FK_8c9920b5fb32c3d8453f64b705c" FOREIGN KEY ("parentId") REFERENCES "task" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_1e1f64696aa3a26d3e12c840e55" FOREIGN KEY ("organizationSprintId") REFERENCES "organization_sprint" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_94fe6b3a5aec5f85427df4f8cd7" FOREIGN KEY ("creatorId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_3797a20ef5553ae87af126bc2fe" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_5b0272d923a31c972bed1a1ac4d" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_e91cbff3d206f150ccc14d0c3a1" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_0cbe714983eb0aae5feeee8212b" FOREIGN KEY ("taskStatusId") REFERENCES "task_status" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_2f4bdd2593fd6038aaa91fd1076" FOREIGN KEY ("taskSizeId") REFERENCES "task_size" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_b8616deefe44d0622233e73fbf9" FOREIGN KEY ("taskPriorityId") REFERENCES "task_priority" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_task"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "title", "description", "status", "estimate", "dueDate", "projectId", "creatorId", "organizationSprintId", "number", "prefix", "priority", "size", "public", "startDate", "resolvedAt", "version", "issueType", "parentId", "taskStatusId", "taskSizeId", "taskPriorityId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "title", "description", "status", "estimate", "dueDate", "projectId", "creatorId", "organizationSprintId", "number", "prefix", "priority", "size", "public", "startDate", "resolvedAt", "version", "issueType", "parentId", "taskStatusId", "taskSizeId", "taskPriorityId" FROM "task"`
		);
		await queryRunner.query(`DROP TABLE "task"`);
		await queryRunner.query(
			`ALTER TABLE "temporary_task" RENAME TO "task"`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "taskNumber" ON "task" ("projectId", "number") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_1e1f64696aa3a26d3e12c840e5" ON "task" ("organizationSprintId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_94fe6b3a5aec5f85427df4f8cd" ON "task" ("creatorId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_3797a20ef5553ae87af126bc2f" ON "task" ("projectId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_5b0272d923a31c972bed1a1ac4" ON "task" ("organizationId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_e91cbff3d206f150ccc14d0c3a" ON "task" ("tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_2fe7a278e6f08d2be55740a939" ON "task" ("status") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_f092f3386f10f2e2ef5b0b6ad1" ON "task" ("priority") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_7127880d6fae956ecc1c84ac31" ON "task" ("size") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_ed5441fb13e82854a994da5a78" ON "task" ("issueType") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_0cbe714983eb0aae5feeee8212" ON "task" ("taskStatusId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_2f4bdd2593fd6038aaa91fd107" ON "task" ("taskSizeId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_b8616deefe44d0622233e73fbf" ON "task" ("taskPriorityId") `
		);
	}

	/**
	 * SqliteDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
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
		await queryRunner.query(
			`ALTER TABLE "task" RENAME TO "temporary_task"`
		);
		await queryRunner.query(
			`CREATE TABLE "task" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "title" varchar NOT NULL, "description" varchar, "status" varchar, "estimate" integer, "dueDate" datetime, "projectId" varchar, "creatorId" varchar, "organizationSprintId" varchar, "number" integer, "prefix" varchar, "priority" varchar, "size" varchar, "public" boolean DEFAULT (1), "startDate" datetime, "resolvedAt" datetime, "version" varchar, "issueType" varchar, "parentId" varchar, "taskStatusId" varchar, "taskSizeId" varchar, "taskPriorityId" varchar, CONSTRAINT "FK_8c9920b5fb32c3d8453f64b705c" FOREIGN KEY ("parentId") REFERENCES "task" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_1e1f64696aa3a26d3e12c840e55" FOREIGN KEY ("organizationSprintId") REFERENCES "organization_sprint" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_94fe6b3a5aec5f85427df4f8cd7" FOREIGN KEY ("creatorId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_3797a20ef5553ae87af126bc2fe" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_5b0272d923a31c972bed1a1ac4d" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_e91cbff3d206f150ccc14d0c3a1" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "task"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "title", "description", "status", "estimate", "dueDate", "projectId", "creatorId", "organizationSprintId", "number", "prefix", "priority", "size", "public", "startDate", "resolvedAt", "version", "issueType", "parentId", "taskStatusId", "taskSizeId", "taskPriorityId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "title", "description", "status", "estimate", "dueDate", "projectId", "creatorId", "organizationSprintId", "number", "prefix", "priority", "size", "public", "startDate", "resolvedAt", "version", "issueType", "parentId", "taskStatusId", "taskSizeId", "taskPriorityId" FROM "temporary_task"`
		);
		await queryRunner.query(`DROP TABLE "temporary_task"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_b8616deefe44d0622233e73fbf" ON "task" ("taskPriorityId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_2f4bdd2593fd6038aaa91fd107" ON "task" ("taskSizeId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_0cbe714983eb0aae5feeee8212" ON "task" ("taskStatusId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_ed5441fb13e82854a994da5a78" ON "task" ("issueType") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_7127880d6fae956ecc1c84ac31" ON "task" ("size") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_f092f3386f10f2e2ef5b0b6ad1" ON "task" ("priority") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_2fe7a278e6f08d2be55740a939" ON "task" ("status") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_e91cbff3d206f150ccc14d0c3a" ON "task" ("tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_5b0272d923a31c972bed1a1ac4" ON "task" ("organizationId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_3797a20ef5553ae87af126bc2f" ON "task" ("projectId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_94fe6b3a5aec5f85427df4f8cd" ON "task" ("creatorId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_1e1f64696aa3a26d3e12c840e5" ON "task" ("organizationSprintId") `
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "taskNumber" ON "task" ("projectId", "number") `
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
		await queryRunner.query(
			`ALTER TABLE "task" RENAME TO "temporary_task"`
		);
		await queryRunner.query(
			`CREATE TABLE "task" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "title" varchar NOT NULL, "description" varchar, "status" varchar, "estimate" integer, "dueDate" datetime, "projectId" varchar, "creatorId" varchar, "organizationSprintId" varchar, "number" integer, "prefix" varchar, "priority" varchar, "size" varchar, "public" boolean DEFAULT (1), "startDate" datetime, "resolvedAt" datetime, "version" varchar, "issueType" varchar, "parentId" varchar, CONSTRAINT "FK_8c9920b5fb32c3d8453f64b705c" FOREIGN KEY ("parentId") REFERENCES "task" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_1e1f64696aa3a26d3e12c840e55" FOREIGN KEY ("organizationSprintId") REFERENCES "organization_sprint" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_94fe6b3a5aec5f85427df4f8cd7" FOREIGN KEY ("creatorId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_3797a20ef5553ae87af126bc2fe" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_5b0272d923a31c972bed1a1ac4d" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_e91cbff3d206f150ccc14d0c3a1" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "task"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "title", "description", "status", "estimate", "dueDate", "projectId", "creatorId", "organizationSprintId", "number", "prefix", "priority", "size", "public", "startDate", "resolvedAt", "version", "issueType", "parentId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "title", "description", "status", "estimate", "dueDate", "projectId", "creatorId", "organizationSprintId", "number", "prefix", "priority", "size", "public", "startDate", "resolvedAt", "version", "issueType", "parentId" FROM "temporary_task"`
		);
		await queryRunner.query(`DROP TABLE "temporary_task"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_ed5441fb13e82854a994da5a78" ON "task" ("issueType") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_7127880d6fae956ecc1c84ac31" ON "task" ("size") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_f092f3386f10f2e2ef5b0b6ad1" ON "task" ("priority") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_2fe7a278e6f08d2be55740a939" ON "task" ("status") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_e91cbff3d206f150ccc14d0c3a" ON "task" ("tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_5b0272d923a31c972bed1a1ac4" ON "task" ("organizationId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_3797a20ef5553ae87af126bc2f" ON "task" ("projectId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_94fe6b3a5aec5f85427df4f8cd" ON "task" ("creatorId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_1e1f64696aa3a26d3e12c840e5" ON "task" ("organizationSprintId") `
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "taskNumber" ON "task" ("projectId", "number") `
		);
	}
}
