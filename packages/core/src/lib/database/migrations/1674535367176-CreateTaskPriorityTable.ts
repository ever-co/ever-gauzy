import { MigrationInterface, QueryRunner } from "typeorm";
import * as chalk from "chalk";
import { DatabaseTypeEnum } from "@gauzy/config";

export class CreateTaskPriorityTable1674535367176 implements MigrationInterface {

    name = 'CreateTaskPriorityTable1674535367176';

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
        await queryRunner.query(`CREATE TABLE "task_priority" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "tenantId" uuid, "organizationId" uuid, "name" character varying NOT NULL, "value" character varying NOT NULL, "description" character varying, "icon" character varying, "color" character varying, "isSystem" boolean NOT NULL DEFAULT false, "projectId" uuid, CONSTRAINT "PK_42fc82c4e184b727a3ccd7863ee" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_1818655f27b8cf4f0d1dbfeb8d" ON "task_priority" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_7fd1b30d159b608cbf59009f68" ON "task_priority" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_7d656b4cba8f11e639dbc5aab3" ON "task_priority" ("name") `);
        await queryRunner.query(`CREATE INDEX "IDX_46daede7b19176b6ad959d70da" ON "task_priority" ("value") `);
        await queryRunner.query(`CREATE INDEX "IDX_db4237960ca989eb7a48cd433b" ON "task_priority" ("projectId") `);
        await queryRunner.query(`ALTER TABLE "task_priority" ADD CONSTRAINT "FK_1818655f27b8cf4f0d1dbfeb8db" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "task_priority" ADD CONSTRAINT "FK_7fd1b30d159b608cbf59009f681" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "task_priority" ADD CONSTRAINT "FK_db4237960ca989eb7a48cd433b1" FOREIGN KEY ("projectId") REFERENCES "organization_project"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "task_priority" DROP CONSTRAINT "FK_db4237960ca989eb7a48cd433b1"`);
        await queryRunner.query(`ALTER TABLE "task_priority" DROP CONSTRAINT "FK_7fd1b30d159b608cbf59009f681"`);
        await queryRunner.query(`ALTER TABLE "task_priority" DROP CONSTRAINT "FK_1818655f27b8cf4f0d1dbfeb8db"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_db4237960ca989eb7a48cd433b"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_46daede7b19176b6ad959d70da"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7d656b4cba8f11e639dbc5aab3"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7fd1b30d159b608cbf59009f68"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1818655f27b8cf4f0d1dbfeb8d"`);
        await queryRunner.query(`DROP TABLE "task_priority"`);
    }

    /**
    * SqliteDB Up Migration
    *
    * @param queryRunner
    */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`CREATE TABLE "task_priority" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "value" varchar NOT NULL, "description" varchar, "icon" varchar, "color" varchar, "isSystem" boolean NOT NULL DEFAULT (0), "projectId" varchar)`);
        await queryRunner.query(`CREATE INDEX "IDX_1818655f27b8cf4f0d1dbfeb8d" ON "task_priority" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_7fd1b30d159b608cbf59009f68" ON "task_priority" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_7d656b4cba8f11e639dbc5aab3" ON "task_priority" ("name") `);
        await queryRunner.query(`CREATE INDEX "IDX_46daede7b19176b6ad959d70da" ON "task_priority" ("value") `);
        await queryRunner.query(`CREATE INDEX "IDX_db4237960ca989eb7a48cd433b" ON "task_priority" ("projectId") `);
        await queryRunner.query(`DROP INDEX "IDX_1818655f27b8cf4f0d1dbfeb8d"`);
        await queryRunner.query(`DROP INDEX "IDX_7fd1b30d159b608cbf59009f68"`);
        await queryRunner.query(`DROP INDEX "IDX_7d656b4cba8f11e639dbc5aab3"`);
        await queryRunner.query(`DROP INDEX "IDX_46daede7b19176b6ad959d70da"`);
        await queryRunner.query(`DROP INDEX "IDX_db4237960ca989eb7a48cd433b"`);
        await queryRunner.query(`CREATE TABLE "temporary_task_priority" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "value" varchar NOT NULL, "description" varchar, "icon" varchar, "color" varchar, "isSystem" boolean NOT NULL DEFAULT (0), "projectId" varchar, CONSTRAINT "FK_1818655f27b8cf4f0d1dbfeb8db" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_7fd1b30d159b608cbf59009f681" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_db4237960ca989eb7a48cd433b1" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_task_priority"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "value", "description", "icon", "color", "isSystem", "projectId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "value", "description", "icon", "color", "isSystem", "projectId" FROM "task_priority"`);
        await queryRunner.query(`DROP TABLE "task_priority"`);
        await queryRunner.query(`ALTER TABLE "temporary_task_priority" RENAME TO "task_priority"`);
        await queryRunner.query(`CREATE INDEX "IDX_1818655f27b8cf4f0d1dbfeb8d" ON "task_priority" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_7fd1b30d159b608cbf59009f68" ON "task_priority" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_7d656b4cba8f11e639dbc5aab3" ON "task_priority" ("name") `);
        await queryRunner.query(`CREATE INDEX "IDX_46daede7b19176b6ad959d70da" ON "task_priority" ("value") `);
        await queryRunner.query(`CREATE INDEX "IDX_db4237960ca989eb7a48cd433b" ON "task_priority" ("projectId") `);
    }

    /**
    * SqliteDB Down Migration
    *
    * @param queryRunner
    */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_db4237960ca989eb7a48cd433b"`);
        await queryRunner.query(`DROP INDEX "IDX_46daede7b19176b6ad959d70da"`);
        await queryRunner.query(`DROP INDEX "IDX_7d656b4cba8f11e639dbc5aab3"`);
        await queryRunner.query(`DROP INDEX "IDX_7fd1b30d159b608cbf59009f68"`);
        await queryRunner.query(`DROP INDEX "IDX_1818655f27b8cf4f0d1dbfeb8d"`);
        await queryRunner.query(`ALTER TABLE "task_priority" RENAME TO "temporary_task_priority"`);
        await queryRunner.query(`CREATE TABLE "task_priority" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "value" varchar NOT NULL, "description" varchar, "icon" varchar, "color" varchar, "isSystem" boolean NOT NULL DEFAULT (0), "projectId" varchar)`);
        await queryRunner.query(`INSERT INTO "task_priority"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "value", "description", "icon", "color", "isSystem", "projectId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "value", "description", "icon", "color", "isSystem", "projectId" FROM "temporary_task_priority"`);
        await queryRunner.query(`DROP TABLE "temporary_task_priority"`);
        await queryRunner.query(`CREATE INDEX "IDX_db4237960ca989eb7a48cd433b" ON "task_priority" ("projectId") `);
        await queryRunner.query(`CREATE INDEX "IDX_46daede7b19176b6ad959d70da" ON "task_priority" ("value") `);
        await queryRunner.query(`CREATE INDEX "IDX_7d656b4cba8f11e639dbc5aab3" ON "task_priority" ("name") `);
        await queryRunner.query(`CREATE INDEX "IDX_7fd1b30d159b608cbf59009f68" ON "task_priority" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_1818655f27b8cf4f0d1dbfeb8d" ON "task_priority" ("tenantId") `);
        await queryRunner.query(`DROP INDEX "IDX_db4237960ca989eb7a48cd433b"`);
        await queryRunner.query(`DROP INDEX "IDX_46daede7b19176b6ad959d70da"`);
        await queryRunner.query(`DROP INDEX "IDX_7d656b4cba8f11e639dbc5aab3"`);
        await queryRunner.query(`DROP INDEX "IDX_7fd1b30d159b608cbf59009f68"`);
        await queryRunner.query(`DROP INDEX "IDX_1818655f27b8cf4f0d1dbfeb8d"`);
        await queryRunner.query(`DROP TABLE "task_priority"`);
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
