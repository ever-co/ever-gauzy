
import { MigrationInterface, QueryRunner } from "typeorm";

export class AddIndexesColumnsToTheTimeLogTable1680172332764 implements MigrationInterface {

    name = 'AddIndexesColumnsToTheTimeLogTable1680172332764';

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
        await queryRunner.query(`CREATE INDEX "IDX_189b79acd611870aba62b3594e" ON "time_log" ("startedAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_a1f8fcd70164d915fe7dd4a1ec" ON "time_log" ("stoppedAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_e80fb588b1086ce2a4f2244814" ON "time_log" ("logType") `);
        await queryRunner.query(`CREATE INDEX "IDX_402290e7045e0c10ef97d9f982" ON "time_log" ("source") `);
        await queryRunner.query(`CREATE INDEX "IDX_722b9cb3a991c964d86396b6bc" ON "time_log" ("isBillable") `);
        await queryRunner.query(`CREATE INDEX "IDX_f447474d185cd70b3015853874" ON "time_log" ("isRunning") `);
        await queryRunner.query(`CREATE INDEX "IDX_79001d281ecb766005b3d331c1" ON "time_log" ("version") `);
        await queryRunner.query(`CREATE INDEX "IDX_c52aae9bd99b254f62a6a71a54" ON "time_log" ("deletedAt") `);
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "public"."IDX_c52aae9bd99b254f62a6a71a54"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_79001d281ecb766005b3d331c1"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f447474d185cd70b3015853874"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_722b9cb3a991c964d86396b6bc"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_402290e7045e0c10ef97d9f982"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e80fb588b1086ce2a4f2244814"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a1f8fcd70164d915fe7dd4a1ec"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_189b79acd611870aba62b3594e"`);
    }

    /**
   * SqliteDB Up Migration
   *
   * @param queryRunner
   */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`CREATE INDEX "IDX_189b79acd611870aba62b3594e" ON "time_log" ("startedAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_a1f8fcd70164d915fe7dd4a1ec" ON "time_log" ("stoppedAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_e80fb588b1086ce2a4f2244814" ON "time_log" ("logType") `);
        await queryRunner.query(`CREATE INDEX "IDX_402290e7045e0c10ef97d9f982" ON "time_log" ("source") `);
        await queryRunner.query(`CREATE INDEX "IDX_722b9cb3a991c964d86396b6bc" ON "time_log" ("isBillable") `);
        await queryRunner.query(`CREATE INDEX "IDX_f447474d185cd70b3015853874" ON "time_log" ("isRunning") `);
        await queryRunner.query(`CREATE INDEX "IDX_79001d281ecb766005b3d331c1" ON "time_log" ("version") `);
        await queryRunner.query(`CREATE INDEX "IDX_c52aae9bd99b254f62a6a71a54" ON "time_log" ("deletedAt") `);
    }

    /**
    * SqliteDB Down Migration
    *
    * @param queryRunner
    */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_c52aae9bd99b254f62a6a71a54"`);
        await queryRunner.query(`DROP INDEX "IDX_79001d281ecb766005b3d331c1"`);
        await queryRunner.query(`DROP INDEX "IDX_f447474d185cd70b3015853874"`);
        await queryRunner.query(`DROP INDEX "IDX_722b9cb3a991c964d86396b6bc"`);
        await queryRunner.query(`DROP INDEX "IDX_402290e7045e0c10ef97d9f982"`);
        await queryRunner.query(`DROP INDEX "IDX_e80fb588b1086ce2a4f2244814"`);
        await queryRunner.query(`DROP INDEX "IDX_a1f8fcd70164d915fe7dd4a1ec"`);
        await queryRunner.query(`DROP INDEX "IDX_189b79acd611870aba62b3594e"`);
    }
}
