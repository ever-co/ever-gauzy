import { MigrationInterface, QueryRunner } from 'typeorm';
import { yellow } from 'chalk';
import { EmailTemplateEnum } from '@gauzy/contracts';
import { EmailTemplateUtils } from '../../email-template/utils';

export class MigrateEmailTemplates1726206783506 implements MigrationInterface {
	name = 'MigrateEmailTemplates1726206783506';

	/**
	 * Up Migration
	 *
	 * @param queryRunner
	 */
	public async up(queryRunner: QueryRunner): Promise<void> {
		console.log(yellow(`${this.name} started running!`));

		// Migrate each template
		try {
			await EmailTemplateUtils.migrateEmailTemplates(queryRunner, EmailTemplateEnum.REJECT_CANDIDATE);
		} catch (error) {
			console.error(`Error while migrating email templates for ${EmailTemplateEnum.REJECT_CANDIDATE}:`, error);
		}
	}

	/**
	 * Down Migration
	 *
	 * @param queryRunner
	 */
	public async down(queryRunner: QueryRunner): Promise<void> {}
}
