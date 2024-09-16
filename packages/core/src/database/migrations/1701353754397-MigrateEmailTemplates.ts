import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { EmailTemplateEnum } from '@gauzy/contracts';
import { EmailTemplateUtils } from '../../email-template/utils';

export class MigrateEmailTemplates1701353754397 implements MigrationInterface {
	name = 'MigrateEmailTemplates1701353754397';

	/**
	 * Up Migration
	 *
	 * @param queryRunner
	 */
	public async up(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' start running!'));

		// Migrate email templates for all templates
		const templates = Object.values(EmailTemplateEnum);

		// Iterate over each template and migrate it
		for await (const template of templates) {
			try {
				await EmailTemplateUtils.migrateEmailTemplates(queryRunner, template);
			} catch (error) {
				console.log(`Error while migrating missing email templates for ${template}`, error);
			}
		}
	}

	/**
	 * Down Migration
	 *
	 * @param queryRunner
	 */
	public async down(queryRunner: QueryRunner): Promise<void> {}
}
