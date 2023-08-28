
import { MigrationInterface, QueryRunner } from "typeorm";
import { EmailTemplateEnum } from '@gauzy/contracts';
import { EmailTemplateUtils } from './../../email-template/utils';

export class UpdateEmailTemplates1680539459969 implements MigrationInterface {

    name = 'UpdateEmailTemplates1680539459969';

    /**
    * Up Migration
    *
    * @param queryRunner
    */
    public async up(queryRunner: QueryRunner): Promise<any> {
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

    /**
    * Down Migration
    *
    * @param queryRunner
    */
    public async down(queryRunner: QueryRunner): Promise<any> {

    }
}
