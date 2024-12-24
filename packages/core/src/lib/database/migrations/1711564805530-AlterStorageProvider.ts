
import { MigrationInterface, QueryRunner } from "typeorm";
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from "@gauzy/config";

export class AlterStorageProvider1711564805530 implements MigrationInterface {

    name = 'AlterStorageProvider1711564805530';

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
        await queryRunner.query(`ALTER TYPE "public"."image_asset_storageprovider_enum" RENAME TO "image_asset_storageprovider_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."image_asset_storageprovider_enum" AS ENUM('LOCAL', 'S3', 'WASABI', 'CLOUDINARY', 'DIGITALOCEAN')`);
        await queryRunner.query(`ALTER TABLE "image_asset" ALTER COLUMN "storageProvider" TYPE "public"."image_asset_storageprovider_enum" USING "storageProvider"::"text"::"public"."image_asset_storageprovider_enum"`);
        await queryRunner.query(`DROP TYPE "public"."image_asset_storageprovider_enum_old"`);
        await queryRunner.query(`ALTER TYPE "public"."screenshot_storageprovider_enum" RENAME TO "screenshot_storageprovider_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."screenshot_storageprovider_enum" AS ENUM('LOCAL', 'S3', 'WASABI', 'CLOUDINARY', 'DIGITALOCEAN')`);
        await queryRunner.query(`ALTER TABLE "screenshot" ALTER COLUMN "storageProvider" TYPE "public"."screenshot_storageprovider_enum" USING "storageProvider"::"text"::"public"."screenshot_storageprovider_enum"`);
        await queryRunner.query(`DROP TYPE "public"."screenshot_storageprovider_enum_old"`);
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`CREATE TYPE "public"."screenshot_storageprovider_enum_old" AS ENUM('LOCAL', 'S3', 'WASABI', 'CLOUDINARY')`);
        await queryRunner.query(`ALTER TABLE "screenshot" ALTER COLUMN "storageProvider" TYPE "public"."screenshot_storageprovider_enum_old" USING "storageProvider"::"text"::"public"."screenshot_storageprovider_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."screenshot_storageprovider_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."screenshot_storageprovider_enum_old" RENAME TO "screenshot_storageprovider_enum"`);
        await queryRunner.query(`CREATE TYPE "public"."image_asset_storageprovider_enum_old" AS ENUM('LOCAL', 'S3', 'WASABI', 'CLOUDINARY')`);
        await queryRunner.query(`ALTER TABLE "image_asset" ALTER COLUMN "storageProvider" TYPE "public"."image_asset_storageprovider_enum_old" USING "storageProvider"::"text"::"public"."image_asset_storageprovider_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."image_asset_storageprovider_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."image_asset_storageprovider_enum_old" RENAME TO "image_asset_storageprovider_enum"`);
    }

    /**
    * SqliteDB and BetterSQlite3DB Up Migration
    *
    * @param queryRunner
    */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_af1a212cb378bb0eed51c1b2bc"`);
        await queryRunner.query(`DROP INDEX "IDX_9d44ce9eb8689e578b941a6a54"`);
        await queryRunner.query(`DROP INDEX "IDX_d3675304df9971cccf96d9a7c3"`);
        await queryRunner.query(`DROP INDEX "IDX_01856a9a730b7e79d70aa661cb"`);
        await queryRunner.query(`CREATE TABLE "temporary_image_asset" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar, "url" varchar NOT NULL, "width" integer NOT NULL DEFAULT (0), "height" integer NOT NULL DEFAULT (0), "isFeatured" boolean NOT NULL DEFAULT (0), "thumb" varchar, "size" numeric, "externalProviderId" varchar, "storageProvider" varchar CHECK( "storageProvider" IN ('LOCAL','S3','WASABI','CLOUDINARY','DIGITALOCEAN') ), "deletedAt" datetime, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), CONSTRAINT "FK_d3675304df9971cccf96d9a7c34" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_01856a9a730b7e79d70aa661cb0" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_image_asset"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "url", "width", "height", "isFeatured", "thumb", "size", "externalProviderId", "storageProvider", "deletedAt", "isActive", "isArchived") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "url", "width", "height", "isFeatured", "thumb", "size", "externalProviderId", "storageProvider", "deletedAt", "isActive", "isArchived" FROM "image_asset"`);
        await queryRunner.query(`DROP TABLE "image_asset"`);
        await queryRunner.query(`ALTER TABLE "temporary_image_asset" RENAME TO "image_asset"`);
        await queryRunner.query(`CREATE INDEX "IDX_af1a212cb378bb0eed51c1b2bc" ON "image_asset" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_9d44ce9eb8689e578b941a6a54" ON "image_asset" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_d3675304df9971cccf96d9a7c3" ON "image_asset" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_01856a9a730b7e79d70aa661cb" ON "image_asset" ("tenantId") `);
    }

    /**
    * SqliteDB and BetterSQlite3DB Down Migration
    *
    * @param queryRunner
    */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_01856a9a730b7e79d70aa661cb"`);
        await queryRunner.query(`DROP INDEX "IDX_d3675304df9971cccf96d9a7c3"`);
        await queryRunner.query(`DROP INDEX "IDX_9d44ce9eb8689e578b941a6a54"`);
        await queryRunner.query(`DROP INDEX "IDX_af1a212cb378bb0eed51c1b2bc"`);
        await queryRunner.query(`ALTER TABLE "image_asset" RENAME TO "temporary_image_asset"`);
        await queryRunner.query(`CREATE TABLE "image_asset" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar, "url" varchar NOT NULL, "width" integer NOT NULL DEFAULT (0), "height" integer NOT NULL DEFAULT (0), "isFeatured" boolean NOT NULL DEFAULT (0), "thumb" varchar, "size" numeric, "externalProviderId" varchar, "storageProvider" varchar CHECK( "storageProvider" IN ('LOCAL','S3','WASABI','CLOUDINARY') ), "deletedAt" datetime, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), CONSTRAINT "FK_d3675304df9971cccf96d9a7c34" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_01856a9a730b7e79d70aa661cb0" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "image_asset"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "url", "width", "height", "isFeatured", "thumb", "size", "externalProviderId", "storageProvider", "deletedAt", "isActive", "isArchived") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "url", "width", "height", "isFeatured", "thumb", "size", "externalProviderId", "storageProvider", "deletedAt", "isActive", "isArchived" FROM "temporary_image_asset"`);
        await queryRunner.query(`DROP TABLE "temporary_image_asset"`);
        await queryRunner.query(`CREATE INDEX "IDX_01856a9a730b7e79d70aa661cb" ON "image_asset" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_d3675304df9971cccf96d9a7c3" ON "image_asset" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_9d44ce9eb8689e578b941a6a54" ON "image_asset" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_af1a212cb378bb0eed51c1b2bc" ON "image_asset" ("isArchived") `);
    }

    /**
    * MySQL Up Migration
    *
    * @param queryRunner
    */
    public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE \`image_asset\` CHANGE \`storageProvider\` \`storageProvider\` enum ('LOCAL', 'S3', 'WASABI', 'CLOUDINARY', 'DIGITALOCEAN') NULL`);
        await queryRunner.query(`ALTER TABLE \`screenshot\` CHANGE \`storageProvider\` \`storageProvider\` enum ('LOCAL', 'S3', 'WASABI', 'CLOUDINARY', 'DIGITALOCEAN') NULL`);
    }

    /**
     * MySQL Down Migration
     *
     * @param queryRunner
     */
    public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE \`screenshot\` CHANGE \`storageProvider\` \`storageProvider\` enum ('LOCAL', 'S3', 'WASABI', 'CLOUDINARY') NULL`);
        await queryRunner.query(`ALTER TABLE \`image_asset\` CHANGE \`storageProvider\` \`storageProvider\` enum ('LOCAL', 'S3', 'WASABI', 'CLOUDINARY') NULL`);
    }
}
