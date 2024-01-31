import { MigrationInterface, QueryRunner } from "typeorm";
import * as chalk from "chalk";
import { DatabaseTypeEnum } from "@gauzy/config";

export class AlterTaskStatusTable1675186090641 implements MigrationInterface {

    name = 'AlterTaskStatusTable1675186090641';

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
        await queryRunner.query(`ALTER TABLE "task_status" DROP CONSTRAINT "FK_4e523a8b0628d467316dcbd45f5"`);
        await queryRunner.query(`ALTER TABLE "task_status" DROP CONSTRAINT "FK_843edbaab7b6aac6037d50319cc"`);
        await queryRunner.query(`ALTER TABLE "task_status" DROP CONSTRAINT "FK_14c9897451c5ecc91211a2e873d"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_4e523a8b0628d467316dcbd45f"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_843edbaab7b6aac6037d50319c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_95ff138b88fdd8a7c9ebdb97a3"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6a043d4088c6303d62b4c6edf8"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_14c9897451c5ecc91211a2e873"`);
        await queryRunner.query(`CREATE INDEX "IDX_efbaf00a743316b394cc31e4a2" ON "task_status" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_9b9a828a49f4bd6383a4073fe2" ON "task_status" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_b0c955f276679dd2b2735c3936" ON "task_status" ("name") `);
        await queryRunner.query(`CREATE INDEX "IDX_68eaba689ed6d3e27ec93d3e88" ON "task_status" ("value") `);
        await queryRunner.query(`CREATE INDEX "IDX_a19e8975e5c296640d457dfc11" ON "task_status" ("projectId") `);
        await queryRunner.query(`ALTER TABLE "task_status" ADD CONSTRAINT "FK_efbaf00a743316b394cc31e4a20" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "task_status" ADD CONSTRAINT "FK_9b9a828a49f4bd6383a4073fe23" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "task_status" ADD CONSTRAINT "FK_a19e8975e5c296640d457dfc11f" FOREIGN KEY ("projectId") REFERENCES "organization_project"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "task_status" DROP CONSTRAINT "FK_a19e8975e5c296640d457dfc11f"`);
        await queryRunner.query(`ALTER TABLE "task_status" DROP CONSTRAINT "FK_9b9a828a49f4bd6383a4073fe23"`);
        await queryRunner.query(`ALTER TABLE "task_status" DROP CONSTRAINT "FK_efbaf00a743316b394cc31e4a20"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a19e8975e5c296640d457dfc11"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_68eaba689ed6d3e27ec93d3e88"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b0c955f276679dd2b2735c3936"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9b9a828a49f4bd6383a4073fe2"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_efbaf00a743316b394cc31e4a2"`);
        await queryRunner.query(`CREATE INDEX "IDX_14c9897451c5ecc91211a2e873" ON "task_status" ("projectId") `);
        await queryRunner.query(`CREATE INDEX "IDX_6a043d4088c6303d62b4c6edf8" ON "task_status" ("value") `);
        await queryRunner.query(`CREATE INDEX "IDX_95ff138b88fdd8a7c9ebdb97a3" ON "task_status" ("name") `);
        await queryRunner.query(`CREATE INDEX "IDX_843edbaab7b6aac6037d50319c" ON "task_status" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_4e523a8b0628d467316dcbd45f" ON "task_status" ("tenantId") `);
        await queryRunner.query(`ALTER TABLE "task_status" ADD CONSTRAINT "FK_14c9897451c5ecc91211a2e873d" FOREIGN KEY ("projectId") REFERENCES "organization_project"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "task_status" ADD CONSTRAINT "FK_843edbaab7b6aac6037d50319cc" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "task_status" ADD CONSTRAINT "FK_4e523a8b0628d467316dcbd45f5" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    /**
    * SqliteDB Up Migration
    *
    * @param queryRunner
    */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_14c9897451c5ecc91211a2e873"`);
        await queryRunner.query(`DROP INDEX "IDX_6a043d4088c6303d62b4c6edf8"`);
        await queryRunner.query(`DROP INDEX "IDX_95ff138b88fdd8a7c9ebdb97a3"`);
        await queryRunner.query(`DROP INDEX "IDX_843edbaab7b6aac6037d50319c"`);
        await queryRunner.query(`DROP INDEX "IDX_4e523a8b0628d467316dcbd45f"`);
        await queryRunner.query(`CREATE TABLE "temporary_task_status" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "value" varchar NOT NULL, "description" varchar, "icon" varchar, "color" varchar, "isSystem" boolean NOT NULL DEFAULT (0), "projectId" varchar)`);
        await queryRunner.query(`INSERT INTO "temporary_task_status"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "value", "description", "icon", "color", "isSystem", "projectId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "value", "description", "icon", "color", "isSystem", "projectId" FROM "task_status"`);
        await queryRunner.query(`DROP TABLE "task_status"`);
        await queryRunner.query(`ALTER TABLE "temporary_task_status" RENAME TO "task_status"`);
        await queryRunner.query(`CREATE INDEX "IDX_14c9897451c5ecc91211a2e873" ON "task_status" ("projectId") `);
        await queryRunner.query(`CREATE INDEX "IDX_6a043d4088c6303d62b4c6edf8" ON "task_status" ("value") `);
        await queryRunner.query(`CREATE INDEX "IDX_95ff138b88fdd8a7c9ebdb97a3" ON "task_status" ("name") `);
        await queryRunner.query(`CREATE INDEX "IDX_843edbaab7b6aac6037d50319c" ON "task_status" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_4e523a8b0628d467316dcbd45f" ON "task_status" ("tenantId") `);
        await queryRunner.query(`DROP INDEX "IDX_14c9897451c5ecc91211a2e873"`);
        await queryRunner.query(`DROP INDEX "IDX_6a043d4088c6303d62b4c6edf8"`);
        await queryRunner.query(`DROP INDEX "IDX_95ff138b88fdd8a7c9ebdb97a3"`);
        await queryRunner.query(`DROP INDEX "IDX_843edbaab7b6aac6037d50319c"`);
        await queryRunner.query(`DROP INDEX "IDX_4e523a8b0628d467316dcbd45f"`);
        await queryRunner.query(`CREATE INDEX "IDX_efbaf00a743316b394cc31e4a2" ON "task_status" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_9b9a828a49f4bd6383a4073fe2" ON "task_status" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_b0c955f276679dd2b2735c3936" ON "task_status" ("name") `);
        await queryRunner.query(`CREATE INDEX "IDX_68eaba689ed6d3e27ec93d3e88" ON "task_status" ("value") `);
        await queryRunner.query(`CREATE INDEX "IDX_a19e8975e5c296640d457dfc11" ON "task_status" ("projectId") `);
        await queryRunner.query(`DROP INDEX "IDX_efbaf00a743316b394cc31e4a2"`);
        await queryRunner.query(`DROP INDEX "IDX_9b9a828a49f4bd6383a4073fe2"`);
        await queryRunner.query(`DROP INDEX "IDX_b0c955f276679dd2b2735c3936"`);
        await queryRunner.query(`DROP INDEX "IDX_68eaba689ed6d3e27ec93d3e88"`);
        await queryRunner.query(`DROP INDEX "IDX_a19e8975e5c296640d457dfc11"`);
        await queryRunner.query(`CREATE TABLE "temporary_task_status" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "value" varchar NOT NULL, "description" varchar, "icon" varchar, "color" varchar, "isSystem" boolean NOT NULL DEFAULT (0), "projectId" varchar, CONSTRAINT "FK_efbaf00a743316b394cc31e4a20" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_9b9a828a49f4bd6383a4073fe23" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_a19e8975e5c296640d457dfc11f" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_task_status"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "value", "description", "icon", "color", "isSystem", "projectId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "value", "description", "icon", "color", "isSystem", "projectId" FROM "task_status"`);
        await queryRunner.query(`DROP TABLE "task_status"`);
        await queryRunner.query(`ALTER TABLE "temporary_task_status" RENAME TO "task_status"`);
        await queryRunner.query(`CREATE INDEX "IDX_efbaf00a743316b394cc31e4a2" ON "task_status" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_9b9a828a49f4bd6383a4073fe2" ON "task_status" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_b0c955f276679dd2b2735c3936" ON "task_status" ("name") `);
        await queryRunner.query(`CREATE INDEX "IDX_68eaba689ed6d3e27ec93d3e88" ON "task_status" ("value") `);
        await queryRunner.query(`CREATE INDEX "IDX_a19e8975e5c296640d457dfc11" ON "task_status" ("projectId") `);
    }

    /**
    * SqliteDB Down Migration
    *
    * @param queryRunner
    */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_a19e8975e5c296640d457dfc11"`);
        await queryRunner.query(`DROP INDEX "IDX_68eaba689ed6d3e27ec93d3e88"`);
        await queryRunner.query(`DROP INDEX "IDX_b0c955f276679dd2b2735c3936"`);
        await queryRunner.query(`DROP INDEX "IDX_9b9a828a49f4bd6383a4073fe2"`);
        await queryRunner.query(`DROP INDEX "IDX_efbaf00a743316b394cc31e4a2"`);
        await queryRunner.query(`ALTER TABLE "task_status" RENAME TO "temporary_task_status"`);
        await queryRunner.query(`CREATE TABLE "task_status" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "value" varchar NOT NULL, "description" varchar, "icon" varchar, "color" varchar, "isSystem" boolean NOT NULL DEFAULT (0), "projectId" varchar)`);
        await queryRunner.query(`INSERT INTO "task_status"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "value", "description", "icon", "color", "isSystem", "projectId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "value", "description", "icon", "color", "isSystem", "projectId" FROM "temporary_task_status"`);
        await queryRunner.query(`DROP TABLE "temporary_task_status"`);
        await queryRunner.query(`CREATE INDEX "IDX_a19e8975e5c296640d457dfc11" ON "task_status" ("projectId") `);
        await queryRunner.query(`CREATE INDEX "IDX_68eaba689ed6d3e27ec93d3e88" ON "task_status" ("value") `);
        await queryRunner.query(`CREATE INDEX "IDX_b0c955f276679dd2b2735c3936" ON "task_status" ("name") `);
        await queryRunner.query(`CREATE INDEX "IDX_9b9a828a49f4bd6383a4073fe2" ON "task_status" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_efbaf00a743316b394cc31e4a2" ON "task_status" ("tenantId") `);
        await queryRunner.query(`DROP INDEX "IDX_a19e8975e5c296640d457dfc11"`);
        await queryRunner.query(`DROP INDEX "IDX_68eaba689ed6d3e27ec93d3e88"`);
        await queryRunner.query(`DROP INDEX "IDX_b0c955f276679dd2b2735c3936"`);
        await queryRunner.query(`DROP INDEX "IDX_9b9a828a49f4bd6383a4073fe2"`);
        await queryRunner.query(`DROP INDEX "IDX_efbaf00a743316b394cc31e4a2"`);
        await queryRunner.query(`CREATE INDEX "IDX_4e523a8b0628d467316dcbd45f" ON "task_status" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_843edbaab7b6aac6037d50319c" ON "task_status" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_95ff138b88fdd8a7c9ebdb97a3" ON "task_status" ("name") `);
        await queryRunner.query(`CREATE INDEX "IDX_6a043d4088c6303d62b4c6edf8" ON "task_status" ("value") `);
        await queryRunner.query(`CREATE INDEX "IDX_14c9897451c5ecc91211a2e873" ON "task_status" ("projectId") `);
        await queryRunner.query(`DROP INDEX "IDX_4e523a8b0628d467316dcbd45f"`);
        await queryRunner.query(`DROP INDEX "IDX_843edbaab7b6aac6037d50319c"`);
        await queryRunner.query(`DROP INDEX "IDX_95ff138b88fdd8a7c9ebdb97a3"`);
        await queryRunner.query(`DROP INDEX "IDX_6a043d4088c6303d62b4c6edf8"`);
        await queryRunner.query(`DROP INDEX "IDX_14c9897451c5ecc91211a2e873"`);
        await queryRunner.query(`ALTER TABLE "task_status" RENAME TO "temporary_task_status"`);
        await queryRunner.query(`CREATE TABLE "task_status" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "value" varchar NOT NULL, "description" varchar, "icon" varchar, "color" varchar, "isSystem" boolean NOT NULL DEFAULT (0), "projectId" varchar, CONSTRAINT "FK_14c9897451c5ecc91211a2e873d" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_843edbaab7b6aac6037d50319cc" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_4e523a8b0628d467316dcbd45f5" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "task_status"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "value", "description", "icon", "color", "isSystem", "projectId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "value", "description", "icon", "color", "isSystem", "projectId" FROM "temporary_task_status"`);
        await queryRunner.query(`DROP TABLE "temporary_task_status"`);
        await queryRunner.query(`CREATE INDEX "IDX_4e523a8b0628d467316dcbd45f" ON "task_status" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_843edbaab7b6aac6037d50319c" ON "task_status" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_95ff138b88fdd8a7c9ebdb97a3" ON "task_status" ("name") `);
        await queryRunner.query(`CREATE INDEX "IDX_6a043d4088c6303d62b4c6edf8" ON "task_status" ("value") `);
        await queryRunner.query(`CREATE INDEX "IDX_14c9897451c5ecc91211a2e873" ON "task_status" ("projectId") `);
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
