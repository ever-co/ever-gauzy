import { MigrationInterface, QueryRunner } from 'typeorm';
import { yellow } from 'chalk';
import { EmailTemplateEnum } from '@gauzy/contracts';
import { EmailTemplateUtils } from '../../email-template/utils';

export class MigratePasswordResetEmailTemplates1728024420021 implements MigrationInterface {
	name = 'MigratePasswordResetEmailTemplates1728024420021';

	/**
	 * Up Migration
	 *
	 * @param queryRunner
	 */
	public async up(queryRunner: QueryRunner): Promise<void> {
		console.log(yellow(`${this.name} started running!`));

		// Migrate each template
		try {
			await EmailTemplateUtils.migrateEmailTemplates(queryRunner, EmailTemplateEnum.PASSWORD_RESET);
		} catch (error) {
			console.error(`Error while migrating email templates for ${EmailTemplateEnum.PASSWORD_RESET}:`, error);
		}
	}

	/**
	 * Down Migration
	 *
	 * @param queryRunner
	 */
	public async down(queryRunner: QueryRunner): Promise<void> {}
}
