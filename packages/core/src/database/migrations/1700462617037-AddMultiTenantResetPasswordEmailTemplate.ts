import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { EmailTemplateEnum } from '@gauzy/contracts';
import { EmailTemplateUtils } from '../../email-template/utils';

export class AddMultiTenantResetPasswordEmailTemplate1700462617037 implements MigrationInterface {
	name = 'AddMultiTenantResetPasswordEmailTemplate1700462617037';

	/**
	 * Up Migration
	 *
	 * @param queryRunner
	 */
	public async up(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' start running!'));
		// Migrate email templates for multi-tenant password reset
		try {
			await EmailTemplateUtils.migrateEmailTemplates(queryRunner, EmailTemplateEnum.MULTI_TENANT_PASSWORD_RESET);
		} catch (error) {
			console.log(
				`Error while migrating missing email templates for ${EmailTemplateEnum.MULTI_TENANT_PASSWORD_RESET}`,
				error
			);
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
			console.log(
				`Error while migrating missing email templates for ${EmailTemplateEnum.PASSWORD_LESS_AUTHENTICATION}`,
				error
			);
		}
	}

	/**
	 * Down Migration
	 *
	 * @param queryRunner
	 */
	public async down(queryRunner: QueryRunner): Promise<void> {}
}
