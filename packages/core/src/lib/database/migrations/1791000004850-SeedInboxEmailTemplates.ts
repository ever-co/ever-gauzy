import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { EmailTemplateEnum } from '@gauzy/contracts';
import { EmailTemplateUtils } from '../../email-template/utils';

/**
 * The email templates of the Inbox's notification delivery (`inbox-notification`, `inbox-digest`; the Inbox spec
 * FR-12), for installations seeded before they existed: a fresh install seeds them with every other template, an
 * existing one gets them here. Idempotent (`migrateEmailTemplates` creates or updates), and a failure is logged
 * rather than raised: a template that could not be written is one the delivery plugin reports when it sends.
 */
export class SeedInboxEmailTemplates1791000004850 implements MigrationInterface {
	name = 'SeedInboxEmailTemplates1791000004850';

	public async up(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' start running!'));
		for (const template of [EmailTemplateEnum.INBOX_NOTIFICATION, EmailTemplateEnum.INBOX_DIGEST]) {
			try {
				await EmailTemplateUtils.migrateEmailTemplates(queryRunner, template);
			} catch (error) {
				console.error(`Error while migrating email templates for ${template}:`, error);
			}
		}
	}

	/** Deliberate no-op: the templates are inert without the delivery plugin, and a tenant may have edited them. */
	public async down(): Promise<void> {
		return;
	}
}
