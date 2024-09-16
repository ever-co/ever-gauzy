import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { EmailTemplateEnum } from '@gauzy/contracts';
import { EmailTemplateUtils } from '../../email-template/utils';

export class EmailTemplateReader1678876700413 implements MigrationInterface {
	name = 'EmailTemplateReader1678876700413';

	/**
	 * Up Migration
	 *
	 * @param queryRunner
	 */
	public async up(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' start running!'));

		try {
			await EmailTemplateUtils.migrateEmailTemplates(queryRunner, EmailTemplateEnum.EMAIL_RESET);
		} catch (error) {
			console.log(`Error while migrating missing email templates for ${EmailTemplateEnum.EMAIL_RESET}`, error);
		}

		try {
			await EmailTemplateUtils.migrateEmailTemplates(
				queryRunner,
				EmailTemplateEnum.ORGANIZATION_TEAM_JOIN_REQUEST
			);
		} catch (error) {
			console.log(
				`Error while migrating missing email templates for ${EmailTemplateEnum.ORGANIZATION_TEAM_JOIN_REQUEST}`,
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
