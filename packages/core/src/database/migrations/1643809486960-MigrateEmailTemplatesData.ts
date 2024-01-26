import { MigrationInterface, QueryRunner } from "typeorm";
import * as chalk from 'chalk';
import { EmailTemplateEnum } from "@gauzy/contracts";
import { EmailTemplateUtils } from "../../email-template/utils";
import { databaseTypes } from "@gauzy/config";


export class MigrateEmailTemplatesData1643809486960 implements MigrationInterface {

    name = 'MigrateEmailTemplatesData1643809486960';

    /**
     * Up Migration
     *
     * @param queryRunner
     */
    public async up(queryRunner: QueryRunner): Promise<void> {
        console.log(chalk.yellow(this.name + ' start running!'));

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
    * Up Migration
    *
    * @param queryRunner
    */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        console.log(chalk.yellow(this.name + ' start running!'));

        const templates = Object.values(EmailTemplateEnum);
        for await (const template of templates) {
            try {
                await EmailTemplateUtils.migrateEmailTemplates(queryRunner, template);
            } catch (error) {
                console.log(`Error while migrating missing email templates for ${template}`, error);
            }
        }
    }
    /**
    * Up Migration
    *
    * @param queryRunner
    */
    public async postgresUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        console.log(chalk.yellow(this.name + ' start running!'));

        const templates = Object.values(EmailTemplateEnum);
        for await (const template of templates) {
            try {
                await EmailTemplateUtils.migrateEmailTemplates(queryRunner, template);
            } catch (error) {
                console.log(`Error while migrating missing email templates for ${template}`, error);
            }
        }
    }

    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> { }

    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> { }

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
