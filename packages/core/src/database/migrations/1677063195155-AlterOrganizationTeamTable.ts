
import { MigrationInterface, QueryRunner } from "typeorm";

export class AlterOrganizationTeamTable1677063195155 implements MigrationInterface {

    name = 'AlterOrganizationTeamTable1677063195155';

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

    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {

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
