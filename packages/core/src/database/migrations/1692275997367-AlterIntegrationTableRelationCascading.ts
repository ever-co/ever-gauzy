import { MigrationInterface, QueryRunner } from "typeorm";
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from "@gauzy/config";

export class AlterIntegrationTableRelationCascading1692275997367 implements MigrationInterface {

    name = 'AlterIntegrationTableRelationCascading1692275997367';

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
        await queryRunner.query(`ALTER TABLE "integration_entity_setting_tied" DROP CONSTRAINT "FK_3fb863167095805e33f38a0fdcc"`);
        await queryRunner.query(`ALTER TABLE "integration_entity_setting" DROP CONSTRAINT "FK_f80ff4ebbf0b33a67dce5989117"`);
        await queryRunner.query(`ALTER TABLE "integration_map" DROP CONSTRAINT "FK_c327ea26bda3d349a1eceb5658e"`);
        await queryRunner.query(`ALTER TABLE "integration_integration_type" DROP CONSTRAINT "FK_8dd2062499a6c2a708ddd05650e"`);
        await queryRunner.query(`ALTER TABLE "integration_map" DROP COLUMN "sourceId"`);
        await queryRunner.query(`ALTER TABLE "integration_map" ADD "sourceId" character varying NOT NULL`);
        await queryRunner.query(`ALTER TABLE "integration_entity_setting_tied" ADD CONSTRAINT "FK_3fb863167095805e33f38a0fdcc" FOREIGN KEY ("integrationEntitySettingId") REFERENCES "integration_entity_setting"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "integration_entity_setting" ADD CONSTRAINT "FK_f80ff4ebbf0b33a67dce5989117" FOREIGN KEY ("integrationId") REFERENCES "integration_tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "integration_map" ADD CONSTRAINT "FK_c327ea26bda3d349a1eceb5658e" FOREIGN KEY ("integrationId") REFERENCES "integration_tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "integration_integration_type" ADD CONSTRAINT "FK_8dd2062499a6c2a708ddd05650e" FOREIGN KEY ("integrationTypeId") REFERENCES "integration_type"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "integration_integration_type" DROP CONSTRAINT "FK_8dd2062499a6c2a708ddd05650e"`);
        await queryRunner.query(`ALTER TABLE "integration_map" DROP CONSTRAINT "FK_c327ea26bda3d349a1eceb5658e"`);
        await queryRunner.query(`ALTER TABLE "integration_entity_setting" DROP CONSTRAINT "FK_f80ff4ebbf0b33a67dce5989117"`);
        await queryRunner.query(`ALTER TABLE "integration_entity_setting_tied" DROP CONSTRAINT "FK_3fb863167095805e33f38a0fdcc"`);
        await queryRunner.query(`ALTER TABLE "integration_map" DROP COLUMN "sourceId"`);
        await queryRunner.query(`ALTER TABLE "integration_map" ADD "sourceId" bigint NOT NULL`);
        await queryRunner.query(`ALTER TABLE "integration_integration_type" ADD CONSTRAINT "FK_8dd2062499a6c2a708ddd05650e" FOREIGN KEY ("integrationTypeId") REFERENCES "integration_type"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "integration_map" ADD CONSTRAINT "FK_c327ea26bda3d349a1eceb5658e" FOREIGN KEY ("integrationId") REFERENCES "integration_tenant"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "integration_entity_setting" ADD CONSTRAINT "FK_f80ff4ebbf0b33a67dce5989117" FOREIGN KEY ("integrationId") REFERENCES "integration_tenant"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "integration_entity_setting_tied" ADD CONSTRAINT "FK_3fb863167095805e33f38a0fdcc" FOREIGN KEY ("integrationEntitySettingId") REFERENCES "integration_entity_setting"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    /**
    * SqliteDB Up Migration
    *
    * @param queryRunner
    */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_3fb863167095805e33f38a0fdc"`);
        await queryRunner.query(`DROP INDEX "IDX_d5ac36aa3d5919908414154fca"`);
        await queryRunner.query(`DROP INDEX "IDX_b208a754c7a538cb3422f39f5b"`);
        await queryRunner.query(`CREATE TABLE "temporary_integration_entity_setting_tied" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "entity" varchar NOT NULL, "sync" boolean NOT NULL, "integrationEntitySettingId" varchar, CONSTRAINT "FK_d5ac36aa3d5919908414154fca0" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_b208a754c7a538cb3422f39f5b9" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_integration_entity_setting_tied"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "entity", "sync", "integrationEntitySettingId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "entity", "sync", "integrationEntitySettingId" FROM "integration_entity_setting_tied"`);
        await queryRunner.query(`DROP TABLE "integration_entity_setting_tied"`);
        await queryRunner.query(`ALTER TABLE "temporary_integration_entity_setting_tied" RENAME TO "integration_entity_setting_tied"`);
        await queryRunner.query(`CREATE INDEX "IDX_3fb863167095805e33f38a0fdc" ON "integration_entity_setting_tied" ("integrationEntitySettingId") `);
        await queryRunner.query(`CREATE INDEX "IDX_d5ac36aa3d5919908414154fca" ON "integration_entity_setting_tied" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_b208a754c7a538cb3422f39f5b" ON "integration_entity_setting_tied" ("tenantId") `);
        await queryRunner.query(`DROP INDEX "IDX_f80ff4ebbf0b33a67dce598911"`);
        await queryRunner.query(`DROP INDEX "IDX_c6c01e38eebd8b26b9214b9044"`);
        await queryRunner.query(`DROP INDEX "IDX_23e9cfcf1bfff07dcc3254378d"`);
        await queryRunner.query(`CREATE TABLE "temporary_integration_entity_setting" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "entity" varchar NOT NULL, "sync" boolean NOT NULL, "integrationId" varchar NOT NULL, CONSTRAINT "FK_c6c01e38eebd8b26b9214b90441" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_23e9cfcf1bfff07dcc3254378df" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_integration_entity_setting"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "entity", "sync", "integrationId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "entity", "sync", "integrationId" FROM "integration_entity_setting"`);
        await queryRunner.query(`DROP TABLE "integration_entity_setting"`);
        await queryRunner.query(`ALTER TABLE "temporary_integration_entity_setting" RENAME TO "integration_entity_setting"`);
        await queryRunner.query(`CREATE INDEX "IDX_f80ff4ebbf0b33a67dce598911" ON "integration_entity_setting" ("integrationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_c6c01e38eebd8b26b9214b9044" ON "integration_entity_setting" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_23e9cfcf1bfff07dcc3254378d" ON "integration_entity_setting" ("tenantId") `);
        await queryRunner.query(`DROP INDEX "IDX_c327ea26bda3d349a1eceb5658"`);
        await queryRunner.query(`DROP INDEX "IDX_7022dafd72c1b92f7d50691441"`);
        await queryRunner.query(`DROP INDEX "IDX_eec3d6064578610ddc609dd360"`);
        await queryRunner.query(`CREATE TABLE "temporary_integration_map" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "entity" varchar NOT NULL, "sourceId" bigint NOT NULL, "gauzyId" varchar NOT NULL, "integrationId" varchar NOT NULL, CONSTRAINT "FK_7022dafd72c1b92f7d506914411" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_eec3d6064578610ddc609dd360e" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_integration_map"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "entity", "sourceId", "gauzyId", "integrationId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "entity", "sourceId", "gauzyId", "integrationId" FROM "integration_map"`);
        await queryRunner.query(`DROP TABLE "integration_map"`);
        await queryRunner.query(`ALTER TABLE "temporary_integration_map" RENAME TO "integration_map"`);
        await queryRunner.query(`CREATE INDEX "IDX_c327ea26bda3d349a1eceb5658" ON "integration_map" ("integrationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_7022dafd72c1b92f7d50691441" ON "integration_map" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_eec3d6064578610ddc609dd360" ON "integration_map" ("tenantId") `);
        await queryRunner.query(`DROP INDEX "IDX_8dd2062499a6c2a708ddd05650"`);
        await queryRunner.query(`DROP INDEX "IDX_34c86921ee9b462bc5c7b61fad"`);
        await queryRunner.query(`CREATE TABLE "temporary_integration_integration_type" ("integrationId" varchar NOT NULL, "integrationTypeId" varchar NOT NULL, CONSTRAINT "FK_34c86921ee9b462bc5c7b61fad4" FOREIGN KEY ("integrationId") REFERENCES "integration" ("id") ON DELETE CASCADE ON UPDATE CASCADE, PRIMARY KEY ("integrationId", "integrationTypeId"))`);
        await queryRunner.query(`INSERT INTO "temporary_integration_integration_type"("integrationId", "integrationTypeId") SELECT "integrationId", "integrationTypeId" FROM "integration_integration_type"`);
        await queryRunner.query(`DROP TABLE "integration_integration_type"`);
        await queryRunner.query(`ALTER TABLE "temporary_integration_integration_type" RENAME TO "integration_integration_type"`);
        await queryRunner.query(`CREATE INDEX "IDX_8dd2062499a6c2a708ddd05650" ON "integration_integration_type" ("integrationTypeId") `);
        await queryRunner.query(`CREATE INDEX "IDX_34c86921ee9b462bc5c7b61fad" ON "integration_integration_type" ("integrationId") `);
        await queryRunner.query(`DROP INDEX "IDX_c327ea26bda3d349a1eceb5658"`);
        await queryRunner.query(`DROP INDEX "IDX_7022dafd72c1b92f7d50691441"`);
        await queryRunner.query(`DROP INDEX "IDX_eec3d6064578610ddc609dd360"`);
        await queryRunner.query(`CREATE TABLE "temporary_integration_map" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "entity" varchar NOT NULL, "sourceId" bigint NOT NULL, "gauzyId" varchar NOT NULL, "integrationId" varchar NOT NULL, CONSTRAINT "FK_7022dafd72c1b92f7d506914411" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_eec3d6064578610ddc609dd360e" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_integration_map"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "entity", "sourceId", "gauzyId", "integrationId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "entity", "sourceId", "gauzyId", "integrationId" FROM "integration_map"`);
        await queryRunner.query(`DROP TABLE "integration_map"`);
        await queryRunner.query(`ALTER TABLE "temporary_integration_map" RENAME TO "integration_map"`);
        await queryRunner.query(`CREATE INDEX "IDX_c327ea26bda3d349a1eceb5658" ON "integration_map" ("integrationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_7022dafd72c1b92f7d50691441" ON "integration_map" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_eec3d6064578610ddc609dd360" ON "integration_map" ("tenantId") `);
        await queryRunner.query(`DROP INDEX "IDX_c327ea26bda3d349a1eceb5658"`);
        await queryRunner.query(`DROP INDEX "IDX_7022dafd72c1b92f7d50691441"`);
        await queryRunner.query(`DROP INDEX "IDX_eec3d6064578610ddc609dd360"`);
        await queryRunner.query(`CREATE TABLE "temporary_integration_map" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "entity" varchar NOT NULL, "sourceId" varchar NOT NULL, "gauzyId" varchar NOT NULL, "integrationId" varchar NOT NULL, CONSTRAINT "FK_7022dafd72c1b92f7d506914411" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_eec3d6064578610ddc609dd360e" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_integration_map"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "entity", "sourceId", "gauzyId", "integrationId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "entity", "sourceId", "gauzyId", "integrationId" FROM "integration_map"`);
        await queryRunner.query(`DROP TABLE "integration_map"`);
        await queryRunner.query(`ALTER TABLE "temporary_integration_map" RENAME TO "integration_map"`);
        await queryRunner.query(`CREATE INDEX "IDX_c327ea26bda3d349a1eceb5658" ON "integration_map" ("integrationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_7022dafd72c1b92f7d50691441" ON "integration_map" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_eec3d6064578610ddc609dd360" ON "integration_map" ("tenantId") `);
        await queryRunner.query(`DROP INDEX "IDX_3fb863167095805e33f38a0fdc"`);
        await queryRunner.query(`DROP INDEX "IDX_d5ac36aa3d5919908414154fca"`);
        await queryRunner.query(`DROP INDEX "IDX_b208a754c7a538cb3422f39f5b"`);
        await queryRunner.query(`CREATE TABLE "temporary_integration_entity_setting_tied" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "entity" varchar NOT NULL, "sync" boolean NOT NULL, "integrationEntitySettingId" varchar, CONSTRAINT "FK_d5ac36aa3d5919908414154fca0" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_b208a754c7a538cb3422f39f5b9" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_3fb863167095805e33f38a0fdcc" FOREIGN KEY ("integrationEntitySettingId") REFERENCES "integration_entity_setting" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_integration_entity_setting_tied"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "entity", "sync", "integrationEntitySettingId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "entity", "sync", "integrationEntitySettingId" FROM "integration_entity_setting_tied"`);
        await queryRunner.query(`DROP TABLE "integration_entity_setting_tied"`);
        await queryRunner.query(`ALTER TABLE "temporary_integration_entity_setting_tied" RENAME TO "integration_entity_setting_tied"`);
        await queryRunner.query(`CREATE INDEX "IDX_3fb863167095805e33f38a0fdc" ON "integration_entity_setting_tied" ("integrationEntitySettingId") `);
        await queryRunner.query(`CREATE INDEX "IDX_d5ac36aa3d5919908414154fca" ON "integration_entity_setting_tied" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_b208a754c7a538cb3422f39f5b" ON "integration_entity_setting_tied" ("tenantId") `);
        await queryRunner.query(`DROP INDEX "IDX_f80ff4ebbf0b33a67dce598911"`);
        await queryRunner.query(`DROP INDEX "IDX_c6c01e38eebd8b26b9214b9044"`);
        await queryRunner.query(`DROP INDEX "IDX_23e9cfcf1bfff07dcc3254378d"`);
        await queryRunner.query(`CREATE TABLE "temporary_integration_entity_setting" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "entity" varchar NOT NULL, "sync" boolean NOT NULL, "integrationId" varchar NOT NULL, CONSTRAINT "FK_c6c01e38eebd8b26b9214b90441" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_23e9cfcf1bfff07dcc3254378df" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_f80ff4ebbf0b33a67dce5989117" FOREIGN KEY ("integrationId") REFERENCES "integration_tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_integration_entity_setting"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "entity", "sync", "integrationId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "entity", "sync", "integrationId" FROM "integration_entity_setting"`);
        await queryRunner.query(`DROP TABLE "integration_entity_setting"`);
        await queryRunner.query(`ALTER TABLE "temporary_integration_entity_setting" RENAME TO "integration_entity_setting"`);
        await queryRunner.query(`CREATE INDEX "IDX_f80ff4ebbf0b33a67dce598911" ON "integration_entity_setting" ("integrationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_c6c01e38eebd8b26b9214b9044" ON "integration_entity_setting" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_23e9cfcf1bfff07dcc3254378d" ON "integration_entity_setting" ("tenantId") `);
        await queryRunner.query(`DROP INDEX "IDX_c327ea26bda3d349a1eceb5658"`);
        await queryRunner.query(`DROP INDEX "IDX_7022dafd72c1b92f7d50691441"`);
        await queryRunner.query(`DROP INDEX "IDX_eec3d6064578610ddc609dd360"`);
        await queryRunner.query(`CREATE TABLE "temporary_integration_map" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "entity" varchar NOT NULL, "sourceId" varchar NOT NULL, "gauzyId" varchar NOT NULL, "integrationId" varchar NOT NULL, CONSTRAINT "FK_7022dafd72c1b92f7d506914411" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_eec3d6064578610ddc609dd360e" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_c327ea26bda3d349a1eceb5658e" FOREIGN KEY ("integrationId") REFERENCES "integration_tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_integration_map"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "entity", "sourceId", "gauzyId", "integrationId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "entity", "sourceId", "gauzyId", "integrationId" FROM "integration_map"`);
        await queryRunner.query(`DROP TABLE "integration_map"`);
        await queryRunner.query(`ALTER TABLE "temporary_integration_map" RENAME TO "integration_map"`);
        await queryRunner.query(`CREATE INDEX "IDX_c327ea26bda3d349a1eceb5658" ON "integration_map" ("integrationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_7022dafd72c1b92f7d50691441" ON "integration_map" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_eec3d6064578610ddc609dd360" ON "integration_map" ("tenantId") `);
        await queryRunner.query(`DROP INDEX "IDX_8dd2062499a6c2a708ddd05650"`);
        await queryRunner.query(`DROP INDEX "IDX_34c86921ee9b462bc5c7b61fad"`);
        await queryRunner.query(`CREATE TABLE "temporary_integration_integration_type" ("integrationId" varchar NOT NULL, "integrationTypeId" varchar NOT NULL, CONSTRAINT "FK_34c86921ee9b462bc5c7b61fad4" FOREIGN KEY ("integrationId") REFERENCES "integration" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_8dd2062499a6c2a708ddd05650e" FOREIGN KEY ("integrationTypeId") REFERENCES "integration_type" ("id") ON DELETE CASCADE ON UPDATE CASCADE, PRIMARY KEY ("integrationId", "integrationTypeId"))`);
        await queryRunner.query(`INSERT INTO "temporary_integration_integration_type"("integrationId", "integrationTypeId") SELECT "integrationId", "integrationTypeId" FROM "integration_integration_type"`);
        await queryRunner.query(`DROP TABLE "integration_integration_type"`);
        await queryRunner.query(`ALTER TABLE "temporary_integration_integration_type" RENAME TO "integration_integration_type"`);
        await queryRunner.query(`CREATE INDEX "IDX_8dd2062499a6c2a708ddd05650" ON "integration_integration_type" ("integrationTypeId") `);
        await queryRunner.query(`CREATE INDEX "IDX_34c86921ee9b462bc5c7b61fad" ON "integration_integration_type" ("integrationId") `);
    }

    /**
    * SqliteDB Down Migration
    *
    * @param queryRunner
    */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_34c86921ee9b462bc5c7b61fad"`);
        await queryRunner.query(`DROP INDEX "IDX_8dd2062499a6c2a708ddd05650"`);
        await queryRunner.query(`ALTER TABLE "integration_integration_type" RENAME TO "temporary_integration_integration_type"`);
        await queryRunner.query(`CREATE TABLE "integration_integration_type" ("integrationId" varchar NOT NULL, "integrationTypeId" varchar NOT NULL, CONSTRAINT "FK_34c86921ee9b462bc5c7b61fad4" FOREIGN KEY ("integrationId") REFERENCES "integration" ("id") ON DELETE CASCADE ON UPDATE CASCADE, PRIMARY KEY ("integrationId", "integrationTypeId"))`);
        await queryRunner.query(`INSERT INTO "integration_integration_type"("integrationId", "integrationTypeId") SELECT "integrationId", "integrationTypeId" FROM "temporary_integration_integration_type"`);
        await queryRunner.query(`DROP TABLE "temporary_integration_integration_type"`);
        await queryRunner.query(`CREATE INDEX "IDX_34c86921ee9b462bc5c7b61fad" ON "integration_integration_type" ("integrationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_8dd2062499a6c2a708ddd05650" ON "integration_integration_type" ("integrationTypeId") `);
        await queryRunner.query(`DROP INDEX "IDX_eec3d6064578610ddc609dd360"`);
        await queryRunner.query(`DROP INDEX "IDX_7022dafd72c1b92f7d50691441"`);
        await queryRunner.query(`DROP INDEX "IDX_c327ea26bda3d349a1eceb5658"`);
        await queryRunner.query(`ALTER TABLE "integration_map" RENAME TO "temporary_integration_map"`);
        await queryRunner.query(`CREATE TABLE "integration_map" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "entity" varchar NOT NULL, "sourceId" varchar NOT NULL, "gauzyId" varchar NOT NULL, "integrationId" varchar NOT NULL, CONSTRAINT "FK_7022dafd72c1b92f7d506914411" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_eec3d6064578610ddc609dd360e" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "integration_map"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "entity", "sourceId", "gauzyId", "integrationId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "entity", "sourceId", "gauzyId", "integrationId" FROM "temporary_integration_map"`);
        await queryRunner.query(`DROP TABLE "temporary_integration_map"`);
        await queryRunner.query(`CREATE INDEX "IDX_eec3d6064578610ddc609dd360" ON "integration_map" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_7022dafd72c1b92f7d50691441" ON "integration_map" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_c327ea26bda3d349a1eceb5658" ON "integration_map" ("integrationId") `);
        await queryRunner.query(`DROP INDEX "IDX_23e9cfcf1bfff07dcc3254378d"`);
        await queryRunner.query(`DROP INDEX "IDX_c6c01e38eebd8b26b9214b9044"`);
        await queryRunner.query(`DROP INDEX "IDX_f80ff4ebbf0b33a67dce598911"`);
        await queryRunner.query(`ALTER TABLE "integration_entity_setting" RENAME TO "temporary_integration_entity_setting"`);
        await queryRunner.query(`CREATE TABLE "integration_entity_setting" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "entity" varchar NOT NULL, "sync" boolean NOT NULL, "integrationId" varchar NOT NULL, CONSTRAINT "FK_c6c01e38eebd8b26b9214b90441" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_23e9cfcf1bfff07dcc3254378df" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "integration_entity_setting"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "entity", "sync", "integrationId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "entity", "sync", "integrationId" FROM "temporary_integration_entity_setting"`);
        await queryRunner.query(`DROP TABLE "temporary_integration_entity_setting"`);
        await queryRunner.query(`CREATE INDEX "IDX_23e9cfcf1bfff07dcc3254378d" ON "integration_entity_setting" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_c6c01e38eebd8b26b9214b9044" ON "integration_entity_setting" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_f80ff4ebbf0b33a67dce598911" ON "integration_entity_setting" ("integrationId") `);
        await queryRunner.query(`DROP INDEX "IDX_b208a754c7a538cb3422f39f5b"`);
        await queryRunner.query(`DROP INDEX "IDX_d5ac36aa3d5919908414154fca"`);
        await queryRunner.query(`DROP INDEX "IDX_3fb863167095805e33f38a0fdc"`);
        await queryRunner.query(`ALTER TABLE "integration_entity_setting_tied" RENAME TO "temporary_integration_entity_setting_tied"`);
        await queryRunner.query(`CREATE TABLE "integration_entity_setting_tied" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "entity" varchar NOT NULL, "sync" boolean NOT NULL, "integrationEntitySettingId" varchar, CONSTRAINT "FK_d5ac36aa3d5919908414154fca0" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_b208a754c7a538cb3422f39f5b9" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "integration_entity_setting_tied"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "entity", "sync", "integrationEntitySettingId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "entity", "sync", "integrationEntitySettingId" FROM "temporary_integration_entity_setting_tied"`);
        await queryRunner.query(`DROP TABLE "temporary_integration_entity_setting_tied"`);
        await queryRunner.query(`CREATE INDEX "IDX_b208a754c7a538cb3422f39f5b" ON "integration_entity_setting_tied" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_d5ac36aa3d5919908414154fca" ON "integration_entity_setting_tied" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_3fb863167095805e33f38a0fdc" ON "integration_entity_setting_tied" ("integrationEntitySettingId") `);
        await queryRunner.query(`DROP INDEX "IDX_eec3d6064578610ddc609dd360"`);
        await queryRunner.query(`DROP INDEX "IDX_7022dafd72c1b92f7d50691441"`);
        await queryRunner.query(`DROP INDEX "IDX_c327ea26bda3d349a1eceb5658"`);
        await queryRunner.query(`ALTER TABLE "integration_map" RENAME TO "temporary_integration_map"`);
        await queryRunner.query(`CREATE TABLE "integration_map" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "entity" varchar NOT NULL, "sourceId" bigint NOT NULL, "gauzyId" varchar NOT NULL, "integrationId" varchar NOT NULL, CONSTRAINT "FK_7022dafd72c1b92f7d506914411" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_eec3d6064578610ddc609dd360e" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "integration_map"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "entity", "sourceId", "gauzyId", "integrationId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "entity", "sourceId", "gauzyId", "integrationId" FROM "temporary_integration_map"`);
        await queryRunner.query(`DROP TABLE "temporary_integration_map"`);
        await queryRunner.query(`CREATE INDEX "IDX_eec3d6064578610ddc609dd360" ON "integration_map" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_7022dafd72c1b92f7d50691441" ON "integration_map" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_c327ea26bda3d349a1eceb5658" ON "integration_map" ("integrationId") `);
        await queryRunner.query(`DROP INDEX "IDX_eec3d6064578610ddc609dd360"`);
        await queryRunner.query(`DROP INDEX "IDX_7022dafd72c1b92f7d50691441"`);
        await queryRunner.query(`DROP INDEX "IDX_c327ea26bda3d349a1eceb5658"`);
        await queryRunner.query(`ALTER TABLE "integration_map" RENAME TO "temporary_integration_map"`);
        await queryRunner.query(`CREATE TABLE "integration_map" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "entity" varchar NOT NULL, "sourceId" bigint NOT NULL, "gauzyId" varchar NOT NULL, "integrationId" varchar NOT NULL, CONSTRAINT "FK_7022dafd72c1b92f7d506914411" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_eec3d6064578610ddc609dd360e" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "integration_map"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "entity", "sourceId", "gauzyId", "integrationId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "entity", "sourceId", "gauzyId", "integrationId" FROM "temporary_integration_map"`);
        await queryRunner.query(`DROP TABLE "temporary_integration_map"`);
        await queryRunner.query(`CREATE INDEX "IDX_eec3d6064578610ddc609dd360" ON "integration_map" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_7022dafd72c1b92f7d50691441" ON "integration_map" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_c327ea26bda3d349a1eceb5658" ON "integration_map" ("integrationId") `);
        await queryRunner.query(`DROP INDEX "IDX_34c86921ee9b462bc5c7b61fad"`);
        await queryRunner.query(`DROP INDEX "IDX_8dd2062499a6c2a708ddd05650"`);
        await queryRunner.query(`ALTER TABLE "integration_integration_type" RENAME TO "temporary_integration_integration_type"`);
        await queryRunner.query(`CREATE TABLE "integration_integration_type" ("integrationId" varchar NOT NULL, "integrationTypeId" varchar NOT NULL, CONSTRAINT "FK_8dd2062499a6c2a708ddd05650e" FOREIGN KEY ("integrationTypeId") REFERENCES "integration_type" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION, CONSTRAINT "FK_34c86921ee9b462bc5c7b61fad4" FOREIGN KEY ("integrationId") REFERENCES "integration" ("id") ON DELETE CASCADE ON UPDATE CASCADE, PRIMARY KEY ("integrationId", "integrationTypeId"))`);
        await queryRunner.query(`INSERT INTO "integration_integration_type"("integrationId", "integrationTypeId") SELECT "integrationId", "integrationTypeId" FROM "temporary_integration_integration_type"`);
        await queryRunner.query(`DROP TABLE "temporary_integration_integration_type"`);
        await queryRunner.query(`CREATE INDEX "IDX_34c86921ee9b462bc5c7b61fad" ON "integration_integration_type" ("integrationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_8dd2062499a6c2a708ddd05650" ON "integration_integration_type" ("integrationTypeId") `);
        await queryRunner.query(`DROP INDEX "IDX_eec3d6064578610ddc609dd360"`);
        await queryRunner.query(`DROP INDEX "IDX_7022dafd72c1b92f7d50691441"`);
        await queryRunner.query(`DROP INDEX "IDX_c327ea26bda3d349a1eceb5658"`);
        await queryRunner.query(`ALTER TABLE "integration_map" RENAME TO "temporary_integration_map"`);
        await queryRunner.query(`CREATE TABLE "integration_map" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "entity" varchar NOT NULL, "sourceId" bigint NOT NULL, "gauzyId" varchar NOT NULL, "integrationId" varchar NOT NULL, CONSTRAINT "FK_c327ea26bda3d349a1eceb5658e" FOREIGN KEY ("integrationId") REFERENCES "integration_tenant" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION, CONSTRAINT "FK_7022dafd72c1b92f7d506914411" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_eec3d6064578610ddc609dd360e" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "integration_map"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "entity", "sourceId", "gauzyId", "integrationId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "entity", "sourceId", "gauzyId", "integrationId" FROM "temporary_integration_map"`);
        await queryRunner.query(`DROP TABLE "temporary_integration_map"`);
        await queryRunner.query(`CREATE INDEX "IDX_eec3d6064578610ddc609dd360" ON "integration_map" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_7022dafd72c1b92f7d50691441" ON "integration_map" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_c327ea26bda3d349a1eceb5658" ON "integration_map" ("integrationId") `);
        await queryRunner.query(`DROP INDEX "IDX_23e9cfcf1bfff07dcc3254378d"`);
        await queryRunner.query(`DROP INDEX "IDX_c6c01e38eebd8b26b9214b9044"`);
        await queryRunner.query(`DROP INDEX "IDX_f80ff4ebbf0b33a67dce598911"`);
        await queryRunner.query(`ALTER TABLE "integration_entity_setting" RENAME TO "temporary_integration_entity_setting"`);
        await queryRunner.query(`CREATE TABLE "integration_entity_setting" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "entity" varchar NOT NULL, "sync" boolean NOT NULL, "integrationId" varchar NOT NULL, CONSTRAINT "FK_f80ff4ebbf0b33a67dce5989117" FOREIGN KEY ("integrationId") REFERENCES "integration_tenant" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION, CONSTRAINT "FK_c6c01e38eebd8b26b9214b90441" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_23e9cfcf1bfff07dcc3254378df" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "integration_entity_setting"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "entity", "sync", "integrationId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "entity", "sync", "integrationId" FROM "temporary_integration_entity_setting"`);
        await queryRunner.query(`DROP TABLE "temporary_integration_entity_setting"`);
        await queryRunner.query(`CREATE INDEX "IDX_23e9cfcf1bfff07dcc3254378d" ON "integration_entity_setting" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_c6c01e38eebd8b26b9214b9044" ON "integration_entity_setting" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_f80ff4ebbf0b33a67dce598911" ON "integration_entity_setting" ("integrationId") `);
        await queryRunner.query(`DROP INDEX "IDX_b208a754c7a538cb3422f39f5b"`);
        await queryRunner.query(`DROP INDEX "IDX_d5ac36aa3d5919908414154fca"`);
        await queryRunner.query(`DROP INDEX "IDX_3fb863167095805e33f38a0fdc"`);
        await queryRunner.query(`ALTER TABLE "integration_entity_setting_tied" RENAME TO "temporary_integration_entity_setting_tied"`);
        await queryRunner.query(`CREATE TABLE "integration_entity_setting_tied" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "entity" varchar NOT NULL, "sync" boolean NOT NULL, "integrationEntitySettingId" varchar, CONSTRAINT "FK_3fb863167095805e33f38a0fdcc" FOREIGN KEY ("integrationEntitySettingId") REFERENCES "integration_entity_setting" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION, CONSTRAINT "FK_d5ac36aa3d5919908414154fca0" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_b208a754c7a538cb3422f39f5b9" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "integration_entity_setting_tied"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "entity", "sync", "integrationEntitySettingId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "entity", "sync", "integrationEntitySettingId" FROM "temporary_integration_entity_setting_tied"`);
        await queryRunner.query(`DROP TABLE "temporary_integration_entity_setting_tied"`);
        await queryRunner.query(`CREATE INDEX "IDX_b208a754c7a538cb3422f39f5b" ON "integration_entity_setting_tied" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_d5ac36aa3d5919908414154fca" ON "integration_entity_setting_tied" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_3fb863167095805e33f38a0fdc" ON "integration_entity_setting_tied" ("integrationEntitySettingId") `);
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
