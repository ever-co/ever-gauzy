import { MigrationInterface, QueryRunner } from "typeorm";
import * as chalk from "chalk";
import { DatabaseTypeEnum } from "@gauzy/config";

export class AlterScreenshotTable1677508195152 implements MigrationInterface {

    name = 'AlterScreenshotTable1677508195152';

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
        await queryRunner.query(`ALTER TYPE "public"."screenshot_storageprovider_enum" RENAME TO "screenshot_storageprovider_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."screenshot_storageprovider_enum" AS ENUM('LOCAL', 'S3', 'WASABI', 'CLOUDINARY')`);
        await queryRunner.query(`ALTER TABLE "screenshot" ALTER COLUMN "storageProvider" TYPE "public"."screenshot_storageprovider_enum" USING "storageProvider"::"text"::"public"."screenshot_storageprovider_enum"`);
        await queryRunner.query(`DROP TYPE "public"."screenshot_storageprovider_enum_old"`);
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`CREATE TYPE "public"."screenshot_storageprovider_enum_old" AS ENUM('LOCAL', 'S3', 'WASABI')`);
        await queryRunner.query(`ALTER TABLE "screenshot" ALTER COLUMN "storageProvider" TYPE "public"."screenshot_storageprovider_enum_old" USING "storageProvider"::"text"::"public"."screenshot_storageprovider_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."screenshot_storageprovider_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."screenshot_storageprovider_enum_old" RENAME TO "screenshot_storageprovider_enum"`);
    }

    /**
    * SqliteDB Up Migration
    *
    * @param queryRunner
    */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> { }

    /**
    * SqliteDB Down Migration
    *
    * @param queryRunner
    */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> { }

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
