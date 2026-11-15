import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { EmailTemplateEnum } from '@gauzy/contracts';
import { EmailTemplateUtils } from '../../email-template/utils';

/** The appointment notice `EmailService.sendAppointmentMail` sends: the one template folder the enum does not list. */
const APPOINTMENT_EMAIL = 'email-appointment' as EmailTemplateEnum;

/**
 * The redesigned default email templates (one layout for all of them: logo, card, one action, footer), for
 * installations seeded with the earlier ones: a fresh install seeds the new files, an existing one gets them here.
 *
 * Only the default rows change (`tenantId` and `organizationId` NULL). A template a tenant or an organization saved
 * for itself in the editor is its own and stays as it is. Idempotent (`migrateEmailTemplates` creates or updates),
 * and a failure is logged rather than raised: a template that could not be written keeps its earlier design.
 */
export class RedesignDefaultEmailTemplates1791000009150 implements MigrationInterface {
	name = 'RedesignDefaultEmailTemplates1791000009150';

	public async up(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' start running!'));
		for (const template of [...Object.values(EmailTemplateEnum), APPOINTMENT_EMAIL]) {
			try {
				await EmailTemplateUtils.migrateEmailTemplates(queryRunner, template);
			} catch (error) {
				console.error(`Error while migrating email templates for ${template}:`, error);
			}
		}
	}

	/** Deliberate no-op: the earlier design is kept nowhere to go back to. */
	public async down(): Promise<void> {
		return;
	}
}
