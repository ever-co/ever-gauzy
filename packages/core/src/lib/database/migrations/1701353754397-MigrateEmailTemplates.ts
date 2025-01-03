import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { EmailTemplateEnum } from '@gauzy/contracts';
import { DatabaseTypeEnum } from '@gauzy/config';
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

		switch (queryRunner.connection.options.type) {
			case DatabaseTypeEnum.sqlite:
			case DatabaseTypeEnum.betterSqlite3:
			case DatabaseTypeEnum.postgres:
				await this.sqlitePostgresMigrateEmailTemplates(queryRunner);
				break;
			case DatabaseTypeEnum.mysql:
				await this.mysqlMigrateEmailTemplates(queryRunner);
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
	public async sqlitePostgresMigrateEmailTemplates(queryRunner: QueryRunner): Promise<any> {
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
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlMigrateEmailTemplates(queryRunner: QueryRunner): Promise<any> {}
}
