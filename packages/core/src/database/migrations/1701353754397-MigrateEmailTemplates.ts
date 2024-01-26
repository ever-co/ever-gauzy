import { MigrationInterface, QueryRunner } from "typeorm";
import * as chalk from 'chalk';
import { EmailTemplateEnum } from "@gauzy/contracts";
import { EmailTemplateUtils } from "../../email-template/utils";
import { databaseTypes } from "@gauzy/config";

export class MigrateEmailTemplates1701353754397 implements MigrationInterface {

    name = 'MigrateEmailTemplates1701353754397';

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
            case databaseTypes.postgres:
                await this.sqlitePostgresMigrateEmailTemplates(queryRunner);
                break;
            case databaseTypes.mysql:
                await this.mysqlMigrateEmailTemplates(queryRunner);
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
    public async down(queryRunner: QueryRunner): Promise<void> { }

    /**
    * Sqlite | better-sqlite3 | postgres Up Migration
    *
    * @param queryRunner
    */
    public async sqlitePostgresMigrateEmailTemplates(queryRunner: QueryRunner): Promise<any> {
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
    * MySQL Up Migration
    *
    * @param queryRunner
    */
    public async mysqlMigrateEmailTemplates(queryRunner: QueryRunner): Promise<any> { }
}
