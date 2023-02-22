
import { MigrationInterface, QueryRunner } from "typeorm";

export class AlterOrganizationTeamTable1677063195155 implements MigrationInterface {

    name = 'AlterOrganizationTeamTable1677063195155';

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
        await queryRunner.query(`ALTER TABLE "task_priority" ADD "teamId" uuid`);
        await queryRunner.query(`ALTER TABLE "task_size" ADD "teamId" uuid`);
        await queryRunner.query(`ALTER TABLE "task_status" ADD "teamId" uuid`);
        await queryRunner.query(`CREATE INDEX "IDX_2d7d91e495e800713509eb6b42" ON "task_priority" ("teamId") `);
        await queryRunner.query(`CREATE INDEX "IDX_2140ead911c7f64acef8a048ce" ON "task_size" ("teamId") `);
        await queryRunner.query(`CREATE INDEX "IDX_b64e77978c00f2f21834173688" ON "task_status" ("teamId") `);
        await queryRunner.query(`ALTER TABLE "task_priority" ADD CONSTRAINT "FK_2d7d91e495e800713509eb6b424" FOREIGN KEY ("teamId") REFERENCES "organization_team"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "task_size" ADD CONSTRAINT "FK_2140ead911c7f64acef8a048ce9" FOREIGN KEY ("teamId") REFERENCES "organization_team"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "task_status" ADD CONSTRAINT "FK_b64e77978c00f2f21834173688d" FOREIGN KEY ("teamId") REFERENCES "organization_team"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "task_status" DROP CONSTRAINT "FK_b64e77978c00f2f21834173688d"`);
        await queryRunner.query(`ALTER TABLE "task_size" DROP CONSTRAINT "FK_2140ead911c7f64acef8a048ce9"`);
        await queryRunner.query(`ALTER TABLE "task_priority" DROP CONSTRAINT "FK_2d7d91e495e800713509eb6b424"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b64e77978c00f2f21834173688"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2140ead911c7f64acef8a048ce"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2d7d91e495e800713509eb6b42"`);
        await queryRunner.query(`ALTER TABLE "task_status" DROP COLUMN "teamId"`);
        await queryRunner.query(`ALTER TABLE "task_size" DROP COLUMN "teamId"`);
        await queryRunner.query(`ALTER TABLE "task_priority" DROP COLUMN "teamId"`);
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
        await queryRunner.query(`CREATE TABLE "temporary_task_priority" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "value" varchar NOT NULL, "description" varchar, "icon" varchar, "color" varchar, "isSystem" boolean NOT NULL DEFAULT (0), "projectId" varchar, "teamId" varchar, CONSTRAINT "FK_db4237960ca989eb7a48cd433b1" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_7fd1b30d159b608cbf59009f681" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_1818655f27b8cf4f0d1dbfeb8db" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
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
        await queryRunner.query(`CREATE TABLE "temporary_task_size" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "value" varchar NOT NULL, "description" varchar, "icon" varchar, "color" varchar, "isSystem" boolean NOT NULL DEFAULT (0), "projectId" varchar, "teamId" varchar, CONSTRAINT "FK_ad6792b26526bd96ab18d634544" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_596512cc6508a482cc23ae6ab78" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_f6ec2207e50680a475d71c89793" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
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
        await queryRunner.query(`CREATE TABLE "temporary_task_status" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "value" varchar NOT NULL, "description" varchar, "icon" varchar, "color" varchar, "isSystem" boolean NOT NULL DEFAULT (0), "projectId" varchar, "teamId" varchar, CONSTRAINT "FK_a19e8975e5c296640d457dfc11f" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_9b9a828a49f4bd6383a4073fe23" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_efbaf00a743316b394cc31e4a20" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_task_status"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "value", "description", "icon", "color", "isSystem", "projectId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "value", "description", "icon", "color", "isSystem", "projectId" FROM "task_status"`);
        await queryRunner.query(`DROP TABLE "task_status"`);
        await queryRunner.query(`ALTER TABLE "temporary_task_status" RENAME TO "task_status"`);
        await queryRunner.query(`CREATE INDEX "IDX_a19e8975e5c296640d457dfc11" ON "task_status" ("projectId") `);
        await queryRunner.query(`CREATE INDEX "IDX_68eaba689ed6d3e27ec93d3e88" ON "task_status" ("value") `);
        await queryRunner.query(`CREATE INDEX "IDX_b0c955f276679dd2b2735c3936" ON "task_status" ("name") `);
        await queryRunner.query(`CREATE INDEX "IDX_9b9a828a49f4bd6383a4073fe2" ON "task_status" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_efbaf00a743316b394cc31e4a2" ON "task_status" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_2d7d91e495e800713509eb6b42" ON "task_priority" ("teamId") `);
        await queryRunner.query(`CREATE INDEX "IDX_2140ead911c7f64acef8a048ce" ON "task_size" ("teamId") `);
        await queryRunner.query(`CREATE INDEX "IDX_b64e77978c00f2f21834173688" ON "task_status" ("teamId") `);
        await queryRunner.query(`DROP INDEX "IDX_db4237960ca989eb7a48cd433b"`);
        await queryRunner.query(`DROP INDEX "IDX_46daede7b19176b6ad959d70da"`);
        await queryRunner.query(`DROP INDEX "IDX_7d656b4cba8f11e639dbc5aab3"`);
        await queryRunner.query(`DROP INDEX "IDX_7fd1b30d159b608cbf59009f68"`);
        await queryRunner.query(`DROP INDEX "IDX_1818655f27b8cf4f0d1dbfeb8d"`);
        await queryRunner.query(`DROP INDEX "IDX_2d7d91e495e800713509eb6b42"`);
        await queryRunner.query(`CREATE TABLE "temporary_task_priority" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "value" varchar NOT NULL, "description" varchar, "icon" varchar, "color" varchar, "isSystem" boolean NOT NULL DEFAULT (0), "projectId" varchar, "teamId" varchar, CONSTRAINT "FK_db4237960ca989eb7a48cd433b1" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_7fd1b30d159b608cbf59009f681" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_1818655f27b8cf4f0d1dbfeb8db" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_2d7d91e495e800713509eb6b424" FOREIGN KEY ("teamId") REFERENCES "organization_team" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_task_priority"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "value", "description", "icon", "color", "isSystem", "projectId", "teamId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "value", "description", "icon", "color", "isSystem", "projectId", "teamId" FROM "task_priority"`);
        await queryRunner.query(`DROP TABLE "task_priority"`);
        await queryRunner.query(`ALTER TABLE "temporary_task_priority" RENAME TO "task_priority"`);
        await queryRunner.query(`CREATE INDEX "IDX_db4237960ca989eb7a48cd433b" ON "task_priority" ("projectId") `);
        await queryRunner.query(`CREATE INDEX "IDX_46daede7b19176b6ad959d70da" ON "task_priority" ("value") `);
        await queryRunner.query(`CREATE INDEX "IDX_7d656b4cba8f11e639dbc5aab3" ON "task_priority" ("name") `);
        await queryRunner.query(`CREATE INDEX "IDX_7fd1b30d159b608cbf59009f68" ON "task_priority" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_1818655f27b8cf4f0d1dbfeb8d" ON "task_priority" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_2d7d91e495e800713509eb6b42" ON "task_priority" ("teamId") `);
        await queryRunner.query(`DROP INDEX "IDX_ad6792b26526bd96ab18d63454"`);
        await queryRunner.query(`DROP INDEX "IDX_1a7b137d009616a2ff1aa6834f"`);
        await queryRunner.query(`DROP INDEX "IDX_90c54f57b29cc8b67edc2738ae"`);
        await queryRunner.query(`DROP INDEX "IDX_596512cc6508a482cc23ae6ab7"`);
        await queryRunner.query(`DROP INDEX "IDX_f6ec2207e50680a475d71c8979"`);
        await queryRunner.query(`DROP INDEX "IDX_2140ead911c7f64acef8a048ce"`);
        await queryRunner.query(`CREATE TABLE "temporary_task_size" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "value" varchar NOT NULL, "description" varchar, "icon" varchar, "color" varchar, "isSystem" boolean NOT NULL DEFAULT (0), "projectId" varchar, "teamId" varchar, CONSTRAINT "FK_ad6792b26526bd96ab18d634544" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_596512cc6508a482cc23ae6ab78" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_f6ec2207e50680a475d71c89793" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_2140ead911c7f64acef8a048ce9" FOREIGN KEY ("teamId") REFERENCES "organization_team" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_task_size"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "value", "description", "icon", "color", "isSystem", "projectId", "teamId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "value", "description", "icon", "color", "isSystem", "projectId", "teamId" FROM "task_size"`);
        await queryRunner.query(`DROP TABLE "task_size"`);
        await queryRunner.query(`ALTER TABLE "temporary_task_size" RENAME TO "task_size"`);
        await queryRunner.query(`CREATE INDEX "IDX_ad6792b26526bd96ab18d63454" ON "task_size" ("projectId") `);
        await queryRunner.query(`CREATE INDEX "IDX_1a7b137d009616a2ff1aa6834f" ON "task_size" ("value") `);
        await queryRunner.query(`CREATE INDEX "IDX_90c54f57b29cc8b67edc2738ae" ON "task_size" ("name") `);
        await queryRunner.query(`CREATE INDEX "IDX_596512cc6508a482cc23ae6ab7" ON "task_size" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_f6ec2207e50680a475d71c8979" ON "task_size" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_2140ead911c7f64acef8a048ce" ON "task_size" ("teamId") `);
        await queryRunner.query(`DROP INDEX "IDX_a19e8975e5c296640d457dfc11"`);
        await queryRunner.query(`DROP INDEX "IDX_68eaba689ed6d3e27ec93d3e88"`);
        await queryRunner.query(`DROP INDEX "IDX_b0c955f276679dd2b2735c3936"`);
        await queryRunner.query(`DROP INDEX "IDX_9b9a828a49f4bd6383a4073fe2"`);
        await queryRunner.query(`DROP INDEX "IDX_efbaf00a743316b394cc31e4a2"`);
        await queryRunner.query(`DROP INDEX "IDX_b64e77978c00f2f21834173688"`);
        await queryRunner.query(`CREATE TABLE "temporary_task_status" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "value" varchar NOT NULL, "description" varchar, "icon" varchar, "color" varchar, "isSystem" boolean NOT NULL DEFAULT (0), "projectId" varchar, "teamId" varchar, CONSTRAINT "FK_a19e8975e5c296640d457dfc11f" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_9b9a828a49f4bd6383a4073fe23" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_efbaf00a743316b394cc31e4a20" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_b64e77978c00f2f21834173688d" FOREIGN KEY ("teamId") REFERENCES "organization_team" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_task_status"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "value", "description", "icon", "color", "isSystem", "projectId", "teamId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "value", "description", "icon", "color", "isSystem", "projectId", "teamId" FROM "task_status"`);
        await queryRunner.query(`DROP TABLE "task_status"`);
        await queryRunner.query(`ALTER TABLE "temporary_task_status" RENAME TO "task_status"`);
        await queryRunner.query(`CREATE INDEX "IDX_a19e8975e5c296640d457dfc11" ON "task_status" ("projectId") `);
        await queryRunner.query(`CREATE INDEX "IDX_68eaba689ed6d3e27ec93d3e88" ON "task_status" ("value") `);
        await queryRunner.query(`CREATE INDEX "IDX_b0c955f276679dd2b2735c3936" ON "task_status" ("name") `);
        await queryRunner.query(`CREATE INDEX "IDX_9b9a828a49f4bd6383a4073fe2" ON "task_status" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_efbaf00a743316b394cc31e4a2" ON "task_status" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_b64e77978c00f2f21834173688" ON "task_status" ("teamId") `);
    }

