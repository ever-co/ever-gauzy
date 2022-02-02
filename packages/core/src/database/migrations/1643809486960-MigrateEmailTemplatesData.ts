import { Brackets, MigrationInterface, QueryRunner, SelectQueryBuilder, WhereExpressionBuilder } from "typeorm";
import { createDefaultEmailTemplates } from "./../../email-template/email-template.seed";
import { EmailTemplate } from "./../../core/entities/internal";
    
export class MigrateEmailTemplatesData1643809486960 implements MigrationInterface {

    name = 'MigrateEmailTemplatesData1643809486960';
    
    public async up(queryRunner: QueryRunner): Promise<any> {
        /**
         * Removed default gauzy email templates, again seed them with new one
         */
        const emailTemplates = await queryRunner.connection.getRepository(EmailTemplate).find({
			where: (query: SelectQueryBuilder<EmailTemplate>) => {
				query.andWhere(
					new Brackets((qb: WhereExpressionBuilder) => { 
						qb.andWhere(`"${query.alias}"."organizationId" IS NULL`);
						qb.andWhere(`"${query.alias}"."tenantId" IS NULL`);
					})
				);
			}
		});
        await queryRunner.connection.getRepository(EmailTemplate).remove(emailTemplates);

        /**
         * Reseed all new default email templates
         */
        await createDefaultEmailTemplates(queryRunner.connection);
    }
    
    public async down(queryRunner: QueryRunner): Promise<any> { }
}