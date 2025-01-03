import { MigrationInterface, QueryRunner } from "typeorm";
import * as chalk from "chalk";
import { DatabaseTypeEnum } from "@gauzy/config";

export class AddDocumentAssetColumnToTheOrganizationDocumentTable1680866279166 implements MigrationInterface {

    name = 'AddDocumentAssetColumnToTheOrganizationDocumentTable1680866279166';

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
        await queryRunner.query(`ALTER TABLE "organization_document" ADD "documentId" uuid`);
        await queryRunner.query(`ALTER TABLE "organization_document" ALTER COLUMN "documentUrl" DROP NOT NULL`);
        await queryRunner.query(`CREATE INDEX "IDX_c129dee7d1cb84e01e69b5e2c6" ON "organization_document" ("documentId") `);
        await queryRunner.query(`ALTER TABLE "organization_document" ADD CONSTRAINT "FK_c129dee7d1cb84e01e69b5e2c66" FOREIGN KEY ("documentId") REFERENCES "image_asset"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "organization_document" DROP CONSTRAINT "FK_c129dee7d1cb84e01e69b5e2c66"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c129dee7d1cb84e01e69b5e2c6"`);
        await queryRunner.query(`ALTER TABLE "organization_document" ALTER COLUMN "documentUrl" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "organization_document" DROP COLUMN "documentId"`);
    }

    /**
    * SqliteDB Up Migration
    *
    * @param queryRunner
    */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_1057ec001a4c6b258658143047"`);
        await queryRunner.query(`DROP INDEX "IDX_4bc83945c022a862a33629ff1e"`);
        await queryRunner.query(`CREATE TABLE "temporary_organization_document" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "documentUrl" varchar NOT NULL, "documentId" varchar, CONSTRAINT "FK_1057ec001a4c6b258658143047a" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_4bc83945c022a862a33629ff1e1" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_organization_document"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "documentUrl") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "documentUrl" FROM "organization_document"`);
        await queryRunner.query(`DROP TABLE "organization_document"`);
        await queryRunner.query(`ALTER TABLE "temporary_organization_document" RENAME TO "organization_document"`);
        await queryRunner.query(`CREATE INDEX "IDX_1057ec001a4c6b258658143047" ON "organization_document" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_4bc83945c022a862a33629ff1e" ON "organization_document" ("tenantId") `);
        await queryRunner.query(`DROP INDEX "IDX_1057ec001a4c6b258658143047"`);
        await queryRunner.query(`DROP INDEX "IDX_4bc83945c022a862a33629ff1e"`);
        await queryRunner.query(`CREATE TABLE "temporary_organization_document" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "documentUrl" varchar, "documentId" varchar, CONSTRAINT "FK_1057ec001a4c6b258658143047a" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_4bc83945c022a862a33629ff1e1" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_organization_document"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "documentUrl", "documentId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "documentUrl", "documentId" FROM "organization_document"`);
        await queryRunner.query(`DROP TABLE "organization_document"`);
        await queryRunner.query(`ALTER TABLE "temporary_organization_document" RENAME TO "organization_document"`);
        await queryRunner.query(`CREATE INDEX "IDX_1057ec001a4c6b258658143047" ON "organization_document" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_4bc83945c022a862a33629ff1e" ON "organization_document" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_c129dee7d1cb84e01e69b5e2c6" ON "organization_document" ("documentId") `);
        await queryRunner.query(`DROP INDEX "IDX_1057ec001a4c6b258658143047"`);
        await queryRunner.query(`DROP INDEX "IDX_4bc83945c022a862a33629ff1e"`);
        await queryRunner.query(`DROP INDEX "IDX_c129dee7d1cb84e01e69b5e2c6"`);
        await queryRunner.query(`CREATE TABLE "temporary_organization_document" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "documentUrl" varchar, "documentId" varchar, CONSTRAINT "FK_1057ec001a4c6b258658143047a" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_4bc83945c022a862a33629ff1e1" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_c129dee7d1cb84e01e69b5e2c66" FOREIGN KEY ("documentId") REFERENCES "image_asset" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_organization_document"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "documentUrl", "documentId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "documentUrl", "documentId" FROM "organization_document"`);
        await queryRunner.query(`DROP TABLE "organization_document"`);
        await queryRunner.query(`ALTER TABLE "temporary_organization_document" RENAME TO "organization_document"`);
        await queryRunner.query(`CREATE INDEX "IDX_1057ec001a4c6b258658143047" ON "organization_document" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_4bc83945c022a862a33629ff1e" ON "organization_document" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_c129dee7d1cb84e01e69b5e2c6" ON "organization_document" ("documentId") `);
    }

    /**
    * SqliteDB Down Migration
    *
    * @param queryRunner
    */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_c129dee7d1cb84e01e69b5e2c6"`);
        await queryRunner.query(`DROP INDEX "IDX_4bc83945c022a862a33629ff1e"`);
        await queryRunner.query(`DROP INDEX "IDX_1057ec001a4c6b258658143047"`);
        await queryRunner.query(`ALTER TABLE "organization_document" RENAME TO "temporary_organization_document"`);
        await queryRunner.query(`CREATE TABLE "organization_document" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "documentUrl" varchar, "documentId" varchar, CONSTRAINT "FK_1057ec001a4c6b258658143047a" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_4bc83945c022a862a33629ff1e1" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "organization_document"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "documentUrl", "documentId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "documentUrl", "documentId" FROM "temporary_organization_document"`);
        await queryRunner.query(`DROP TABLE "temporary_organization_document"`);
        await queryRunner.query(`CREATE INDEX "IDX_c129dee7d1cb84e01e69b5e2c6" ON "organization_document" ("documentId") `);
        await queryRunner.query(`CREATE INDEX "IDX_4bc83945c022a862a33629ff1e" ON "organization_document" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_1057ec001a4c6b258658143047" ON "organization_document" ("organizationId") `);
        await queryRunner.query(`DROP INDEX "IDX_c129dee7d1cb84e01e69b5e2c6"`);
        await queryRunner.query(`DROP INDEX "IDX_4bc83945c022a862a33629ff1e"`);
        await queryRunner.query(`DROP INDEX "IDX_1057ec001a4c6b258658143047"`);
        await queryRunner.query(`ALTER TABLE "organization_document" RENAME TO "temporary_organization_document"`);
        await queryRunner.query(`CREATE TABLE "organization_document" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "documentUrl" varchar NOT NULL, "documentId" varchar, CONSTRAINT "FK_1057ec001a4c6b258658143047a" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_4bc83945c022a862a33629ff1e1" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "organization_document"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "documentUrl", "documentId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "documentUrl", "documentId" FROM "temporary_organization_document"`);
        await queryRunner.query(`DROP TABLE "temporary_organization_document"`);
        await queryRunner.query(`CREATE INDEX "IDX_4bc83945c022a862a33629ff1e" ON "organization_document" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_1057ec001a4c6b258658143047" ON "organization_document" ("organizationId") `);
        await queryRunner.query(`DROP INDEX "IDX_4bc83945c022a862a33629ff1e"`);
        await queryRunner.query(`DROP INDEX "IDX_1057ec001a4c6b258658143047"`);
        await queryRunner.query(`ALTER TABLE "organization_document" RENAME TO "temporary_organization_document"`);
        await queryRunner.query(`CREATE TABLE "organization_document" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "documentUrl" varchar NOT NULL, CONSTRAINT "FK_1057ec001a4c6b258658143047a" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_4bc83945c022a862a33629ff1e1" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "organization_document"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "documentUrl") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "documentUrl" FROM "temporary_organization_document"`);
        await queryRunner.query(`DROP TABLE "temporary_organization_document"`);
        await queryRunner.query(`CREATE INDEX "IDX_4bc83945c022a862a33629ff1e" ON "organization_document" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_1057ec001a4c6b258658143047" ON "organization_document" ("organizationId") `);
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
