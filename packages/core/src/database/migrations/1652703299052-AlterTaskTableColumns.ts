import { MigrationInterface, QueryRunner } from "typeorm";

export class AlterTaskTableColumns1652703299052 implements MigrationInterface {

    name = 'AlterTaskTableColumns1652703299052';

    public async up(queryRunner: QueryRunner): Promise<void> {
        if (queryRunner.connection.options.type === 'sqlite') {
            await this.sqliteUpQueryRunner(queryRunner);
        } else {
            await this.postgresUpQueryRunner(queryRunner);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
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
        await queryRunner.query(`ALTER TABLE "task" ADD "number" integer`);
        await queryRunner.query(`ALTER TABLE "task" ADD "prefix" character varying`);
        await queryRunner.query(`CREATE UNIQUE INDEX "taskNumber" ON "task" ("projectId", "number") `);
    }

    /**
     * PostgresDB Down Migration
     * 
     * @param queryRunner 
     */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "public"."taskNumber"`);
        await queryRunner.query(`ALTER TABLE "task" DROP COLUMN "prefix"`);
        await queryRunner.query(`ALTER TABLE "task" DROP COLUMN "number"`);
    }

    /**
     * SqliteDB Up Migration
     * 
     * @param queryRunner 
     */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_e91cbff3d206f150ccc14d0c3a"`);
        await queryRunner.query(`DROP INDEX "IDX_5b0272d923a31c972bed1a1ac4"`);
        await queryRunner.query(`DROP INDEX "IDX_3797a20ef5553ae87af126bc2f"`);
        await queryRunner.query(`DROP INDEX "IDX_94fe6b3a5aec5f85427df4f8cd"`);
        await queryRunner.query(`DROP INDEX "IDX_1e1f64696aa3a26d3e12c840e5"`);
        await queryRunner.query(`CREATE TABLE "temporary_task" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "title" varchar NOT NULL, "description" varchar, "status" varchar NOT NULL DEFAULT ('Todo'), "estimate" integer, "dueDate" datetime, "projectId" varchar, "creatorId" varchar, "organizationSprintId" varchar, "number" integer, "prefix" varchar, CONSTRAINT "FK_e91cbff3d206f150ccc14d0c3a1" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_5b0272d923a31c972bed1a1ac4d" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_3797a20ef5553ae87af126bc2fe" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_94fe6b3a5aec5f85427df4f8cd7" FOREIGN KEY ("creatorId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_1e1f64696aa3a26d3e12c840e55" FOREIGN KEY ("organizationSprintId") REFERENCES "organization_sprint" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_task"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "title", "description", "status", "estimate", "dueDate", "projectId", "creatorId", "organizationSprintId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "title", "description", "status", "estimate", "dueDate", "projectId", "creatorId", "organizationSprintId" FROM "task"`);
        await queryRunner.query(`DROP TABLE "task"`);
        await queryRunner.query(`ALTER TABLE "temporary_task" RENAME TO "task"`);
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
        await queryRunner.query(`ALTER TABLE "task" RENAME TO "temporary_task"`);
        await queryRunner.query(`CREATE TABLE "task" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "title" varchar NOT NULL, "description" varchar, "status" varchar NOT NULL DEFAULT ('Todo'), "estimate" integer, "dueDate" datetime, "projectId" varchar, "creatorId" varchar, "organizationSprintId" varchar, CONSTRAINT "FK_e91cbff3d206f150ccc14d0c3a1" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_5b0272d923a31c972bed1a1ac4d" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_3797a20ef5553ae87af126bc2fe" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_94fe6b3a5aec5f85427df4f8cd7" FOREIGN KEY ("creatorId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_1e1f64696aa3a26d3e12c840e55" FOREIGN KEY ("organizationSprintId") REFERENCES "organization_sprint" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "task"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "title", "description", "status", "estimate", "dueDate", "projectId", "creatorId", "organizationSprintId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "title", "description", "status", "estimate", "dueDate", "projectId", "creatorId", "organizationSprintId" FROM "temporary_task"`);
        await queryRunner.query(`DROP TABLE "temporary_task"`);
        await queryRunner.query(`CREATE INDEX "IDX_1e1f64696aa3a26d3e12c840e5" ON "task" ("organizationSprintId") `);
        await queryRunner.query(`CREATE INDEX "IDX_94fe6b3a5aec5f85427df4f8cd" ON "task" ("creatorId") `);
        await queryRunner.query(`CREATE INDEX "IDX_3797a20ef5553ae87af126bc2f" ON "task" ("projectId") `);
        await queryRunner.query(`CREATE INDEX "IDX_5b0272d923a31c972bed1a1ac4" ON "task" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_e91cbff3d206f150ccc14d0c3a" ON "task" ("tenantId") `);
    }
}