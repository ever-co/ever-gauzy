
import { MigrationInterface, QueryRunner } from "typeorm";
import { yellow } from "chalk";
import { DatabaseTypeEnum } from "@gauzy/config";

export class CreateDailyPlanEntity1714063803808 implements MigrationInterface {

    name = 'CreateDailyPlanEntity1714063803808';

    /**
     * Up Migration
     *
     * @param queryRunner
     */
    public async up(queryRunner: QueryRunner): Promise<void> {
        console.log(yellow(this.name + ' start running!'));

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
        await queryRunner.query(`CREATE TABLE "daily_plan" ("deletedAt" TIMESTAMP, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "tenantId" uuid, "organizationId" uuid, "date" TIMESTAMP NOT NULL, "workTimePlanned" TIMESTAMP NOT NULL, "status" character varying NOT NULL, "employeeId" uuid, CONSTRAINT "PK_5a8376283b3afaec53d740b9657" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_903b08cd4c8025e73316342452" ON "daily_plan" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_ce5e588780497b05cd6267e20e" ON "daily_plan" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_ecb357a3764a7344c633a257d7" ON "daily_plan" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_9779a35ef1338bafb7b90714f1" ON "daily_plan" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_f2cf366f3f08e31784b056df88" ON "daily_plan" ("employeeId") `);
        await queryRunner.query(`ALTER TYPE "public"."image_asset_storageprovider_enum" RENAME TO "image_asset_storageprovider_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."image_asset_storageprovider_enum" AS ENUM('DEBUG', 'LOCAL', 'S3', 'WASABI', 'CLOUDINARY', 'DIGITALOCEAN')`);
        await queryRunner.query(`ALTER TABLE "image_asset" ALTER COLUMN "storageProvider" TYPE "public"."image_asset_storageprovider_enum" USING "storageProvider"::"text"::"public"."image_asset_storageprovider_enum"`);
        await queryRunner.query(`DROP TYPE "public"."image_asset_storageprovider_enum_old"`);
        await queryRunner.query(`ALTER TYPE "public"."screenshot_storageprovider_enum" RENAME TO "screenshot_storageprovider_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."screenshot_storageprovider_enum" AS ENUM('DEBUG', 'LOCAL', 'S3', 'WASABI', 'CLOUDINARY', 'DIGITALOCEAN')`);
        await queryRunner.query(`ALTER TABLE "screenshot" ALTER COLUMN "storageProvider" TYPE "public"."screenshot_storageprovider_enum" USING "storageProvider"::"text"::"public"."screenshot_storageprovider_enum"`);
        await queryRunner.query(`DROP TYPE "public"."screenshot_storageprovider_enum_old"`);
        await queryRunner.query(`ALTER TABLE "daily_plan" ADD CONSTRAINT "FK_ecb357a3764a7344c633a257d76" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "daily_plan" ADD CONSTRAINT "FK_9779a35ef1338bafb7b90714f16" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "daily_plan" ADD CONSTRAINT "FK_f2cf366f3f08e31784b056df880" FOREIGN KEY ("employeeId") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "daily_plan" DROP CONSTRAINT "FK_f2cf366f3f08e31784b056df880"`);
        await queryRunner.query(`ALTER TABLE "daily_plan" DROP CONSTRAINT "FK_9779a35ef1338bafb7b90714f16"`);
        await queryRunner.query(`ALTER TABLE "daily_plan" DROP CONSTRAINT "FK_ecb357a3764a7344c633a257d76"`);
        await queryRunner.query(`CREATE TYPE "public"."screenshot_storageprovider_enum_old" AS ENUM('LOCAL', 'S3', 'WASABI', 'CLOUDINARY', 'DIGITALOCEAN')`);
        await queryRunner.query(`ALTER TABLE "screenshot" ALTER COLUMN "storageProvider" TYPE "public"."screenshot_storageprovider_enum_old" USING "storageProvider"::"text"::"public"."screenshot_storageprovider_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."screenshot_storageprovider_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."screenshot_storageprovider_enum_old" RENAME TO "screenshot_storageprovider_enum"`);
        await queryRunner.query(`CREATE TYPE "public"."image_asset_storageprovider_enum_old" AS ENUM('LOCAL', 'S3', 'WASABI', 'CLOUDINARY', 'DIGITALOCEAN')`);
        await queryRunner.query(`ALTER TABLE "image_asset" ALTER COLUMN "storageProvider" TYPE "public"."image_asset_storageprovider_enum_old" USING "storageProvider"::"text"::"public"."image_asset_storageprovider_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."image_asset_storageprovider_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."image_asset_storageprovider_enum_old" RENAME TO "image_asset_storageprovider_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f2cf366f3f08e31784b056df88"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9779a35ef1338bafb7b90714f1"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ecb357a3764a7344c633a257d7"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ce5e588780497b05cd6267e20e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_903b08cd4c8025e73316342452"`);
        await queryRunner.query(`DROP TABLE "daily_plan"`);
    }

    /**
    * SqliteDB and BetterSQlite3DB Up Migration
    *
    * @param queryRunner
    */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        
    }

    /**
    * SqliteDB and BetterSQlite3DB Down Migration
    *
    * @param queryRunner
    */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        
    }

    /**
     * MySQL Up Migration
     *
     * @param queryRunner
     */
    public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        
    }

    /**
     * MySQL Down Migration
     *
     * @param queryRunner
     */
    public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        
    }
}
