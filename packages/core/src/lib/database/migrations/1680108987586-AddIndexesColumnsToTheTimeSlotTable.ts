import { MigrationInterface, QueryRunner } from "typeorm";
import * as chalk from "chalk";
import { DatabaseTypeEnum } from "@gauzy/config";

export class AddIndexesColumnsToTheTimeSlotTable1680108987586 implements MigrationInterface {

    name = 'AddIndexesColumnsToTheTimeSlotTable1680108987586';

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
        await queryRunner.query(`CREATE INDEX "IDX_0c707825a7c2ecc4e186b07ebf" ON "time_slot" ("duration") `);
        await queryRunner.query(`CREATE INDEX "IDX_f44e721669d5c6bed32cd6a3bf" ON "time_slot" ("overall") `);
        await queryRunner.query(`CREATE INDEX "IDX_c6e7d1075bfd97eea6643b1479" ON "time_slot" ("startedAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_7913305b850c7afc89b6ed96a3" ON "time_slot" ("employeeId") `);
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "public"."IDX_7913305b850c7afc89b6ed96a3"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c6e7d1075bfd97eea6643b1479"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f44e721669d5c6bed32cd6a3bf"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0c707825a7c2ecc4e186b07ebf"`);
    }

    /**
    * SqliteDB Up Migration
    *
    * @param queryRunner
    */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`CREATE INDEX "IDX_0c707825a7c2ecc4e186b07ebf" ON "time_slot" ("duration") `);
        await queryRunner.query(`CREATE INDEX "IDX_f44e721669d5c6bed32cd6a3bf" ON "time_slot" ("overall") `);
        await queryRunner.query(`CREATE INDEX "IDX_c6e7d1075bfd97eea6643b1479" ON "time_slot" ("startedAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_7913305b850c7afc89b6ed96a3" ON "time_slot" ("employeeId") `);
    }

    /**
    * SqliteDB Down Migration
    *
    * @param queryRunner
    */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_7913305b850c7afc89b6ed96a3"`);
        await queryRunner.query(`DROP INDEX "IDX_c6e7d1075bfd97eea6643b1479"`);
        await queryRunner.query(`DROP INDEX "IDX_f44e721669d5c6bed32cd6a3bf"`);
        await queryRunner.query(`DROP INDEX "IDX_0c707825a7c2ecc4e186b07ebf"`);
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
