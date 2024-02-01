import { MigrationInterface, QueryRunner } from "typeorm";
import * as chalk from "chalk";
import { DatabaseTypeEnum } from "@gauzy/config";

export class AlterOrganizationTeamTable1677063195155 implements MigrationInterface {

    name = 'AlterOrganizationTeamTable1677063195155';

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
        await queryRunner.query(`ALTER TABLE "task_priority" ADD "organizationTeamId" uuid`);
        await queryRunner.query(`ALTER TABLE "task_size" ADD "organizationTeamId" uuid`);
        await queryRunner.query(`ALTER TABLE "task_status" ADD "organizationTeamId" uuid`);
        await queryRunner.query(`CREATE INDEX "IDX_52b039cff6a1adf6b7f9e49ee4" ON "task_priority" ("organizationTeamId") `);
        await queryRunner.query(`CREATE INDEX "IDX_f4438327b3c2afb0832569b2a1" ON "task_size" ("organizationTeamId") `);
        await queryRunner.query(`CREATE INDEX "IDX_0330b4a942b536d8d1f264abe3" ON "task_status" ("organizationTeamId") `);
        await queryRunner.query(`ALTER TABLE "task_priority" ADD CONSTRAINT "FK_52b039cff6a1adf6b7f9e49ee44" FOREIGN KEY ("organizationTeamId") REFERENCES "organization_team"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "task_size" ADD CONSTRAINT "FK_f4438327b3c2afb0832569b2a1e" FOREIGN KEY ("organizationTeamId") REFERENCES "organization_team"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "task_status" ADD CONSTRAINT "FK_0330b4a942b536d8d1f264abe32" FOREIGN KEY ("organizationTeamId") REFERENCES "organization_team"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "task_status" DROP CONSTRAINT "FK_0330b4a942b536d8d1f264abe32"`);
        await queryRunner.query(`ALTER TABLE "task_size" DROP CONSTRAINT "FK_f4438327b3c2afb0832569b2a1e"`);
        await queryRunner.query(`ALTER TABLE "task_priority" DROP CONSTRAINT "FK_52b039cff6a1adf6b7f9e49ee44"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0330b4a942b536d8d1f264abe3"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f4438327b3c2afb0832569b2a1"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_52b039cff6a1adf6b7f9e49ee4"`);
        await queryRunner.query(`ALTER TABLE "task_status" DROP COLUMN "organizationTeamId"`);
        await queryRunner.query(`ALTER TABLE "task_size" DROP COLUMN "organizationTeamId"`);
        await queryRunner.query(`ALTER TABLE "task_priority" DROP COLUMN "organizationTeamId"`);
    }

    /**
    * SqliteDB Up Migration
    *
    * @param queryRunner
    */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_db4237960ca989eb7a48cd433b"`);
        await queryRunner.query(`DROP INDEX "IDX_46daede7b19176b6ad959d70da"`);
        await queryRunner.query(`DROP INDEX "IDX_7d656b4cba8f11e639dbc5aab3"`);
        await queryRunner.query(`DROP INDEX "IDX_7fd1b30d159b608cbf59009f68"`);
        await queryRunner.query(`DROP INDEX "IDX_1818655f27b8cf4f0d1dbfeb8d"`);
        await queryRunner.query(`CREATE TABLE "temporary_task_priority" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "value" varchar NOT NULL, "description" varchar, "icon" varchar, "color" varchar, "isSystem" boolean NOT NULL DEFAULT (0), "projectId" varchar, "organizationTeamId" varchar, CONSTRAINT "FK_db4237960ca989eb7a48cd433b1" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_7fd1b30d159b608cbf59009f681" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_1818655f27b8cf4f0d1dbfeb8db" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_task_priority"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "value", "description", "icon", "color", "isSystem", "projectId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "value", "description", "icon", "color", "isSystem", "projectId" FROM "task_priority"`);
        await queryRunner.query(`DROP TABLE "task_priority"`);
        await queryRunner.query(`ALTER TABLE "temporary_task_priority" RENAME TO "task_priority"`);
        await queryRunner.query(`CREATE INDEX "IDX_db4237960ca989eb7a48cd433b" ON "task_priority" ("projectId") `);
        await queryRunner.query(`CREATE INDEX "IDX_46daede7b19176b6ad959d70da" ON "task_priority" ("value") `);
        await queryRunner.query(`CREATE INDEX "IDX_7d656b4cba8f11e639dbc5aab3" ON "task_priority" ("name") `);
        await queryRunner.query(`CREATE INDEX "IDX_7fd1b30d159b608cbf59009f68" ON "task_priority" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_1818655f27b8cf4f0d1dbfeb8d" ON "task_priority" ("tenantId") `);
        await queryRunner.query(`DROP INDEX "IDX_ad6792b26526bd96ab18d63454"`);
        await queryRunner.query(`DROP INDEX "IDX_1a7b137d009616a2ff1aa6834f"`);
        await queryRunner.query(`DROP INDEX "IDX_90c54f57b29cc8b67edc2738ae"`);
        await queryRunner.query(`DROP INDEX "IDX_596512cc6508a482cc23ae6ab7"`);
        await queryRunner.query(`DROP INDEX "IDX_f6ec2207e50680a475d71c8979"`);
        await queryRunner.query(`CREATE TABLE "temporary_task_size" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "value" varchar NOT NULL, "description" varchar, "icon" varchar, "color" varchar, "isSystem" boolean NOT NULL DEFAULT (0), "projectId" varchar, "organizationTeamId" varchar, CONSTRAINT "FK_ad6792b26526bd96ab18d634544" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_596512cc6508a482cc23ae6ab78" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_f6ec2207e50680a475d71c89793" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_task_size"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "value", "description", "icon", "color", "isSystem", "projectId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "value", "description", "icon", "color", "isSystem", "projectId" FROM "task_size"`);
        await queryRunner.query(`DROP TABLE "task_size"`);
        await queryRunner.query(`ALTER TABLE "temporary_task_size" RENAME TO "task_size"`);
        await queryRunner.query(`CREATE INDEX "IDX_ad6792b26526bd96ab18d63454" ON "task_size" ("projectId") `);
        await queryRunner.query(`CREATE INDEX "IDX_1a7b137d009616a2ff1aa6834f" ON "task_size" ("value") `);
        await queryRunner.query(`CREATE INDEX "IDX_90c54f57b29cc8b67edc2738ae" ON "task_size" ("name") `);
        await queryRunner.query(`CREATE INDEX "IDX_596512cc6508a482cc23ae6ab7" ON "task_size" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_f6ec2207e50680a475d71c8979" ON "task_size" ("tenantId") `);
        await queryRunner.query(`DROP INDEX "IDX_a19e8975e5c296640d457dfc11"`);
        await queryRunner.query(`DROP INDEX "IDX_68eaba689ed6d3e27ec93d3e88"`);
        await queryRunner.query(`DROP INDEX "IDX_b0c955f276679dd2b2735c3936"`);
        await queryRunner.query(`DROP INDEX "IDX_9b9a828a49f4bd6383a4073fe2"`);
        await queryRunner.query(`DROP INDEX "IDX_efbaf00a743316b394cc31e4a2"`);
        await queryRunner.query(`CREATE TABLE "temporary_task_status" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "value" varchar NOT NULL, "description" varchar, "icon" varchar, "color" varchar, "isSystem" boolean NOT NULL DEFAULT (0), "projectId" varchar, "organizationTeamId" varchar, CONSTRAINT "FK_a19e8975e5c296640d457dfc11f" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_9b9a828a49f4bd6383a4073fe23" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_efbaf00a743316b394cc31e4a20" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_task_status"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "value", "description", "icon", "color", "isSystem", "projectId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "value", "description", "icon", "color", "isSystem", "projectId" FROM "task_status"`);
        await queryRunner.query(`DROP TABLE "task_status"`);
        await queryRunner.query(`ALTER TABLE "temporary_task_status" RENAME TO "task_status"`);
        await queryRunner.query(`CREATE INDEX "IDX_a19e8975e5c296640d457dfc11" ON "task_status" ("projectId") `);
        await queryRunner.query(`CREATE INDEX "IDX_68eaba689ed6d3e27ec93d3e88" ON "task_status" ("value") `);
        await queryRunner.query(`CREATE INDEX "IDX_b0c955f276679dd2b2735c3936" ON "task_status" ("name") `);
        await queryRunner.query(`CREATE INDEX "IDX_9b9a828a49f4bd6383a4073fe2" ON "task_status" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_efbaf00a743316b394cc31e4a2" ON "task_status" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_52b039cff6a1adf6b7f9e49ee4" ON "task_priority" ("organizationTeamId") `);
        await queryRunner.query(`CREATE INDEX "IDX_f4438327b3c2afb0832569b2a1" ON "task_size" ("organizationTeamId") `);
        await queryRunner.query(`CREATE INDEX "IDX_0330b4a942b536d8d1f264abe3" ON "task_status" ("organizationTeamId") `);
        await queryRunner.query(`DROP INDEX "IDX_db4237960ca989eb7a48cd433b"`);
        await queryRunner.query(`DROP INDEX "IDX_46daede7b19176b6ad959d70da"`);
        await queryRunner.query(`DROP INDEX "IDX_7d656b4cba8f11e639dbc5aab3"`);
        await queryRunner.query(`DROP INDEX "IDX_7fd1b30d159b608cbf59009f68"`);
        await queryRunner.query(`DROP INDEX "IDX_1818655f27b8cf4f0d1dbfeb8d"`);
        await queryRunner.query(`DROP INDEX "IDX_52b039cff6a1adf6b7f9e49ee4"`);
        await queryRunner.query(`CREATE TABLE "temporary_task_priority" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "value" varchar NOT NULL, "description" varchar, "icon" varchar, "color" varchar, "isSystem" boolean NOT NULL DEFAULT (0), "projectId" varchar, "organizationTeamId" varchar, CONSTRAINT "FK_db4237960ca989eb7a48cd433b1" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_7fd1b30d159b608cbf59009f681" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_1818655f27b8cf4f0d1dbfeb8db" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_52b039cff6a1adf6b7f9e49ee44" FOREIGN KEY ("organizationTeamId") REFERENCES "organization_team" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_task_priority"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "value", "description", "icon", "color", "isSystem", "projectId", "organizationTeamId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "value", "description", "icon", "color", "isSystem", "projectId", "organizationTeamId" FROM "task_priority"`);
        await queryRunner.query(`DROP TABLE "task_priority"`);
        await queryRunner.query(`ALTER TABLE "temporary_task_priority" RENAME TO "task_priority"`);
        await queryRunner.query(`CREATE INDEX "IDX_db4237960ca989eb7a48cd433b" ON "task_priority" ("projectId") `);
        await queryRunner.query(`CREATE INDEX "IDX_46daede7b19176b6ad959d70da" ON "task_priority" ("value") `);
        await queryRunner.query(`CREATE INDEX "IDX_7d656b4cba8f11e639dbc5aab3" ON "task_priority" ("name") `);
        await queryRunner.query(`CREATE INDEX "IDX_7fd1b30d159b608cbf59009f68" ON "task_priority" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_1818655f27b8cf4f0d1dbfeb8d" ON "task_priority" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_52b039cff6a1adf6b7f9e49ee4" ON "task_priority" ("organizationTeamId") `);
        await queryRunner.query(`DROP INDEX "IDX_ad6792b26526bd96ab18d63454"`);
        await queryRunner.query(`DROP INDEX "IDX_1a7b137d009616a2ff1aa6834f"`);
        await queryRunner.query(`DROP INDEX "IDX_90c54f57b29cc8b67edc2738ae"`);
        await queryRunner.query(`DROP INDEX "IDX_596512cc6508a482cc23ae6ab7"`);
        await queryRunner.query(`DROP INDEX "IDX_f6ec2207e50680a475d71c8979"`);
        await queryRunner.query(`DROP INDEX "IDX_f4438327b3c2afb0832569b2a1"`);
        await queryRunner.query(`CREATE TABLE "temporary_task_size" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "value" varchar NOT NULL, "description" varchar, "icon" varchar, "color" varchar, "isSystem" boolean NOT NULL DEFAULT (0), "projectId" varchar, "organizationTeamId" varchar, CONSTRAINT "FK_ad6792b26526bd96ab18d634544" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_596512cc6508a482cc23ae6ab78" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_f6ec2207e50680a475d71c89793" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_f4438327b3c2afb0832569b2a1e" FOREIGN KEY ("organizationTeamId") REFERENCES "organization_team" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_task_size"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "value", "description", "icon", "color", "isSystem", "projectId", "organizationTeamId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "value", "description", "icon", "color", "isSystem", "projectId", "organizationTeamId" FROM "task_size"`);
        await queryRunner.query(`DROP TABLE "task_size"`);
        await queryRunner.query(`ALTER TABLE "temporary_task_size" RENAME TO "task_size"`);
        await queryRunner.query(`CREATE INDEX "IDX_ad6792b26526bd96ab18d63454" ON "task_size" ("projectId") `);
        await queryRunner.query(`CREATE INDEX "IDX_1a7b137d009616a2ff1aa6834f" ON "task_size" ("value") `);
        await queryRunner.query(`CREATE INDEX "IDX_90c54f57b29cc8b67edc2738ae" ON "task_size" ("name") `);
        await queryRunner.query(`CREATE INDEX "IDX_596512cc6508a482cc23ae6ab7" ON "task_size" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_f6ec2207e50680a475d71c8979" ON "task_size" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_f4438327b3c2afb0832569b2a1" ON "task_size" ("organizationTeamId") `);
        await queryRunner.query(`DROP INDEX "IDX_a19e8975e5c296640d457dfc11"`);
        await queryRunner.query(`DROP INDEX "IDX_68eaba689ed6d3e27ec93d3e88"`);
        await queryRunner.query(`DROP INDEX "IDX_b0c955f276679dd2b2735c3936"`);
        await queryRunner.query(`DROP INDEX "IDX_9b9a828a49f4bd6383a4073fe2"`);
        await queryRunner.query(`DROP INDEX "IDX_efbaf00a743316b394cc31e4a2"`);
        await queryRunner.query(`DROP INDEX "IDX_0330b4a942b536d8d1f264abe3"`);
        await queryRunner.query(`CREATE TABLE "temporary_task_status" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "value" varchar NOT NULL, "description" varchar, "icon" varchar, "color" varchar, "isSystem" boolean NOT NULL DEFAULT (0), "projectId" varchar, "organizationTeamId" varchar, CONSTRAINT "FK_a19e8975e5c296640d457dfc11f" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_9b9a828a49f4bd6383a4073fe23" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_efbaf00a743316b394cc31e4a20" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_0330b4a942b536d8d1f264abe32" FOREIGN KEY ("organizationTeamId") REFERENCES "organization_team" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_task_status"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "value", "description", "icon", "color", "isSystem", "projectId", "organizationTeamId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "value", "description", "icon", "color", "isSystem", "projectId", "organizationTeamId" FROM "task_status"`);
        await queryRunner.query(`DROP TABLE "task_status"`);
        await queryRunner.query(`ALTER TABLE "temporary_task_status" RENAME TO "task_status"`);
        await queryRunner.query(`CREATE INDEX "IDX_a19e8975e5c296640d457dfc11" ON "task_status" ("projectId") `);
        await queryRunner.query(`CREATE INDEX "IDX_68eaba689ed6d3e27ec93d3e88" ON "task_status" ("value") `);
        await queryRunner.query(`CREATE INDEX "IDX_b0c955f276679dd2b2735c3936" ON "task_status" ("name") `);
        await queryRunner.query(`CREATE INDEX "IDX_9b9a828a49f4bd6383a4073fe2" ON "task_status" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_efbaf00a743316b394cc31e4a2" ON "task_status" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_0330b4a942b536d8d1f264abe3" ON "task_status" ("organizationTeamId") `);
    }

    /**
    * SqliteDB Down Migration
    *
    * @param queryRunner
    */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_0330b4a942b536d8d1f264abe3"`);
        await queryRunner.query(`DROP INDEX "IDX_efbaf00a743316b394cc31e4a2"`);
        await queryRunner.query(`DROP INDEX "IDX_9b9a828a49f4bd6383a4073fe2"`);
        await queryRunner.query(`DROP INDEX "IDX_b0c955f276679dd2b2735c3936"`);
        await queryRunner.query(`DROP INDEX "IDX_68eaba689ed6d3e27ec93d3e88"`);
        await queryRunner.query(`DROP INDEX "IDX_a19e8975e5c296640d457dfc11"`);
        await queryRunner.query(`ALTER TABLE "task_status" RENAME TO "temporary_task_status"`);
        await queryRunner.query(`CREATE TABLE "task_status" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "value" varchar NOT NULL, "description" varchar, "icon" varchar, "color" varchar, "isSystem" boolean NOT NULL DEFAULT (0), "projectId" varchar, "organizationTeamId" varchar, CONSTRAINT "FK_a19e8975e5c296640d457dfc11f" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_9b9a828a49f4bd6383a4073fe23" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_efbaf00a743316b394cc31e4a20" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "task_status"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "value", "description", "icon", "color", "isSystem", "projectId", "organizationTeamId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "value", "description", "icon", "color", "isSystem", "projectId", "organizationTeamId" FROM "temporary_task_status"`);
        await queryRunner.query(`DROP TABLE "temporary_task_status"`);
        await queryRunner.query(`CREATE INDEX "IDX_0330b4a942b536d8d1f264abe3" ON "task_status" ("organizationTeamId") `);
        await queryRunner.query(`CREATE INDEX "IDX_efbaf00a743316b394cc31e4a2" ON "task_status" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_9b9a828a49f4bd6383a4073fe2" ON "task_status" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_b0c955f276679dd2b2735c3936" ON "task_status" ("name") `);
        await queryRunner.query(`CREATE INDEX "IDX_68eaba689ed6d3e27ec93d3e88" ON "task_status" ("value") `);
        await queryRunner.query(`CREATE INDEX "IDX_a19e8975e5c296640d457dfc11" ON "task_status" ("projectId") `);
        await queryRunner.query(`DROP INDEX "IDX_f4438327b3c2afb0832569b2a1"`);
        await queryRunner.query(`DROP INDEX "IDX_f6ec2207e50680a475d71c8979"`);
        await queryRunner.query(`DROP INDEX "IDX_596512cc6508a482cc23ae6ab7"`);
        await queryRunner.query(`DROP INDEX "IDX_90c54f57b29cc8b67edc2738ae"`);
        await queryRunner.query(`DROP INDEX "IDX_1a7b137d009616a2ff1aa6834f"`);
        await queryRunner.query(`DROP INDEX "IDX_ad6792b26526bd96ab18d63454"`);
        await queryRunner.query(`ALTER TABLE "task_size" RENAME TO "temporary_task_size"`);
        await queryRunner.query(`CREATE TABLE "task_size" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "value" varchar NOT NULL, "description" varchar, "icon" varchar, "color" varchar, "isSystem" boolean NOT NULL DEFAULT (0), "projectId" varchar, "organizationTeamId" varchar, CONSTRAINT "FK_ad6792b26526bd96ab18d634544" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_596512cc6508a482cc23ae6ab78" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_f6ec2207e50680a475d71c89793" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "task_size"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "value", "description", "icon", "color", "isSystem", "projectId", "organizationTeamId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "value", "description", "icon", "color", "isSystem", "projectId", "organizationTeamId" FROM "temporary_task_size"`);
        await queryRunner.query(`DROP TABLE "temporary_task_size"`);
        await queryRunner.query(`CREATE INDEX "IDX_f4438327b3c2afb0832569b2a1" ON "task_size" ("organizationTeamId") `);
        await queryRunner.query(`CREATE INDEX "IDX_f6ec2207e50680a475d71c8979" ON "task_size" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_596512cc6508a482cc23ae6ab7" ON "task_size" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_90c54f57b29cc8b67edc2738ae" ON "task_size" ("name") `);
        await queryRunner.query(`CREATE INDEX "IDX_1a7b137d009616a2ff1aa6834f" ON "task_size" ("value") `);
        await queryRunner.query(`CREATE INDEX "IDX_ad6792b26526bd96ab18d63454" ON "task_size" ("projectId") `);
        await queryRunner.query(`DROP INDEX "IDX_52b039cff6a1adf6b7f9e49ee4"`);
        await queryRunner.query(`DROP INDEX "IDX_1818655f27b8cf4f0d1dbfeb8d"`);
        await queryRunner.query(`DROP INDEX "IDX_7fd1b30d159b608cbf59009f68"`);
        await queryRunner.query(`DROP INDEX "IDX_7d656b4cba8f11e639dbc5aab3"`);
        await queryRunner.query(`DROP INDEX "IDX_46daede7b19176b6ad959d70da"`);
        await queryRunner.query(`DROP INDEX "IDX_db4237960ca989eb7a48cd433b"`);
        await queryRunner.query(`ALTER TABLE "task_priority" RENAME TO "temporary_task_priority"`);
        await queryRunner.query(`CREATE TABLE "task_priority" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "value" varchar NOT NULL, "description" varchar, "icon" varchar, "color" varchar, "isSystem" boolean NOT NULL DEFAULT (0), "projectId" varchar, "organizationTeamId" varchar, CONSTRAINT "FK_db4237960ca989eb7a48cd433b1" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_7fd1b30d159b608cbf59009f681" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_1818655f27b8cf4f0d1dbfeb8db" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "task_priority"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "value", "description", "icon", "color", "isSystem", "projectId", "organizationTeamId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "value", "description", "icon", "color", "isSystem", "projectId", "organizationTeamId" FROM "temporary_task_priority"`);
        await queryRunner.query(`DROP TABLE "temporary_task_priority"`);
        await queryRunner.query(`CREATE INDEX "IDX_52b039cff6a1adf6b7f9e49ee4" ON "task_priority" ("organizationTeamId") `);
        await queryRunner.query(`CREATE INDEX "IDX_1818655f27b8cf4f0d1dbfeb8d" ON "task_priority" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_7fd1b30d159b608cbf59009f68" ON "task_priority" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_7d656b4cba8f11e639dbc5aab3" ON "task_priority" ("name") `);
        await queryRunner.query(`CREATE INDEX "IDX_46daede7b19176b6ad959d70da" ON "task_priority" ("value") `);
        await queryRunner.query(`CREATE INDEX "IDX_db4237960ca989eb7a48cd433b" ON "task_priority" ("projectId") `);
        await queryRunner.query(`DROP INDEX "IDX_0330b4a942b536d8d1f264abe3"`);
        await queryRunner.query(`DROP INDEX "IDX_f4438327b3c2afb0832569b2a1"`);
        await queryRunner.query(`DROP INDEX "IDX_52b039cff6a1adf6b7f9e49ee4"`);
        await queryRunner.query(`DROP INDEX "IDX_efbaf00a743316b394cc31e4a2"`);
        await queryRunner.query(`DROP INDEX "IDX_9b9a828a49f4bd6383a4073fe2"`);
        await queryRunner.query(`DROP INDEX "IDX_b0c955f276679dd2b2735c3936"`);
        await queryRunner.query(`DROP INDEX "IDX_68eaba689ed6d3e27ec93d3e88"`);
        await queryRunner.query(`DROP INDEX "IDX_a19e8975e5c296640d457dfc11"`);
        await queryRunner.query(`ALTER TABLE "task_status" RENAME TO "temporary_task_status"`);
        await queryRunner.query(`CREATE TABLE "task_status" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "value" varchar NOT NULL, "description" varchar, "icon" varchar, "color" varchar, "isSystem" boolean NOT NULL DEFAULT (0), "projectId" varchar, CONSTRAINT "FK_a19e8975e5c296640d457dfc11f" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_9b9a828a49f4bd6383a4073fe23" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_efbaf00a743316b394cc31e4a20" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "task_status"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "value", "description", "icon", "color", "isSystem", "projectId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "value", "description", "icon", "color", "isSystem", "projectId" FROM "temporary_task_status"`);
        await queryRunner.query(`DROP TABLE "temporary_task_status"`);
        await queryRunner.query(`CREATE INDEX "IDX_efbaf00a743316b394cc31e4a2" ON "task_status" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_9b9a828a49f4bd6383a4073fe2" ON "task_status" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_b0c955f276679dd2b2735c3936" ON "task_status" ("name") `);
        await queryRunner.query(`CREATE INDEX "IDX_68eaba689ed6d3e27ec93d3e88" ON "task_status" ("value") `);
        await queryRunner.query(`CREATE INDEX "IDX_a19e8975e5c296640d457dfc11" ON "task_status" ("projectId") `);
        await queryRunner.query(`DROP INDEX "IDX_f6ec2207e50680a475d71c8979"`);
        await queryRunner.query(`DROP INDEX "IDX_596512cc6508a482cc23ae6ab7"`);
        await queryRunner.query(`DROP INDEX "IDX_90c54f57b29cc8b67edc2738ae"`);
        await queryRunner.query(`DROP INDEX "IDX_1a7b137d009616a2ff1aa6834f"`);
        await queryRunner.query(`DROP INDEX "IDX_ad6792b26526bd96ab18d63454"`);
        await queryRunner.query(`ALTER TABLE "task_size" RENAME TO "temporary_task_size"`);
        await queryRunner.query(`CREATE TABLE "task_size" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "value" varchar NOT NULL, "description" varchar, "icon" varchar, "color" varchar, "isSystem" boolean NOT NULL DEFAULT (0), "projectId" varchar, CONSTRAINT "FK_ad6792b26526bd96ab18d634544" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_596512cc6508a482cc23ae6ab78" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_f6ec2207e50680a475d71c89793" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "task_size"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "value", "description", "icon", "color", "isSystem", "projectId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "value", "description", "icon", "color", "isSystem", "projectId" FROM "temporary_task_size"`);
        await queryRunner.query(`DROP TABLE "temporary_task_size"`);
        await queryRunner.query(`CREATE INDEX "IDX_f6ec2207e50680a475d71c8979" ON "task_size" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_596512cc6508a482cc23ae6ab7" ON "task_size" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_90c54f57b29cc8b67edc2738ae" ON "task_size" ("name") `);
        await queryRunner.query(`CREATE INDEX "IDX_1a7b137d009616a2ff1aa6834f" ON "task_size" ("value") `);
        await queryRunner.query(`CREATE INDEX "IDX_ad6792b26526bd96ab18d63454" ON "task_size" ("projectId") `);
        await queryRunner.query(`DROP INDEX "IDX_1818655f27b8cf4f0d1dbfeb8d"`);
        await queryRunner.query(`DROP INDEX "IDX_7fd1b30d159b608cbf59009f68"`);
        await queryRunner.query(`DROP INDEX "IDX_7d656b4cba8f11e639dbc5aab3"`);
        await queryRunner.query(`DROP INDEX "IDX_46daede7b19176b6ad959d70da"`);
        await queryRunner.query(`DROP INDEX "IDX_db4237960ca989eb7a48cd433b"`);
        await queryRunner.query(`ALTER TABLE "task_priority" RENAME TO "temporary_task_priority"`);
        await queryRunner.query(`CREATE TABLE "task_priority" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "value" varchar NOT NULL, "description" varchar, "icon" varchar, "color" varchar, "isSystem" boolean NOT NULL DEFAULT (0), "projectId" varchar, CONSTRAINT "FK_db4237960ca989eb7a48cd433b1" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_7fd1b30d159b608cbf59009f681" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_1818655f27b8cf4f0d1dbfeb8db" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "task_priority"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "value", "description", "icon", "color", "isSystem", "projectId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "value", "description", "icon", "color", "isSystem", "projectId" FROM "temporary_task_priority"`);
        await queryRunner.query(`DROP TABLE "temporary_task_priority"`);
        await queryRunner.query(`CREATE INDEX "IDX_1818655f27b8cf4f0d1dbfeb8d" ON "task_priority" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_7fd1b30d159b608cbf59009f68" ON "task_priority" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_7d656b4cba8f11e639dbc5aab3" ON "task_priority" ("name") `);
        await queryRunner.query(`CREATE INDEX "IDX_46daede7b19176b6ad959d70da" ON "task_priority" ("value") `);
        await queryRunner.query(`CREATE INDEX "IDX_db4237960ca989eb7a48cd433b" ON "task_priority" ("projectId") `);
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