    /**
    * SqliteDB Down Migration
    *
    * @param queryRunner
    */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_b64e77978c00f2f21834173688"`);
        await queryRunner.query(`DROP INDEX "IDX_efbaf00a743316b394cc31e4a2"`);
        await queryRunner.query(`DROP INDEX "IDX_9b9a828a49f4bd6383a4073fe2"`);
        await queryRunner.query(`DROP INDEX "IDX_b0c955f276679dd2b2735c3936"`);
        await queryRunner.query(`DROP INDEX "IDX_68eaba689ed6d3e27ec93d3e88"`);
        await queryRunner.query(`DROP INDEX "IDX_a19e8975e5c296640d457dfc11"`);
        await queryRunner.query(`ALTER TABLE "task_status" RENAME TO "temporary_task_status"`);
        await queryRunner.query(`CREATE TABLE "task_status" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "value" varchar NOT NULL, "description" varchar, "icon" varchar, "color" varchar, "isSystem" boolean NOT NULL DEFAULT (0), "projectId" varchar, "teamId" varchar, CONSTRAINT "FK_a19e8975e5c296640d457dfc11f" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_9b9a828a49f4bd6383a4073fe23" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_efbaf00a743316b394cc31e4a20" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "task_status"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "value", "description", "icon", "color", "isSystem", "projectId", "teamId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "value", "description", "icon", "color", "isSystem", "projectId", "teamId" FROM "temporary_task_status"`);
        await queryRunner.query(`DROP TABLE "temporary_task_status"`);
        await queryRunner.query(`CREATE INDEX "IDX_b64e77978c00f2f21834173688" ON "task_status" ("teamId") `);
        await queryRunner.query(`CREATE INDEX "IDX_efbaf00a743316b394cc31e4a2" ON "task_status" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_9b9a828a49f4bd6383a4073fe2" ON "task_status" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_b0c955f276679dd2b2735c3936" ON "task_status" ("name") `);
        await queryRunner.query(`CREATE INDEX "IDX_68eaba689ed6d3e27ec93d3e88" ON "task_status" ("value") `);
        await queryRunner.query(`CREATE INDEX "IDX_a19e8975e5c296640d457dfc11" ON "task_status" ("projectId") `);
        await queryRunner.query(`DROP INDEX "IDX_2140ead911c7f64acef8a048ce"`);
        await queryRunner.query(`DROP INDEX "IDX_f6ec2207e50680a475d71c8979"`);
        await queryRunner.query(`DROP INDEX "IDX_596512cc6508a482cc23ae6ab7"`);
        await queryRunner.query(`DROP INDEX "IDX_90c54f57b29cc8b67edc2738ae"`);
        await queryRunner.query(`DROP INDEX "IDX_1a7b137d009616a2ff1aa6834f"`);
        await queryRunner.query(`DROP INDEX "IDX_ad6792b26526bd96ab18d63454"`);
        await queryRunner.query(`ALTER TABLE "task_size" RENAME TO "temporary_task_size"`);
        await queryRunner.query(`CREATE TABLE "task_size" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "value" varchar NOT NULL, "description" varchar, "icon" varchar, "color" varchar, "isSystem" boolean NOT NULL DEFAULT (0), "projectId" varchar, "teamId" varchar, CONSTRAINT "FK_ad6792b26526bd96ab18d634544" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_596512cc6508a482cc23ae6ab78" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_f6ec2207e50680a475d71c89793" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "task_size"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "value", "description", "icon", "color", "isSystem", "projectId", "teamId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "value", "description", "icon", "color", "isSystem", "projectId", "teamId" FROM "temporary_task_size"`);
        await queryRunner.query(`DROP TABLE "temporary_task_size"`);
        await queryRunner.query(`CREATE INDEX "IDX_2140ead911c7f64acef8a048ce" ON "task_size" ("teamId") `);
        await queryRunner.query(`CREATE INDEX "IDX_f6ec2207e50680a475d71c8979" ON "task_size" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_596512cc6508a482cc23ae6ab7" ON "task_size" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_90c54f57b29cc8b67edc2738ae" ON "task_size" ("name") `);
        await queryRunner.query(`CREATE INDEX "IDX_1a7b137d009616a2ff1aa6834f" ON "task_size" ("value") `);
        await queryRunner.query(`CREATE INDEX "IDX_ad6792b26526bd96ab18d63454" ON "task_size" ("projectId") `);
        await queryRunner.query(`DROP INDEX "IDX_2d7d91e495e800713509eb6b42"`);
        await queryRunner.query(`DROP INDEX "IDX_1818655f27b8cf4f0d1dbfeb8d"`);
        await queryRunner.query(`DROP INDEX "IDX_7fd1b30d159b608cbf59009f68"`);
        await queryRunner.query(`DROP INDEX "IDX_7d656b4cba8f11e639dbc5aab3"`);
        await queryRunner.query(`DROP INDEX "IDX_46daede7b19176b6ad959d70da"`);
        await queryRunner.query(`DROP INDEX "IDX_db4237960ca989eb7a48cd433b"`);
        await queryRunner.query(`ALTER TABLE "task_priority" RENAME TO "temporary_task_priority"`);
        await queryRunner.query(`CREATE TABLE "task_priority" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "value" varchar NOT NULL, "description" varchar, "icon" varchar, "color" varchar, "isSystem" boolean NOT NULL DEFAULT (0), "projectId" varchar, "teamId" varchar, CONSTRAINT "FK_db4237960ca989eb7a48cd433b1" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_7fd1b30d159b608cbf59009f681" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_1818655f27b8cf4f0d1dbfeb8db" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "task_priority"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "value", "description", "icon", "color", "isSystem", "projectId", "teamId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "value", "description", "icon", "color", "isSystem", "projectId", "teamId" FROM "temporary_task_priority"`);
        await queryRunner.query(`DROP TABLE "temporary_task_priority"`);
        await queryRunner.query(`CREATE INDEX "IDX_2d7d91e495e800713509eb6b42" ON "task_priority" ("teamId") `);
        await queryRunner.query(`CREATE INDEX "IDX_1818655f27b8cf4f0d1dbfeb8d" ON "task_priority" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_7fd1b30d159b608cbf59009f68" ON "task_priority" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_7d656b4cba8f11e639dbc5aab3" ON "task_priority" ("name") `);
        await queryRunner.query(`CREATE INDEX "IDX_46daede7b19176b6ad959d70da" ON "task_priority" ("value") `);
        await queryRunner.query(`CREATE INDEX "IDX_db4237960ca989eb7a48cd433b" ON "task_priority" ("projectId") `);
        await queryRunner.query(`DROP INDEX "IDX_b64e77978c00f2f21834173688"`);
        await queryRunner.query(`DROP INDEX "IDX_2140ead911c7f64acef8a048ce"`);
        await queryRunner.query(`DROP INDEX "IDX_2d7d91e495e800713509eb6b42"`);
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
}
