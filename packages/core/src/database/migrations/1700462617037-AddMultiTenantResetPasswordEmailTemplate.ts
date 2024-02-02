import { MigrationInterface, QueryRunner } from "typeorm";
import * as chalk from "chalk";
import { EmailTemplateEnum } from "@gauzy/contracts";
import { EmailTemplateUtils } from "../../email-template/utils";
import { DatabaseTypeEnum } from "@gauzy/config";

export class AddMultiTenantResetPasswordEmailTemplate1700462617037 implements MigrationInterface {

    name = 'AddMultiTenantResetPasswordEmailTemplate1700462617037';

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
            case DatabaseTypeEnum.postgres:
                await this.sqlitePostgresResetPasswordEmailTemplate(queryRunner);
                break;
            case DatabaseTypeEnum.mysql:
                await this.mysqlResetPasswordEmailTemplate(queryRunner);
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
    public async sqlitePostgresResetPasswordEmailTemplate(queryRunner: QueryRunner): Promise<any> {
        console.log(chalk.yellow(this.name + ' start running!'));

        // Migrate email templates for multi-tenant password reset
        try {
            await EmailTemplateUtils.migrateEmailTemplates(queryRunner, EmailTemplateEnum.MULTI_TENANT_PASSWORD_RESET);
        } catch (error) {
            console.log(`Error while migrating missing email templates for ${EmailTemplateEnum.MULTI_TENANT_PASSWORD_RESET}`, error);
        }

        // Migrate email templates for regular password reset
        try {
            await EmailTemplateUtils.migrateEmailTemplates(queryRunner, EmailTemplateEnum.PASSWORD_RESET);
        } catch (error) {
            console.log(`Error while migrating missing email templates for ${EmailTemplateEnum.PASSWORD_RESET}`, error);
        }

        // Migrate email templates for regular password less authentication
        try {
            await EmailTemplateUtils.migrateEmailTemplates(queryRunner, EmailTemplateEnum.PASSWORD_LESS_AUTHENTICATION);
        } catch (error) {
            console.log(`Error while migrating missing email templates for ${EmailTemplateEnum.PASSWORD_LESS_AUTHENTICATION}`, error);
        }
    }

    /**
    * MySQL Up Migration
    *
    * @param queryRunner
    */
    public async mysqlResetPasswordEmailTemplate(queryRunner: QueryRunner): Promise<any> { }

}
