import { MigrationInterface, QueryRunner } from "typeorm";
import * as chalk from "chalk";
import { DatabaseTypeEnum } from "@gauzy/config";

export class AddImageAssetColumnToTheProductCategoryTable1679724221071 implements MigrationInterface {

    name = 'AddImageAssetColumnToTheProductCategoryTable1679724221071';

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
        await queryRunner.query(`ALTER TABLE "product_category" ADD "imageId" uuid`);
        await queryRunner.query(`CREATE INDEX "IDX_f38e86bd280ff9c9c7d9cb7839" ON "product_category" ("imageId") `);
        await queryRunner.query(`ALTER TABLE "product_category" ADD CONSTRAINT "FK_f38e86bd280ff9c9c7d9cb78393" FOREIGN KEY ("imageId") REFERENCES "image_asset"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "product_category" DROP CONSTRAINT "FK_f38e86bd280ff9c9c7d9cb78393"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f38e86bd280ff9c9c7d9cb7839"`);
        await queryRunner.query(`ALTER TABLE "product_category" DROP COLUMN "imageId"`);
    }

    /**
    * SqliteDB Up Migration
    *
    * @param queryRunner
    */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_853302351eaa4daa39920c270a"`);
        await queryRunner.query(`DROP INDEX "IDX_0a0cf25cd8232a154d1cce2641"`);
        await queryRunner.query(`CREATE TABLE "temporary_product_category" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "imageUrl" varchar, "imageId" varchar, CONSTRAINT "FK_853302351eaa4daa39920c270a9" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_0a0cf25cd8232a154d1cce2641c" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_product_category"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "imageUrl") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "imageUrl" FROM "product_category"`);
        await queryRunner.query(`DROP TABLE "product_category"`);
        await queryRunner.query(`ALTER TABLE "temporary_product_category" RENAME TO "product_category"`);
        await queryRunner.query(`CREATE INDEX "IDX_853302351eaa4daa39920c270a" ON "product_category" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_0a0cf25cd8232a154d1cce2641" ON "product_category" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_f38e86bd280ff9c9c7d9cb7839" ON "product_category" ("imageId") `);
        await queryRunner.query(`DROP INDEX "IDX_853302351eaa4daa39920c270a"`);
        await queryRunner.query(`DROP INDEX "IDX_0a0cf25cd8232a154d1cce2641"`);
        await queryRunner.query(`DROP INDEX "IDX_f38e86bd280ff9c9c7d9cb7839"`);
        await queryRunner.query(`CREATE TABLE "temporary_product_category" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "imageUrl" varchar, "imageId" varchar, CONSTRAINT "FK_853302351eaa4daa39920c270a9" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_0a0cf25cd8232a154d1cce2641c" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_f38e86bd280ff9c9c7d9cb78393" FOREIGN KEY ("imageId") REFERENCES "image_asset" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_product_category"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "imageUrl", "imageId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "imageUrl", "imageId" FROM "product_category"`);
        await queryRunner.query(`DROP TABLE "product_category"`);
        await queryRunner.query(`ALTER TABLE "temporary_product_category" RENAME TO "product_category"`);
        await queryRunner.query(`CREATE INDEX "IDX_853302351eaa4daa39920c270a" ON "product_category" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_0a0cf25cd8232a154d1cce2641" ON "product_category" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_f38e86bd280ff9c9c7d9cb7839" ON "product_category" ("imageId") `);
    }

    /**
    * SqliteDB Down Migration
    *
    * @param queryRunner
    */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_f38e86bd280ff9c9c7d9cb7839"`);
        await queryRunner.query(`DROP INDEX "IDX_0a0cf25cd8232a154d1cce2641"`);
        await queryRunner.query(`DROP INDEX "IDX_853302351eaa4daa39920c270a"`);
        await queryRunner.query(`ALTER TABLE "product_category" RENAME TO "temporary_product_category"`);
        await queryRunner.query(`CREATE TABLE "product_category" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "imageUrl" varchar, "imageId" varchar, CONSTRAINT "FK_853302351eaa4daa39920c270a9" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_0a0cf25cd8232a154d1cce2641c" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "product_category"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "imageUrl", "imageId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "imageUrl", "imageId" FROM "temporary_product_category"`);
        await queryRunner.query(`DROP TABLE "temporary_product_category"`);
        await queryRunner.query(`CREATE INDEX "IDX_f38e86bd280ff9c9c7d9cb7839" ON "product_category" ("imageId") `);
        await queryRunner.query(`CREATE INDEX "IDX_0a0cf25cd8232a154d1cce2641" ON "product_category" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_853302351eaa4daa39920c270a" ON "product_category" ("organizationId") `);
        await queryRunner.query(`DROP INDEX "IDX_f38e86bd280ff9c9c7d9cb7839"`);
        await queryRunner.query(`DROP INDEX "IDX_0a0cf25cd8232a154d1cce2641"`);
        await queryRunner.query(`DROP INDEX "IDX_853302351eaa4daa39920c270a"`);
        await queryRunner.query(`ALTER TABLE "product_category" RENAME TO "temporary_product_category"`);
        await queryRunner.query(`CREATE TABLE "product_category" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "imageUrl" varchar, CONSTRAINT "FK_853302351eaa4daa39920c270a9" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_0a0cf25cd8232a154d1cce2641c" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "product_category"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "imageUrl") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "imageUrl" FROM "temporary_product_category"`);
        await queryRunner.query(`DROP TABLE "temporary_product_category"`);
        await queryRunner.query(`CREATE INDEX "IDX_0a0cf25cd8232a154d1cce2641" ON "product_category" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_853302351eaa4daa39920c270a" ON "product_category" ("organizationId") `);
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
