import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { EmailTemplateEnum } from '@gauzy/contracts';
import { EmailTemplateUtils } from '../../email-template/utils';

/**
 * The `invoice-reminder` email template (to the client of an unpaid invoice, before and after its due date), for
 * installations seeded before it existed: a fresh install seeds it with every other template, an existing one gets it
 * here. Idempotent (`migrateEmailTemplates` creates or updates), and a failure is logged rather than raised: the
 * renderer would answer an empty email for a template it cannot find, so the reminder sweep sends nothing while the
 * template is missing, and says so in the log.
 */
export class SeedInvoiceReminderEmailTemplate1791000011930 implements MigrationInterface {
	name = 'SeedInvoiceReminderEmailTemplate1791000011930';

	public async up(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' start running!'));
		try {
			await EmailTemplateUtils.migrateEmailTemplates(queryRunner, EmailTemplateEnum.INVOICE_REMINDER);
		} catch (error) {
			console.error(`Error while migrating email templates for ${EmailTemplateEnum.INVOICE_REMINDER}:`, error);
		}
	}

	/** Deliberate no-op: a tenant may have edited the template since. */
	public async down(): Promise<void> {
		return;
	}
}
