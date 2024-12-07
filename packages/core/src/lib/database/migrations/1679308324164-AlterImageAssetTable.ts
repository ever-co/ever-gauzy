import { MigrationInterface, QueryRunner } from "typeorm";
import * as chalk from "chalk";
import { DatabaseTypeEnum } from "@gauzy/config";

export class AlterImageAssetTable1679308324164 implements MigrationInterface {

    name = 'AlterImageAssetTable1679308324164';

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
        await queryRunner.query(`ALTER TABLE "image_asset" ADD "thumb" character varying`);
        await queryRunner.query(`ALTER TABLE "image_asset" ADD "size" numeric`);
        await queryRunner.query(`ALTER TABLE "image_asset" ADD "externalProviderId" character varying`);
        await queryRunner.query(`CREATE TYPE "public"."image_asset_storageprovider_enum" AS ENUM('LOCAL', 'S3', 'WASABI', 'CLOUDINARY')`);
        await queryRunner.query(`ALTER TABLE "image_asset" ADD "storageProvider" "public"."image_asset_storageprovider_enum"`);
        await queryRunner.query(`ALTER TABLE "image_asset" ADD "deletedAt" TIMESTAMP`);
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "image_asset" DROP COLUMN "deletedAt"`);
        await queryRunner.query(`ALTER TABLE "image_asset" DROP COLUMN "storageProvider"`);
        await queryRunner.query(`DROP TYPE "public"."image_asset_storageprovider_enum"`);
        await queryRunner.query(`ALTER TABLE "image_asset" DROP COLUMN "externalProviderId"`);
        await queryRunner.query(`ALTER TABLE "image_asset" DROP COLUMN "size"`);
        await queryRunner.query(`ALTER TABLE "image_asset" DROP COLUMN "thumb"`);
    }

    /**
    * SqliteDB Up Migration
    *
    * @param queryRunner
    */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_d3675304df9971cccf96d9a7c3"`);
        await queryRunner.query(`DROP INDEX "IDX_01856a9a730b7e79d70aa661cb"`);
        await queryRunner.query(`CREATE TABLE "temporary_image_asset" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar, "url" varchar NOT NULL, "width" integer NOT NULL DEFAULT (0), "height" integer NOT NULL DEFAULT (0), "isFeatured" boolean NOT NULL DEFAULT (0), "thumb" varchar, "size" numeric, "externalProviderId" varchar, "storageProvider" varchar CHECK( "storageProvider" IN ('LOCAL','S3','WASABI','CLOUDINARY') ), "deletedAt" datetime, CONSTRAINT "FK_d3675304df9971cccf96d9a7c34" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_01856a9a730b7e79d70aa661cb0" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_image_asset"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "url", "width", "height", "isFeatured") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "url", "width", "height", "isFeatured" FROM "image_asset"`);
        await queryRunner.query(`DROP TABLE "image_asset"`);
        await queryRunner.query(`ALTER TABLE "temporary_image_asset" RENAME TO "image_asset"`);
        await queryRunner.query(`CREATE INDEX "IDX_d3675304df9971cccf96d9a7c3" ON "image_asset" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_01856a9a730b7e79d70aa661cb" ON "image_asset" ("tenantId") `);
    }

    /**
    * SqliteDB Down Migration
    *
    * @param queryRunner
    */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_01856a9a730b7e79d70aa661cb"`);
        await queryRunner.query(`DROP INDEX "IDX_d3675304df9971cccf96d9a7c3"`);
        await queryRunner.query(`ALTER TABLE "image_asset" RENAME TO "temporary_image_asset"`);
        await queryRunner.query(`CREATE TABLE "image_asset" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar, "url" varchar NOT NULL, "width" integer NOT NULL DEFAULT (0), "height" integer NOT NULL DEFAULT (0), "isFeatured" boolean NOT NULL DEFAULT (0), CONSTRAINT "FK_d3675304df9971cccf96d9a7c34" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_01856a9a730b7e79d70aa661cb0" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "image_asset"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "url", "width", "height", "isFeatured") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "url", "width", "height", "isFeatured" FROM "temporary_image_asset"`);
        await queryRunner.query(`DROP TABLE "temporary_image_asset"`);
        await queryRunner.query(`CREATE INDEX "IDX_01856a9a730b7e79d70aa661cb" ON "image_asset" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_d3675304df9971cccf96d9a7c3" ON "image_asset" ("organizationId") `);
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
