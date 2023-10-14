
import { MigrationInterface, QueryRunner } from "typeorm";
import * as chalk from 'chalk';

export class AlterIntegrationTenantTable1692433732267 implements MigrationInterface {

    name = 'AlterIntegrationTenantTable1692433732267';

    /**
    * Up Migration
    *
    * @param queryRunner
    */
    public async up(queryRunner: QueryRunner): Promise<any> {
        console.log(chalk.yellow(`AlterIntegrationTenantTable1692433732267 start running!`));

        if (['sqlite', 'better-sqlite3'].includes(queryRunner.connection.options.type)) {
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
        if (['sqlite', 'better-sqlite3'].includes(queryRunner.connection.options.type)) {
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
        await queryRunner.query(`ALTER TABLE "integration_tenant" ADD "integrationId" uuid`);
        await queryRunner.query(`CREATE INDEX "IDX_0d6ddc27d687ca879042c5f3ce" ON "integration_tenant" ("integrationId") `);
        await queryRunner.query(`ALTER TABLE "integration_tenant" ADD CONSTRAINT "FK_0d6ddc27d687ca879042c5f3ce3" FOREIGN KEY ("integrationId") REFERENCES "integration"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "integration_tenant" DROP CONSTRAINT "FK_0d6ddc27d687ca879042c5f3ce3"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0d6ddc27d687ca879042c5f3ce"`);
        await queryRunner.query(`ALTER TABLE "integration_tenant" DROP COLUMN "integrationId"`);
    }

    /**
    * SqliteDB Up Migration
    *
    * @param queryRunner
    */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_33ab224e7755a46fff5bc1e64e"`);
        await queryRunner.query(`DROP INDEX "IDX_24e37d03ef224f1a16a35069c2"`);
        await queryRunner.query(`CREATE TABLE "temporary_integration_tenant" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "integrationId" varchar, CONSTRAINT "FK_33ab224e7755a46fff5bc1e64e5" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_24e37d03ef224f1a16a35069c2c" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_integration_tenant"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name" FROM "integration_tenant"`);
        await queryRunner.query(`DROP TABLE "integration_tenant"`);
        await queryRunner.query(`ALTER TABLE "temporary_integration_tenant" RENAME TO "integration_tenant"`);
        await queryRunner.query(`CREATE INDEX "IDX_33ab224e7755a46fff5bc1e64e" ON "integration_tenant" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_24e37d03ef224f1a16a35069c2" ON "integration_tenant" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_0d6ddc27d687ca879042c5f3ce" ON "integration_tenant" ("integrationId") `);
        await queryRunner.query(`DROP INDEX "IDX_33ab224e7755a46fff5bc1e64e"`);
        await queryRunner.query(`DROP INDEX "IDX_24e37d03ef224f1a16a35069c2"`);
        await queryRunner.query(`DROP INDEX "IDX_0d6ddc27d687ca879042c5f3ce"`);
        await queryRunner.query(`CREATE TABLE "temporary_integration_tenant" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "integrationId" varchar, CONSTRAINT "FK_33ab224e7755a46fff5bc1e64e5" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_24e37d03ef224f1a16a35069c2c" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_0d6ddc27d687ca879042c5f3ce3" FOREIGN KEY ("integrationId") REFERENCES "integration" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_integration_tenant"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "integrationId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "integrationId" FROM "integration_tenant"`);
        await queryRunner.query(`DROP TABLE "integration_tenant"`);
        await queryRunner.query(`ALTER TABLE "temporary_integration_tenant" RENAME TO "integration_tenant"`);
        await queryRunner.query(`CREATE INDEX "IDX_33ab224e7755a46fff5bc1e64e" ON "integration_tenant" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_24e37d03ef224f1a16a35069c2" ON "integration_tenant" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_0d6ddc27d687ca879042c5f3ce" ON "integration_tenant" ("integrationId") `);
    }

    /**
    * SqliteDB Down Migration
    *
    * @param queryRunner
    */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_0d6ddc27d687ca879042c5f3ce"`);
        await queryRunner.query(`DROP INDEX "IDX_24e37d03ef224f1a16a35069c2"`);
        await queryRunner.query(`DROP INDEX "IDX_33ab224e7755a46fff5bc1e64e"`);
        await queryRunner.query(`ALTER TABLE "integration_tenant" RENAME TO "temporary_integration_tenant"`);
        await queryRunner.query(`CREATE TABLE "integration_tenant" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "integrationId" varchar, CONSTRAINT "FK_33ab224e7755a46fff5bc1e64e5" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_24e37d03ef224f1a16a35069c2c" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "integration_tenant"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "integrationId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "integrationId" FROM "temporary_integration_tenant"`);
        await queryRunner.query(`DROP TABLE "temporary_integration_tenant"`);
        await queryRunner.query(`CREATE INDEX "IDX_0d6ddc27d687ca879042c5f3ce" ON "integration_tenant" ("integrationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_24e37d03ef224f1a16a35069c2" ON "integration_tenant" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_33ab224e7755a46fff5bc1e64e" ON "integration_tenant" ("organizationId") `);
        await queryRunner.query(`DROP INDEX "IDX_0d6ddc27d687ca879042c5f3ce"`);
        await queryRunner.query(`DROP INDEX "IDX_24e37d03ef224f1a16a35069c2"`);
        await queryRunner.query(`DROP INDEX "IDX_33ab224e7755a46fff5bc1e64e"`);
        await queryRunner.query(`ALTER TABLE "integration_tenant" RENAME TO "temporary_integration_tenant"`);
        await queryRunner.query(`CREATE TABLE "integration_tenant" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, CONSTRAINT "FK_33ab224e7755a46fff5bc1e64e5" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_24e37d03ef224f1a16a35069c2c" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "integration_tenant"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name" FROM "temporary_integration_tenant"`);
        await queryRunner.query(`DROP TABLE "temporary_integration_tenant"`);
        await queryRunner.query(`CREATE INDEX "IDX_24e37d03ef224f1a16a35069c2" ON "integration_tenant" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_33ab224e7755a46fff5bc1e64e" ON "integration_tenant" ("organizationId") `);
    }
}
