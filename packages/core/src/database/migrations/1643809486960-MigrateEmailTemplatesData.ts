import { MigrationInterface, QueryRunner } from "typeorm";
import * as chalk from 'chalk';
import { EmailTemplateEnum } from "@gauzy/contracts";
import { EmailTemplateUtils } from "./../../email-template/utils";

export class MigrateEmailTemplatesData1643809486960 implements MigrationInterface {

    name = 'MigrateEmailTemplatesData1643809486960';

    /**
    * Up Migration
    *
    * @param queryRunner
    */
    public async up(queryRunner: QueryRunner): Promise<any> {
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

    public async down(queryRunner: QueryRunner): Promise<any> { }
}
