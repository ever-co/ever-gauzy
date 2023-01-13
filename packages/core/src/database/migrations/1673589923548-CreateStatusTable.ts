
import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateStatusTable1673589923548 implements MigrationInterface {

    name = 'CreateStatusTable1673589923548';

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
        await queryRunner.query(`CREATE TABLE "status" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "tenantId" uuid, "organizationId" uuid, "name" character varying NOT NULL, "value" character varying NOT NULL, "description" character varying, "icon" character varying, "color" character varying, "isSystem" boolean NOT NULL DEFAULT false, "projectId" uuid, CONSTRAINT "PK_e12743a7086ec826733f54e1d95" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_4e523a8b0628d467316dcbd45f" ON "status" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_843edbaab7b6aac6037d50319c" ON "status" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_95ff138b88fdd8a7c9ebdb97a3" ON "status" ("name") `);
        await queryRunner.query(`CREATE INDEX "IDX_6a043d4088c6303d62b4c6edf8" ON "status" ("value") `);
        await queryRunner.query(`CREATE INDEX "IDX_14c9897451c5ecc91211a2e873" ON "status" ("projectId") `);
        await queryRunner.query(`ALTER TABLE "status" ADD CONSTRAINT "FK_4e523a8b0628d467316dcbd45f5" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "status" ADD CONSTRAINT "FK_843edbaab7b6aac6037d50319cc" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "status" ADD CONSTRAINT "FK_14c9897451c5ecc91211a2e873d" FOREIGN KEY ("projectId") REFERENCES "organization_project"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "status" DROP CONSTRAINT "FK_14c9897451c5ecc91211a2e873d"`);
        await queryRunner.query(`ALTER TABLE "status" DROP CONSTRAINT "FK_843edbaab7b6aac6037d50319cc"`);
        await queryRunner.query(`ALTER TABLE "status" DROP CONSTRAINT "FK_4e523a8b0628d467316dcbd45f5"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_14c9897451c5ecc91211a2e873"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6a043d4088c6303d62b4c6edf8"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_95ff138b88fdd8a7c9ebdb97a3"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_843edbaab7b6aac6037d50319c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_4e523a8b0628d467316dcbd45f"`);
        await queryRunner.query(`DROP TABLE "status"`);
    }

    /**
    * SqliteDB Up Migration
    *
    * @param queryRunner
    */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`CREATE TABLE "status" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "value" varchar NOT NULL, "description" varchar, "icon" varchar, "color" varchar, "isSystem" boolean NOT NULL DEFAULT (0), "projectId" varchar)`);
        await queryRunner.query(`CREATE INDEX "IDX_4e523a8b0628d467316dcbd45f" ON "status" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_843edbaab7b6aac6037d50319c" ON "status" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_95ff138b88fdd8a7c9ebdb97a3" ON "status" ("name") `);
        await queryRunner.query(`CREATE INDEX "IDX_6a043d4088c6303d62b4c6edf8" ON "status" ("value") `);
        await queryRunner.query(`CREATE INDEX "IDX_14c9897451c5ecc91211a2e873" ON "status" ("projectId") `);
        await queryRunner.query(`DROP INDEX "IDX_4e523a8b0628d467316dcbd45f"`);
        await queryRunner.query(`DROP INDEX "IDX_843edbaab7b6aac6037d50319c"`);
        await queryRunner.query(`DROP INDEX "IDX_95ff138b88fdd8a7c9ebdb97a3"`);
        await queryRunner.query(`DROP INDEX "IDX_6a043d4088c6303d62b4c6edf8"`);
        await queryRunner.query(`DROP INDEX "IDX_14c9897451c5ecc91211a2e873"`);
        await queryRunner.query(`CREATE TABLE "temporary_status" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "value" varchar NOT NULL, "description" varchar, "icon" varchar, "color" varchar, "isSystem" boolean NOT NULL DEFAULT (0), "projectId" varchar, CONSTRAINT "FK_4e523a8b0628d467316dcbd45f5" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_843edbaab7b6aac6037d50319cc" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_14c9897451c5ecc91211a2e873d" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_status"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "value", "description", "icon", "color", "isSystem", "projectId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "value", "description", "icon", "color", "isSystem", "projectId" FROM "status"`);
        await queryRunner.query(`DROP TABLE "status"`);
        await queryRunner.query(`ALTER TABLE "temporary_status" RENAME TO "status"`);
        await queryRunner.query(`CREATE INDEX "IDX_4e523a8b0628d467316dcbd45f" ON "status" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_843edbaab7b6aac6037d50319c" ON "status" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_95ff138b88fdd8a7c9ebdb97a3" ON "status" ("name") `);
        await queryRunner.query(`CREATE INDEX "IDX_6a043d4088c6303d62b4c6edf8" ON "status" ("value") `);
        await queryRunner.query(`CREATE INDEX "IDX_14c9897451c5ecc91211a2e873" ON "status" ("projectId") `);
    }

    /**
    * SqliteDB Down Migration
    *
    * @param queryRunner
    */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_14c9897451c5ecc91211a2e873"`);
        await queryRunner.query(`DROP INDEX "IDX_6a043d4088c6303d62b4c6edf8"`);
        await queryRunner.query(`DROP INDEX "IDX_95ff138b88fdd8a7c9ebdb97a3"`);
        await queryRunner.query(`DROP INDEX "IDX_843edbaab7b6aac6037d50319c"`);
        await queryRunner.query(`DROP INDEX "IDX_4e523a8b0628d467316dcbd45f"`);
        await queryRunner.query(`ALTER TABLE "status" RENAME TO "temporary_status"`);
        await queryRunner.query(`CREATE TABLE "status" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "value" varchar NOT NULL, "description" varchar, "icon" varchar, "color" varchar, "isSystem" boolean NOT NULL DEFAULT (0), "projectId" varchar)`);
        await queryRunner.query(`INSERT INTO "status"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "value", "description", "icon", "color", "isSystem", "projectId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "value", "description", "icon", "color", "isSystem", "projectId" FROM "temporary_status"`);
        await queryRunner.query(`DROP TABLE "temporary_status"`);
        await queryRunner.query(`CREATE INDEX "IDX_14c9897451c5ecc91211a2e873" ON "status" ("projectId") `);
        await queryRunner.query(`CREATE INDEX "IDX_6a043d4088c6303d62b4c6edf8" ON "status" ("value") `);
        await queryRunner.query(`CREATE INDEX "IDX_95ff138b88fdd8a7c9ebdb97a3" ON "status" ("name") `);
        await queryRunner.query(`CREATE INDEX "IDX_843edbaab7b6aac6037d50319c" ON "status" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_4e523a8b0628d467316dcbd45f" ON "status" ("tenantId") `);
        await queryRunner.query(`DROP INDEX "IDX_14c9897451c5ecc91211a2e873"`);
        await queryRunner.query(`DROP INDEX "IDX_6a043d4088c6303d62b4c6edf8"`);
        await queryRunner.query(`DROP INDEX "IDX_95ff138b88fdd8a7c9ebdb97a3"`);
        await queryRunner.query(`DROP INDEX "IDX_843edbaab7b6aac6037d50319c"`);
        await queryRunner.query(`DROP INDEX "IDX_4e523a8b0628d467316dcbd45f"`);
        await queryRunner.query(`DROP TABLE "status"`);
    }
}
