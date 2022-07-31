import { MigrationInterface, QueryRunner, SelectQueryBuilder } from "typeorm";
import { createDefaultEmailTemplates } from "./../../email-template/email-template.seed";
import { EmailTemplate } from "./../../core/entities/internal";

export class MigrateEmailTemplatesData1643809486960 implements MigrationInterface {

    name = 'MigrateEmailTemplatesData1643809486960';

    public async up(queryRunner: QueryRunner): Promise<any> {
        /**
         * Removed default gauzy email templates, again seed them with new one
         */
        const query = queryRunner.connection.createQueryBuilder(EmailTemplate, 'email_template');
        query.where((qb: SelectQueryBuilder<EmailTemplate>) => {
            qb.andWhere(`"${qb.alias}"."organizationId" IS NULL`);
            qb.andWhere(`"${qb.alias}"."tenantId" IS NULL`);
        });
        const emailTemplates = await query.getMany();
        await queryRunner.connection.getRepository(EmailTemplate).remove(emailTemplates);

        /**
         * Reseed all new default email templates
         */
        await createDefaultEmailTemplates(queryRunner.connection);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {}
}