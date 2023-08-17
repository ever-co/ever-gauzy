
import { MigrationInterface, QueryRunner } from "typeorm";

export class AlterIntegrationTableRelationCascading1692275997367 implements MigrationInterface {

    name = 'AlterIntegrationTableRelationCascading1692275997367';

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
        await queryRunner.query(`ALTER TABLE "integration_entity_setting" DROP CONSTRAINT "FK_f80ff4ebbf0b33a67dce5989117"`);
        await queryRunner.query(`ALTER TABLE "integration_map" DROP CONSTRAINT "FK_c327ea26bda3d349a1eceb5658e"`);
        await queryRunner.query(`ALTER TABLE "integration_integration_type" DROP CONSTRAINT "FK_8dd2062499a6c2a708ddd05650e"`);
        await queryRunner.query(`ALTER TABLE "integration_map" ALTER COLUMN "sourceId" TYPE character varying`);
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
        await queryRunner.query(`ALTER TABLE "integration_map" ALTER COLUMN "sourceId" TYPE integer`);
        await queryRunner.query(`ALTER TABLE "integration_integration_type" ADD CONSTRAINT "FK_8dd2062499a6c2a708ddd05650e" FOREIGN KEY ("integrationTypeId") REFERENCES "integration_type"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "integration_map" ADD CONSTRAINT "FK_c327ea26bda3d349a1eceb5658e" FOREIGN KEY ("integrationId") REFERENCES "integration_tenant"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "integration_entity_setting" ADD CONSTRAINT "FK_f80ff4ebbf0b33a67dce5989117" FOREIGN KEY ("integrationId") REFERENCES "integration_tenant"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
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
