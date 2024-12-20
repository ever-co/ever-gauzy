import { Logger } from '@nestjs/common';
import { MigrationInterface, QueryRunner } from 'typeorm';
import { yellow } from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class CreateScreeningTaskEntity1733566941638 implements MigrationInterface {
	name = 'CreateScreeningTaskEntity1733566941638';

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
        await queryRunner.query(`CREATE TABLE "screening_task" ("deletedAt" TIMESTAMP, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "status" character varying NOT NULL, "onHoldUntil" TIMESTAMP, "taskId" uuid NOT NULL, "creatorId" uuid, CONSTRAINT "REL_4f389fca5d5348dfeb573edba8" UNIQUE ("taskId"), CONSTRAINT "PK_3fa27247b56e45e76f7d89eaffc" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_7302b47755509285f3a3cadfb2" ON "screening_task" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_883f6cb113b97044ecfc1007f1" ON "screening_task" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_1a12e2142255ff971543d67909" ON "screening_task" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_5ec254a71f5c139937772d6b5f" ON "screening_task" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_67c4061374b0972628f99e7eff" ON "screening_task" ("status") `);
        await queryRunner.query(`CREATE INDEX "IDX_4f389fca5d5348dfeb573edba8" ON "screening_task" ("taskId") `);
        await queryRunner.query(`CREATE INDEX "IDX_b7864d01ba77b2d96448779925" ON "screening_task" ("creatorId") `);
        await queryRunner.query(`ALTER TABLE "task" ADD "isScreeningTask" boolean DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "screening_task" ADD CONSTRAINT "FK_1a12e2142255ff971543d67909a" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "screening_task" ADD CONSTRAINT "FK_5ec254a71f5c139937772d6b5fb" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "screening_task" ADD CONSTRAINT "FK_4f389fca5d5348dfeb573edba8a" FOREIGN KEY ("taskId") REFERENCES "task"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "screening_task" ADD CONSTRAINT "FK_b7864d01ba77b2d964487799252" FOREIGN KEY ("creatorId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "screening_task" DROP CONSTRAINT "FK_b7864d01ba77b2d964487799252"`);
        await queryRunner.query(`ALTER TABLE "screening_task" DROP CONSTRAINT "FK_4f389fca5d5348dfeb573edba8a"`);
        await queryRunner.query(`ALTER TABLE "screening_task" DROP CONSTRAINT "FK_5ec254a71f5c139937772d6b5fb"`);
        await queryRunner.query(`ALTER TABLE "screening_task" DROP CONSTRAINT "FK_1a12e2142255ff971543d67909a"`);
        await queryRunner.query(`ALTER TABLE "task" DROP COLUMN "isScreeningTask"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b7864d01ba77b2d96448779925"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_4f389fca5d5348dfeb573edba8"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_67c4061374b0972628f99e7eff"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5ec254a71f5c139937772d6b5f"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1a12e2142255ff971543d67909"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_883f6cb113b97044ecfc1007f1"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7302b47755509285f3a3cadfb2"`);
        await queryRunner.query(`DROP TABLE "screening_task"`);
    }

	/**
    * SqliteDB and BetterSQlite3DB Up Migration
    *
    * @param queryRunner
    */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`CREATE TABLE "screening_task" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "status" varchar NOT NULL, "onHoldUntil" datetime, "taskId" varchar NOT NULL, "creatorId" varchar, CONSTRAINT "REL_4f389fca5d5348dfeb573edba8" UNIQUE ("taskId"))`);
        await queryRunner.query(`CREATE INDEX "IDX_7302b47755509285f3a3cadfb2" ON "screening_task" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_883f6cb113b97044ecfc1007f1" ON "screening_task" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_1a12e2142255ff971543d67909" ON "screening_task" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_5ec254a71f5c139937772d6b5f" ON "screening_task" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_67c4061374b0972628f99e7eff" ON "screening_task" ("status") `);
        await queryRunner.query(`CREATE INDEX "IDX_4f389fca5d5348dfeb573edba8" ON "screening_task" ("taskId") `);
        await queryRunner.query(`CREATE INDEX "IDX_b7864d01ba77b2d96448779925" ON "screening_task" ("creatorId") `);
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
        await queryRunner.query(`CREATE TABLE "temporary_task" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "title" varchar NOT NULL, "description" varchar, "status" varchar, "estimate" integer, "dueDate" datetime, "projectId" varchar, "creatorId" varchar, "organizationSprintId" varchar, "number" integer, "prefix" varchar, "priority" varchar, "size" varchar, "public" boolean DEFAULT (1), "startDate" datetime, "resolvedAt" datetime, "version" varchar, "issueType" varchar, "parentId" varchar, "taskStatusId" varchar, "taskSizeId" varchar, "taskPriorityId" varchar, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "deletedAt" datetime, "isDraft" boolean DEFAULT (0), "archivedAt" datetime, "isScreeningTask" boolean DEFAULT (0), CONSTRAINT "FK_b8616deefe44d0622233e73fbf9" FOREIGN KEY ("taskPriorityId") REFERENCES "task_priority" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_2f4bdd2593fd6038aaa91fd1076" FOREIGN KEY ("taskSizeId") REFERENCES "task_size" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_0cbe714983eb0aae5feeee8212b" FOREIGN KEY ("taskStatusId") REFERENCES "task_status" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_e91cbff3d206f150ccc14d0c3a1" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_5b0272d923a31c972bed1a1ac4d" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_3797a20ef5553ae87af126bc2fe" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_94fe6b3a5aec5f85427df4f8cd7" FOREIGN KEY ("creatorId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_1e1f64696aa3a26d3e12c840e55" FOREIGN KEY ("organizationSprintId") REFERENCES "organization_sprint" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_8c9920b5fb32c3d8453f64b705c" FOREIGN KEY ("parentId") REFERENCES "task" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_task"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "title", "description", "status", "estimate", "dueDate", "projectId", "creatorId", "organizationSprintId", "number", "prefix", "priority", "size", "public", "startDate", "resolvedAt", "version", "issueType", "parentId", "taskStatusId", "taskSizeId", "taskPriorityId", "isActive", "isArchived", "deletedAt", "isDraft", "archivedAt") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "title", "description", "status", "estimate", "dueDate", "projectId", "creatorId", "organizationSprintId", "number", "prefix", "priority", "size", "public", "startDate", "resolvedAt", "version", "issueType", "parentId", "taskStatusId", "taskSizeId", "taskPriorityId", "isActive", "isArchived", "deletedAt", "isDraft", "archivedAt" FROM "task"`);
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
        await queryRunner.query(`DROP INDEX "IDX_7302b47755509285f3a3cadfb2"`);
        await queryRunner.query(`DROP INDEX "IDX_883f6cb113b97044ecfc1007f1"`);
        await queryRunner.query(`DROP INDEX "IDX_1a12e2142255ff971543d67909"`);
        await queryRunner.query(`DROP INDEX "IDX_5ec254a71f5c139937772d6b5f"`);
        await queryRunner.query(`DROP INDEX "IDX_67c4061374b0972628f99e7eff"`);
        await queryRunner.query(`DROP INDEX "IDX_4f389fca5d5348dfeb573edba8"`);
        await queryRunner.query(`DROP INDEX "IDX_b7864d01ba77b2d96448779925"`);
        await queryRunner.query(`CREATE TABLE "temporary_screening_task" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "status" varchar NOT NULL, "onHoldUntil" datetime, "taskId" varchar NOT NULL, "creatorId" varchar, CONSTRAINT "REL_4f389fca5d5348dfeb573edba8" UNIQUE ("taskId"), CONSTRAINT "FK_1a12e2142255ff971543d67909a" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_5ec254a71f5c139937772d6b5fb" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_4f389fca5d5348dfeb573edba8a" FOREIGN KEY ("taskId") REFERENCES "task" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_b7864d01ba77b2d964487799252" FOREIGN KEY ("creatorId") REFERENCES "user" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_screening_task"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "status", "onHoldUntil", "taskId", "creatorId") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "status", "onHoldUntil", "taskId", "creatorId" FROM "screening_task"`);
        await queryRunner.query(`DROP TABLE "screening_task"`);
        await queryRunner.query(`ALTER TABLE "temporary_screening_task" RENAME TO "screening_task"`);
        await queryRunner.query(`CREATE INDEX "IDX_7302b47755509285f3a3cadfb2" ON "screening_task" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_883f6cb113b97044ecfc1007f1" ON "screening_task" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_1a12e2142255ff971543d67909" ON "screening_task" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_5ec254a71f5c139937772d6b5f" ON "screening_task" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_67c4061374b0972628f99e7eff" ON "screening_task" ("status") `);
        await queryRunner.query(`CREATE INDEX "IDX_4f389fca5d5348dfeb573edba8" ON "screening_task" ("taskId") `);
        await queryRunner.query(`CREATE INDEX "IDX_b7864d01ba77b2d96448779925" ON "screening_task" ("creatorId") `);
    }

    /**
    * SqliteDB and BetterSQlite3DB Down Migration
    *
    * @param queryRunner
    */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_b7864d01ba77b2d96448779925"`);
        await queryRunner.query(`DROP INDEX "IDX_4f389fca5d5348dfeb573edba8"`);
        await queryRunner.query(`DROP INDEX "IDX_67c4061374b0972628f99e7eff"`);
        await queryRunner.query(`DROP INDEX "IDX_5ec254a71f5c139937772d6b5f"`);
        await queryRunner.query(`DROP INDEX "IDX_1a12e2142255ff971543d67909"`);
        await queryRunner.query(`DROP INDEX "IDX_883f6cb113b97044ecfc1007f1"`);
        await queryRunner.query(`DROP INDEX "IDX_7302b47755509285f3a3cadfb2"`);
        await queryRunner.query(`ALTER TABLE "screening_task" RENAME TO "temporary_screening_task"`);
        await queryRunner.query(`CREATE TABLE "screening_task" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "status" varchar NOT NULL, "onHoldUntil" datetime, "taskId" varchar NOT NULL, "creatorId" varchar, CONSTRAINT "REL_4f389fca5d5348dfeb573edba8" UNIQUE ("taskId"))`);
        await queryRunner.query(`INSERT INTO "screening_task"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "status", "onHoldUntil", "taskId", "creatorId") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "status", "onHoldUntil", "taskId", "creatorId" FROM "temporary_screening_task"`);
        await queryRunner.query(`DROP TABLE "temporary_screening_task"`);
        await queryRunner.query(`CREATE INDEX "IDX_b7864d01ba77b2d96448779925" ON "screening_task" ("creatorId") `);
        await queryRunner.query(`CREATE INDEX "IDX_4f389fca5d5348dfeb573edba8" ON "screening_task" ("taskId") `);
        await queryRunner.query(`CREATE INDEX "IDX_67c4061374b0972628f99e7eff" ON "screening_task" ("status") `);
        await queryRunner.query(`CREATE INDEX "IDX_5ec254a71f5c139937772d6b5f" ON "screening_task" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_1a12e2142255ff971543d67909" ON "screening_task" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_883f6cb113b97044ecfc1007f1" ON "screening_task" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_7302b47755509285f3a3cadfb2" ON "screening_task" ("isActive") `);
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
        await queryRunner.query(`CREATE TABLE "task" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "title" varchar NOT NULL, "description" varchar, "status" varchar, "estimate" integer, "dueDate" datetime, "projectId" varchar, "creatorId" varchar, "organizationSprintId" varchar, "number" integer, "prefix" varchar, "priority" varchar, "size" varchar, "public" boolean DEFAULT (1), "startDate" datetime, "resolvedAt" datetime, "version" varchar, "issueType" varchar, "parentId" varchar, "taskStatusId" varchar, "taskSizeId" varchar, "taskPriorityId" varchar, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "deletedAt" datetime, "isDraft" boolean DEFAULT (0), "archivedAt" datetime, CONSTRAINT "FK_b8616deefe44d0622233e73fbf9" FOREIGN KEY ("taskPriorityId") REFERENCES "task_priority" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_2f4bdd2593fd6038aaa91fd1076" FOREIGN KEY ("taskSizeId") REFERENCES "task_size" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_0cbe714983eb0aae5feeee8212b" FOREIGN KEY ("taskStatusId") REFERENCES "task_status" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_e91cbff3d206f150ccc14d0c3a1" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_5b0272d923a31c972bed1a1ac4d" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_3797a20ef5553ae87af126bc2fe" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_94fe6b3a5aec5f85427df4f8cd7" FOREIGN KEY ("creatorId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_1e1f64696aa3a26d3e12c840e55" FOREIGN KEY ("organizationSprintId") REFERENCES "organization_sprint" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_8c9920b5fb32c3d8453f64b705c" FOREIGN KEY ("parentId") REFERENCES "task" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "task"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "title", "description", "status", "estimate", "dueDate", "projectId", "creatorId", "organizationSprintId", "number", "prefix", "priority", "size", "public", "startDate", "resolvedAt", "version", "issueType", "parentId", "taskStatusId", "taskSizeId", "taskPriorityId", "isActive", "isArchived", "deletedAt", "isDraft", "archivedAt") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "title", "description", "status", "estimate", "dueDate", "projectId", "creatorId", "organizationSprintId", "number", "prefix", "priority", "size", "public", "startDate", "resolvedAt", "version", "issueType", "parentId", "taskStatusId", "taskSizeId", "taskPriorityId", "isActive", "isArchived", "deletedAt", "isDraft", "archivedAt" FROM "temporary_task"`);
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
        await queryRunner.query(`DROP INDEX "IDX_b7864d01ba77b2d96448779925"`);
        await queryRunner.query(`DROP INDEX "IDX_4f389fca5d5348dfeb573edba8"`);
        await queryRunner.query(`DROP INDEX "IDX_67c4061374b0972628f99e7eff"`);
        await queryRunner.query(`DROP INDEX "IDX_5ec254a71f5c139937772d6b5f"`);
        await queryRunner.query(`DROP INDEX "IDX_1a12e2142255ff971543d67909"`);
        await queryRunner.query(`DROP INDEX "IDX_883f6cb113b97044ecfc1007f1"`);
        await queryRunner.query(`DROP INDEX "IDX_7302b47755509285f3a3cadfb2"`);
        await queryRunner.query(`DROP TABLE "screening_task"`);
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
