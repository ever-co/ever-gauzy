
import { MigrationInterface, QueryRunner } from "typeorm";
import { yellow } from "chalk";
import { DatabaseTypeEnum } from "@gauzy/config";

export class AlterUserTableAddDefaultTeamAndWorkspace1722522985782 implements MigrationInterface {

    name = 'AlterUserTableAddDefaultTeamAndWorkspace1722522985782';

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
        await queryRunner.query(`ALTER TABLE "user" ADD "defaultTeamId" uuid`);
        await queryRunner.query(`CREATE INDEX "IDX_1a8ae1126aae1823d62ccf3f82" ON "user" ("defaultTeamId") `);
        await queryRunner.query(`ALTER TABLE "user" ADD CONSTRAINT "FK_1a8ae1126aae1823d62ccf3f821" FOREIGN KEY ("defaultTeamId") REFERENCES "organization_team"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "user" DROP CONSTRAINT "FK_1a8ae1126aae1823d62ccf3f821"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1a8ae1126aae1823d62ccf3f82"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "defaultTeamId"`);
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
