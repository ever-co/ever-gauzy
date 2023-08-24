
import { MigrationInterface, QueryRunner } from "typeorm";
import { EmailTemplateNameEnum } from '@gauzy/contracts';
import { EmailTemplateUtils } from './../../email-template/utils';

export class EmailTemplateReader1678876700413 implements MigrationInterface {

    name = 'EmailTemplateReader1678876700413';

    /**
    * Up Migration
    *
    * @param queryRunner
    */
    public async up(queryRunner: QueryRunner): Promise<any> {
        try {
            await EmailTemplateUtils.migrateEmailTemplates(
                queryRunner,
                EmailTemplateNameEnum.EMAIL_RESET
            );
        } catch (error) {
            console.log(`Error while migrating missing email templates for ${EmailTemplateNameEnum.EMAIL_RESET}`, error);
        }
        try {
            await EmailTemplateUtils.migrateEmailTemplates(
                queryRunner,
                EmailTemplateNameEnum.ORGANIZATION_TEAM_JOIN_REQUEST
            );
        } catch (error) {
            console.log(`Error while migrating missing email templates for ${EmailTemplateNameEnum.ORGANIZATION_TEAM_JOIN_REQUEST}`, error);
        }
    }

    /**
    * Down Migration
    *
    * @param queryRunner
    */
    public async down(queryRunner: QueryRunner): Promise<any> { }
}
