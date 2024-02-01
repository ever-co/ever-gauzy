import { MigrationInterface, QueryRunner } from "typeorm";
import * as chalk from "chalk";
import { DatabaseTypeEnum } from "@gauzy/config";

export class AddIndexesColumnsToTheActivityTable1680154573492 implements MigrationInterface {

    name = 'AddIndexesColumnsToTheActivityTable1680154573492';

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
        await queryRunner.query(`CREATE INDEX "IDX_a28a1682ea80f10d1ecc7babaa" ON "activity" ("title") `);
        await queryRunner.query(`CREATE INDEX "IDX_302b60a4970ffe94d5223f1c23" ON "activity" ("date") `);
        await queryRunner.query(`CREATE INDEX "IDX_b5525385e85f7429e233d4a0fa" ON "activity" ("time") `);
        await queryRunner.query(`CREATE INDEX "IDX_f27285af15ef48363745ab2d79" ON "activity" ("type") `);
        await queryRunner.query(`CREATE INDEX "IDX_0e36a2c95e2f1df7f1b3059d24" ON "activity" ("source") `);
        await queryRunner.query(`CREATE INDEX "IDX_ffd736f18ba71b3221e4f835a9" ON "activity" ("recordedAt") `);
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "public"."IDX_ffd736f18ba71b3221e4f835a9"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0e36a2c95e2f1df7f1b3059d24"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f27285af15ef48363745ab2d79"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b5525385e85f7429e233d4a0fa"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_302b60a4970ffe94d5223f1c23"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a28a1682ea80f10d1ecc7babaa"`);
    }

    /**
    * SqliteDB Up Migration
    *
    * @param queryRunner
    */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`CREATE INDEX "IDX_a28a1682ea80f10d1ecc7babaa" ON "activity" ("title") `);
        await queryRunner.query(`CREATE INDEX "IDX_302b60a4970ffe94d5223f1c23" ON "activity" ("date") `);
        await queryRunner.query(`CREATE INDEX "IDX_b5525385e85f7429e233d4a0fa" ON "activity" ("time") `);
        await queryRunner.query(`CREATE INDEX "IDX_f27285af15ef48363745ab2d79" ON "activity" ("type") `);
        await queryRunner.query(`CREATE INDEX "IDX_0e36a2c95e2f1df7f1b3059d24" ON "activity" ("source") `);
        await queryRunner.query(`CREATE INDEX "IDX_ffd736f18ba71b3221e4f835a9" ON "activity" ("recordedAt") `);
    }

    /**
    * SqliteDB Down Migration
    *
    * @param queryRunner
    */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_ffd736f18ba71b3221e4f835a9"`);
        await queryRunner.query(`DROP INDEX "IDX_0e36a2c95e2f1df7f1b3059d24"`);
        await queryRunner.query(`DROP INDEX "IDX_f27285af15ef48363745ab2d79"`);
        await queryRunner.query(`DROP INDEX "IDX_b5525385e85f7429e233d4a0fa"`);
        await queryRunner.query(`DROP INDEX "IDX_302b60a4970ffe94d5223f1c23"`);
        await queryRunner.query(`DROP INDEX "IDX_a28a1682ea80f10d1ecc7babaa"`);
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
