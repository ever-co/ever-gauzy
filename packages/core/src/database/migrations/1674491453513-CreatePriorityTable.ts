
import { MigrationInterface, QueryRunner } from "typeorm";

export class CreatePriorityTable1674491453513 implements MigrationInterface {

    name = 'CreatePriorityTable1674491453513';

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
        await queryRunner.query(`CREATE TABLE "priority" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "tenantId" uuid, "organizationId" uuid, "name" character varying NOT NULL, "value" character varying NOT NULL, "description" character varying, "icon" character varying, "color" character varying, "isSystem" boolean NOT NULL DEFAULT false, "projectId" uuid, CONSTRAINT "PK_413921aa4a118e20f361ceba8b4" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_a44879fd9f853ec46590f97e8e" ON "priority" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_e714f9037c786e8ef60576ffa3" ON "priority" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_9658b4dbb2043a4517d7d0e662" ON "priority" ("name") `);
        await queryRunner.query(`CREATE INDEX "IDX_bb75419f1f6a0760f0f366c161" ON "priority" ("value") `);
        await queryRunner.query(`CREATE INDEX "IDX_de58811ff219f6c26a6ac70b98" ON "priority" ("projectId") `);
        await queryRunner.query(`ALTER TABLE "priority" ADD CONSTRAINT "FK_a44879fd9f853ec46590f97e8eb" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "priority" ADD CONSTRAINT "FK_e714f9037c786e8ef60576ffa39" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "priority" ADD CONSTRAINT "FK_de58811ff219f6c26a6ac70b984" FOREIGN KEY ("projectId") REFERENCES "organization_project"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "priority" DROP CONSTRAINT "FK_de58811ff219f6c26a6ac70b984"`);
        await queryRunner.query(`ALTER TABLE "priority" DROP CONSTRAINT "FK_e714f9037c786e8ef60576ffa39"`);
        await queryRunner.query(`ALTER TABLE "priority" DROP CONSTRAINT "FK_a44879fd9f853ec46590f97e8eb"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_de58811ff219f6c26a6ac70b98"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_bb75419f1f6a0760f0f366c161"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9658b4dbb2043a4517d7d0e662"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e714f9037c786e8ef60576ffa3"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a44879fd9f853ec46590f97e8e"`);
        await queryRunner.query(`DROP TABLE "priority"`);
    }

    /**
    * SqliteDB Up Migration
    *
    * @param queryRunner
    */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`CREATE TABLE "priority" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "value" varchar NOT NULL, "description" varchar, "icon" varchar, "color" varchar, "isSystem" boolean NOT NULL DEFAULT (0), "projectId" varchar)`);
        await queryRunner.query(`CREATE INDEX "IDX_a44879fd9f853ec46590f97e8e" ON "priority" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_e714f9037c786e8ef60576ffa3" ON "priority" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_9658b4dbb2043a4517d7d0e662" ON "priority" ("name") `);
        await queryRunner.query(`CREATE INDEX "IDX_bb75419f1f6a0760f0f366c161" ON "priority" ("value") `);
        await queryRunner.query(`CREATE INDEX "IDX_de58811ff219f6c26a6ac70b98" ON "priority" ("projectId") `);
        await queryRunner.query(`DROP INDEX "IDX_a44879fd9f853ec46590f97e8e"`);
        await queryRunner.query(`DROP INDEX "IDX_e714f9037c786e8ef60576ffa3"`);
        await queryRunner.query(`DROP INDEX "IDX_9658b4dbb2043a4517d7d0e662"`);
        await queryRunner.query(`DROP INDEX "IDX_bb75419f1f6a0760f0f366c161"`);
        await queryRunner.query(`DROP INDEX "IDX_de58811ff219f6c26a6ac70b98"`);
        await queryRunner.query(`CREATE TABLE "temporary_priority" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "value" varchar NOT NULL, "description" varchar, "icon" varchar, "color" varchar, "isSystem" boolean NOT NULL DEFAULT (0), "projectId" varchar, CONSTRAINT "FK_a44879fd9f853ec46590f97e8eb" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_e714f9037c786e8ef60576ffa39" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_de58811ff219f6c26a6ac70b984" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_priority"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "value", "description", "icon", "color", "isSystem", "projectId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "value", "description", "icon", "color", "isSystem", "projectId" FROM "priority"`);
        await queryRunner.query(`DROP TABLE "priority"`);
        await queryRunner.query(`ALTER TABLE "temporary_priority" RENAME TO "priority"`);
        await queryRunner.query(`CREATE INDEX "IDX_a44879fd9f853ec46590f97e8e" ON "priority" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_e714f9037c786e8ef60576ffa3" ON "priority" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_9658b4dbb2043a4517d7d0e662" ON "priority" ("name") `);
        await queryRunner.query(`CREATE INDEX "IDX_bb75419f1f6a0760f0f366c161" ON "priority" ("value") `);
        await queryRunner.query(`CREATE INDEX "IDX_de58811ff219f6c26a6ac70b98" ON "priority" ("projectId") `);
    }

    /**
    * SqliteDB Down Migration
    *
    * @param queryRunner
    */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_de58811ff219f6c26a6ac70b98"`);
        await queryRunner.query(`DROP INDEX "IDX_bb75419f1f6a0760f0f366c161"`);
        await queryRunner.query(`DROP INDEX "IDX_9658b4dbb2043a4517d7d0e662"`);
        await queryRunner.query(`DROP INDEX "IDX_e714f9037c786e8ef60576ffa3"`);
        await queryRunner.query(`DROP INDEX "IDX_a44879fd9f853ec46590f97e8e"`);
        await queryRunner.query(`ALTER TABLE "priority" RENAME TO "temporary_priority"`);
        await queryRunner.query(`CREATE TABLE "priority" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "value" varchar NOT NULL, "description" varchar, "icon" varchar, "color" varchar, "isSystem" boolean NOT NULL DEFAULT (0), "projectId" varchar)`);
        await queryRunner.query(`INSERT INTO "priority"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "value", "description", "icon", "color", "isSystem", "projectId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "value", "description", "icon", "color", "isSystem", "projectId" FROM "temporary_priority"`);
        await queryRunner.query(`DROP TABLE "temporary_priority"`);
        await queryRunner.query(`CREATE INDEX "IDX_de58811ff219f6c26a6ac70b98" ON "priority" ("projectId") `);
        await queryRunner.query(`CREATE INDEX "IDX_bb75419f1f6a0760f0f366c161" ON "priority" ("value") `);
        await queryRunner.query(`CREATE INDEX "IDX_9658b4dbb2043a4517d7d0e662" ON "priority" ("name") `);
        await queryRunner.query(`CREATE INDEX "IDX_e714f9037c786e8ef60576ffa3" ON "priority" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_a44879fd9f853ec46590f97e8e" ON "priority" ("tenantId") `);
        await queryRunner.query(`DROP INDEX "IDX_de58811ff219f6c26a6ac70b98"`);
        await queryRunner.query(`DROP INDEX "IDX_bb75419f1f6a0760f0f366c161"`);
        await queryRunner.query(`DROP INDEX "IDX_9658b4dbb2043a4517d7d0e662"`);
        await queryRunner.query(`DROP INDEX "IDX_e714f9037c786e8ef60576ffa3"`);
        await queryRunner.query(`DROP INDEX "IDX_a44879fd9f853ec46590f97e8e"`);
        await queryRunner.query(`DROP TABLE "priority"`);
    }
}
