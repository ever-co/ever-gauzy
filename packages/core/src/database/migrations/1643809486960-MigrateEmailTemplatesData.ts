import { MigrationInterface, QueryRunner } from "typeorm";
import * as chalk from 'chalk';
import { EmailTemplateEnum } from "@gauzy/contracts";
import { EmailTemplateUtils } from "../../email-template/utils";

export class MigrateEmailTemplatesData1643809486960 implements MigrationInterface {

    name = 'MigrateEmailTemplatesData1643809486960';

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

    /**
    * Up Migration
    *
    * @param queryRunner
    */
    public async upQueryRunner(queryRunner: QueryRunner): Promise<any> {
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

    public async downQueryRunner(queryRunner: QueryRunner): Promise<any> { }

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
