import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { EmailTemplateEnum } from '@gauzy/contracts';
import { EmailTemplateUtils } from '../../email-template/utils';

export class MigrateEmailTemplatesData1643809486960 implements MigrationInterface {
	name = 'MigrateEmailTemplatesData1643809486960';

	/**
	 * Up Migration
	 *
	 * @param queryRunner
	 */
	public async up(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' start running!'));

		// Migrate email templates for all templates
		const templates = Object.values(EmailTemplateEnum);

		// Iterate over each template and migrate the data
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
