import { MigrationInterface, QueryRunner } from "typeorm";
import * as chalk from 'chalk';
import { EmailTemplateEnum } from "@gauzy/contracts";
import { EmailTemplateUtils } from "./../../email-template/utils";

export class MigrateEmailTemplates1701353754397 implements MigrationInterface {

    name = 'MigrateEmailTemplates1701353754397';

    /**
    * Up Migration
    *
    * @param queryRunner
    */
    public async up(queryRunner: QueryRunner): Promise<any> {
        console.log(chalk.yellow(this.name + ' start running!'));

        const templates = Object.values(EmailTemplateEnum);
        await Promise.all(
            templates.map(
                async (template: EmailTemplateEnum) => {
                    try {
                        await EmailTemplateUtils.migrateEmailTemplates(queryRunner, template);
                    } catch (error) {
                        console.log(`Error while migrating missing email templates for ${template}`, error);
                    }
                }
            )
        );
    }

    public async down(queryRunner: QueryRunner): Promise<any> { }
}
