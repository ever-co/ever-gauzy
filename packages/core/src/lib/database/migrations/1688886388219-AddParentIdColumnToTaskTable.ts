import { MigrationInterface, QueryRunner } from "typeorm";
import * as chalk from "chalk";
import { DatabaseTypeEnum } from "@gauzy/config";

export class AddParentIdColumnToTaskTable1688886388219 implements MigrationInterface {

    name = 'AddParentIdColumnToTaskTable1688886388219';

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
        await queryRunner.query(`ALTER TABLE "task" ADD "parentId" uuid`);
        await queryRunner.query(`ALTER TABLE "task" ADD CONSTRAINT "FK_8c9920b5fb32c3d8453f64b705c" FOREIGN KEY ("parentId") REFERENCES "task"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "task" DROP CONSTRAINT "FK_8c9920b5fb32c3d8453f64b705c"`);
        await queryRunner.query(`ALTER TABLE "task" DROP COLUMN "parentId"`);
    }

    /**
    * SqliteDB Up Migration
    *
    * @param queryRunner
    */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
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
        await queryRunner.query(`CREATE TABLE "temporary_task" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "title" varchar NOT NULL, "description" varchar, "status" varchar, "estimate" integer, "dueDate" datetime, "projectId" varchar, "creatorId" varchar, "organizationSprintId" varchar, "number" integer, "prefix" varchar, "priority" varchar, "size" varchar, "public" boolean DEFAULT (1), "startDate" datetime, "resolvedAt" datetime, "version" varchar, "issueType" varchar, "parentId" varchar, CONSTRAINT "FK_e91cbff3d206f150ccc14d0c3a1" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_5b0272d923a31c972bed1a1ac4d" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_3797a20ef5553ae87af126bc2fe" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_94fe6b3a5aec5f85427df4f8cd7" FOREIGN KEY ("creatorId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_1e1f64696aa3a26d3e12c840e55" FOREIGN KEY ("organizationSprintId") REFERENCES "organization_sprint" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_task"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "title", "description", "status", "estimate", "dueDate", "projectId", "creatorId", "organizationSprintId", "number", "prefix", "priority", "size", "public", "startDate", "resolvedAt", "version", "issueType") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "title", "description", "status", "estimate", "dueDate", "projectId", "creatorId", "organizationSprintId", "number", "prefix", "priority", "size", "public", "startDate", "resolvedAt", "version", "issueType" FROM "task"`);
        await queryRunner.query(`DROP TABLE "task"`);
        await queryRunner.query(`ALTER TABLE "temporary_task" RENAME TO "task"`);
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
        await queryRunner.query(`CREATE TABLE "temporary_task" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "title" varchar NOT NULL, "description" varchar, "status" varchar, "estimate" integer, "dueDate" datetime, "projectId" varchar, "creatorId" varchar, "organizationSprintId" varchar, "number" integer, "prefix" varchar, "priority" varchar, "size" varchar, "public" boolean DEFAULT (1), "startDate" datetime, "resolvedAt" datetime, "version" varchar, "issueType" varchar, "parentId" varchar, CONSTRAINT "FK_e91cbff3d206f150ccc14d0c3a1" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_5b0272d923a31c972bed1a1ac4d" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_3797a20ef5553ae87af126bc2fe" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_94fe6b3a5aec5f85427df4f8cd7" FOREIGN KEY ("creatorId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_1e1f64696aa3a26d3e12c840e55" FOREIGN KEY ("organizationSprintId") REFERENCES "organization_sprint" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_8c9920b5fb32c3d8453f64b705c" FOREIGN KEY ("parentId") REFERENCES "task" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_task"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "title", "description", "status", "estimate", "dueDate", "projectId", "creatorId", "organizationSprintId", "number", "prefix", "priority", "size", "public", "startDate", "resolvedAt", "version", "issueType", "parentId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "title", "description", "status", "estimate", "dueDate", "projectId", "creatorId", "organizationSprintId", "number", "prefix", "priority", "size", "public", "startDate", "resolvedAt", "version", "issueType", "parentId" FROM "task"`);
        await queryRunner.query(`DROP TABLE "task"`);
        await queryRunner.query(`ALTER TABLE "temporary_task" RENAME TO "task"`);
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
    }

    /**
    * SqliteDB Down Migration
    *
    * @param queryRunner
    */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
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
        await queryRunner.query(`ALTER TABLE "task" RENAME TO "temporary_task"`);
        await queryRunner.query(`CREATE TABLE "task" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "title" varchar NOT NULL, "description" varchar, "status" varchar, "estimate" integer, "dueDate" datetime, "projectId" varchar, "creatorId" varchar, "organizationSprintId" varchar, "number" integer, "prefix" varchar, "priority" varchar, "size" varchar, "public" boolean DEFAULT (1), "startDate" datetime, "resolvedAt" datetime, "version" varchar, "issueType" varchar, "parentId" varchar, CONSTRAINT "FK_e91cbff3d206f150ccc14d0c3a1" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_5b0272d923a31c972bed1a1ac4d" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_3797a20ef5553ae87af126bc2fe" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_94fe6b3a5aec5f85427df4f8cd7" FOREIGN KEY ("creatorId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_1e1f64696aa3a26d3e12c840e55" FOREIGN KEY ("organizationSprintId") REFERENCES "organization_sprint" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "task"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "title", "description", "status", "estimate", "dueDate", "projectId", "creatorId", "organizationSprintId", "number", "prefix", "priority", "size", "public", "startDate", "resolvedAt", "version", "issueType", "parentId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "title", "description", "status", "estimate", "dueDate", "projectId", "creatorId", "organizationSprintId", "number", "prefix", "priority", "size", "public", "startDate", "resolvedAt", "version", "issueType", "parentId" FROM "temporary_task"`);
        await queryRunner.query(`DROP TABLE "temporary_task"`);
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
        await queryRunner.query(`ALTER TABLE "task" RENAME TO "temporary_task"`);
        await queryRunner.query(`CREATE TABLE "task" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "title" varchar NOT NULL, "description" varchar, "status" varchar, "estimate" integer, "dueDate" datetime, "projectId" varchar, "creatorId" varchar, "organizationSprintId" varchar, "number" integer, "prefix" varchar, "priority" varchar, "size" varchar, "public" boolean DEFAULT (1), "startDate" datetime, "resolvedAt" datetime, "version" varchar, "issueType" varchar, CONSTRAINT "FK_e91cbff3d206f150ccc14d0c3a1" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_5b0272d923a31c972bed1a1ac4d" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_3797a20ef5553ae87af126bc2fe" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_94fe6b3a5aec5f85427df4f8cd7" FOREIGN KEY ("creatorId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_1e1f64696aa3a26d3e12c840e55" FOREIGN KEY ("organizationSprintId") REFERENCES "organization_sprint" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "task"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "title", "description", "status", "estimate", "dueDate", "projectId", "creatorId", "organizationSprintId", "number", "prefix", "priority", "size", "public", "startDate", "resolvedAt", "version", "issueType") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "title", "description", "status", "estimate", "dueDate", "projectId", "creatorId", "organizationSprintId", "number", "prefix", "priority", "size", "public", "startDate", "resolvedAt", "version", "issueType" FROM "temporary_task"`);
        await queryRunner.query(`DROP TABLE "temporary_task"`);
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
    }

    /**
     * MySQL Up Migration
     *
     * @param queryRunner
     */
    public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> { }

    /**
     * MySQL Down Migration
     *
     * @param queryRunner
     */
    public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> { }
}
