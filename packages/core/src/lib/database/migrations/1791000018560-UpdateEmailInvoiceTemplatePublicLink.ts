import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { EmailTemplateEnum } from '@gauzy/contracts';
import { EmailTemplateUtils } from '../../email-template/utils';

/**
 * The `email-invoice` template with its "View the invoice" button, which opens the invoice's public page, for
 * installations seeded before the email linked to it: a fresh install seeds the new files, an existing one gets them
 * here.
 *
 * Only the default rows change (`tenantId` and `organizationId` NULL). A template a tenant or an organization saved for
 * itself in the editor is its own and stays as it is. Idempotent (`migrateEmailTemplates` creates or updates), and a
 * failure is logged rather than raised: the invoice email then goes without the button, as before.
 */
export class UpdateEmailInvoiceTemplatePublicLink1791000018560 implements MigrationInterface {
	name = 'UpdateEmailInvoiceTemplatePublicLink1791000018560';

	public async up(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' start running!'));
		try {
			await EmailTemplateUtils.migrateEmailTemplates(queryRunner, EmailTemplateEnum.EMAIL_INVOICE);
		} catch (error) {
			console.error(`Error while migrating email templates for ${EmailTemplateEnum.EMAIL_INVOICE}:`, error);
		}
	}

	/** Deliberate no-op: the button only shows when the email carries a link, and a tenant may have edited it since. */
	public async down(): Promise<void> {
		return;
	}
}
