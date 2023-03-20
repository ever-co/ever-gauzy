
import { MigrationInterface, QueryRunner } from "typeorm";

export class AlterImageAssetTable1679308324164 implements MigrationInterface {

    name = 'AlterImageAssetTable1679308324164';

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
        
    }

    /**
    * SqliteDB Down Migration
    *
    * @param queryRunner
    */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        
    }
}
