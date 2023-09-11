
import { MigrationInterface, QueryRunner } from "typeorm";

export class AddColumnsToTheIntegrationTables1694409582196 implements MigrationInterface {

    name = 'AddColumnsToTheIntegrationTables1694409582196';

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
        await queryRunner.query(`ALTER TABLE "integration" DROP COLUMN "navigationUrl"`);
        await queryRunner.query(`ALTER TABLE "integration_type" ADD "description" character varying`);
        await queryRunner.query(`ALTER TABLE "integration_type" ADD "icon" character varying`);
        await queryRunner.query(`ALTER TABLE "integration" ADD "provider" character varying`);
        await queryRunner.query(`ALTER TABLE "integration" ADD "slug" character varying`);
        await queryRunner.query(`ALTER TABLE "integration" DROP CONSTRAINT "UQ_52d7fa32a7832b377fc2d7f6199"`);
        await queryRunner.query(`ALTER TABLE "integration" ADD CONSTRAINT "UQ_3bdf30194e3e21c3985f538c91a" UNIQUE ("name", "provider")`);
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "integration" DROP CONSTRAINT "UQ_3bdf30194e3e21c3985f538c91a"`);
        await queryRunner.query(`ALTER TABLE "integration" ADD CONSTRAINT "UQ_52d7fa32a7832b377fc2d7f6199" UNIQUE ("name")`);
        await queryRunner.query(`ALTER TABLE "integration" DROP COLUMN "slug"`);
        await queryRunner.query(`ALTER TABLE "integration" DROP COLUMN "provider"`);
        await queryRunner.query(`ALTER TABLE "integration_type" DROP COLUMN "icon"`);
        await queryRunner.query(`ALTER TABLE "integration_type" DROP COLUMN "description"`);
        await queryRunner.query(`ALTER TABLE "integration" ADD "navigationUrl" character varying`);
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
