
import { MigrationInterface, QueryRunner } from "typeorm";
import { databaseTypes } from "@gauzy/config";
import { yellow } from "chalk";

export class UpdateHbsField1704791236138 implements MigrationInterface {

    name = 'UpdateHbsField1704791236138';

    /**
     * Up Migration
     *
     * @param queryRunner
     */
    public async up(queryRunner: QueryRunner): Promise<void> {
        console.log(yellow(this.name + ' start running!'));

        switch (queryRunner.connection.options.type) {
            case databaseTypes.sqlite:
            case databaseTypes.betterSqlite3:
                await this.sqliteUpQueryRunner(queryRunner);
                break;
            case databaseTypes.postgres:
                await this.postgresUpQueryRunner(queryRunner);
                break;
            case databaseTypes.mysql:
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
            case databaseTypes.sqlite:
            case databaseTypes.betterSqlite3:
                await this.sqliteDownQueryRunner(queryRunner);
                break;
            case databaseTypes.postgres:
                await this.postgresDownQueryRunner(queryRunner);
                break;
            case databaseTypes.mysql:
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
        
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        
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
        await queryRunner.query(`ALTER TABLE \`email_template\` DROP COLUMN \`hbs\``);await queryRunner.query(`ALTER TABLE \`email_template\` ADD \`hbs\` longtext NOT NULL`);await queryRunner.query(`ALTER TABLE \`activity\` CHANGE \`time\` \`time\` time(6) NOT NULL DEFAULT '0'`);
    }

    /**
     * MySQL Down Migration
     *
     * @param queryRunner
     */
    public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE \`activity\` CHANGE \`time\` \`time\` time(6) NOT NULL DEFAULT '00:00:00.000000'`);await queryRunner.query(`ALTER TABLE \`email_template\` DROP COLUMN \`hbs\``);await queryRunner.query(`ALTER TABLE \`email_template\` ADD \`hbs\` varchar(255) NOT NULL`);
    }
}
