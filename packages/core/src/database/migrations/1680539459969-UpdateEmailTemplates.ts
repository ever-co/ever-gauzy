import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { EmailTemplateEnum } from '@gauzy/contracts';
import { DatabaseTypeEnum } from '@gauzy/config';
import { EmailTemplateUtils } from '../../email-template/utils';

export class UpdateEmailTemplates1680539459969 implements MigrationInterface {
	name = 'UpdateEmailTemplates1680539459969';

	/**
	 * Up Migration
	 *
	 * @param queryRunner
	 */
	public async up(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' start running!'));

		switch (queryRunner.connection.options.type) {
			case DatabaseTypeEnum.sqlite:
			case DatabaseTypeEnum.betterSqlite3:
			case DatabaseTypeEnum.postgres:
				await this.sqlitePostgresUpdateEmailTemplates(queryRunner);
				break;
			case DatabaseTypeEnum.mysql:
				await this.mysqlUpdateEmailTemplates(queryRunner);
				break;
			default:
				throw Error(`Unsupported database: ${queryRunner.connection.options.type}`);
		}
	}
	/**
	 * Down Migration
	 *
	 * @param queryRunner
	 */
	public async down(queryRunner: QueryRunner): Promise<void> {}

	/**
	 * Sqlite | better-sqlite3 | postgres Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqlitePostgresUpdateEmailTemplates(queryRunner: QueryRunner): Promise<any> {
		console.log(chalk.yellow(this.name + ' start running!'));

		// Migrate email templates for all templates
		const templates = Object.values(EmailTemplateEnum);

		// Iterate over each template and update it
		for await (const template of templates) {
			try {
				await EmailTemplateUtils.migrateEmailTemplates(queryRunner, template);
			} catch (error) {
				console.log(`Error while migrating missing email templates for ${template}`, error);
			}
		}
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpdateEmailTemplates(queryRunner: QueryRunner): Promise<any> {}
}
