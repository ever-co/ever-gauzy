import { MigrationInterface, QueryRunner } from "typeorm";
import * as chalk from "chalk";

export class AddColumnToRoleTable1640007378352 implements MigrationInterface {

    name = 'AddColumnToRoleTable1640007378352';

    public async up(queryRunner: QueryRunner): Promise<void> {
        console.log(chalk.yellow(this.name + ' start running!'));

        if (['sqlite', 'better-sqlite3'].includes(queryRunner.connection.options.type)) {
            await this.upQueryRunner(queryRunner);
        } else if (['mysql'].includes(queryRunner.connection.options.type)) {
            await this.mysqlUpQueryRunner(queryRunner);
        } else {
            await this.upQueryRunner(queryRunner);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        if (['sqlite', 'better-sqlite3'].includes(queryRunner.connection.options.type)) {
            await this.downQueryRunner(queryRunner);
        } else if (['mysql'].includes(queryRunner.connection.options.type)) {
            await this.mysqlDownQueryRunner(queryRunner);
        } else {
            await this.downQueryRunner(queryRunner);
        }
    }

    public async upQueryRunner(queryRunner: QueryRunner): Promise<any> {
        console.log(chalk.yellow(this.name + ' start running!'));

        await queryRunner.query(`ALTER TABLE "role" ADD "isSystem" boolean NOT NULL DEFAULT false`);
    }

    public async downQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "role" DROP COLUMN "isSystem"`);
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
