import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { EmailTemplateEnum } from '@gauzy/contracts';
import { EmailTemplateUtils } from '../../email-template/utils';

/**
 * The `estimate-answered` email template (to the team member who created an estimate, once the client accepted or
 * declined it), for installations seeded before it existed: a fresh install seeds it with every other template, an
 * existing one gets it here. Idempotent (`migrateEmailTemplates` creates or updates), and a failure is logged rather
 * than raised: without the template the answer still reaches the team in-app, and the send reports the missing one.
 */
export class SeedEstimateAnsweredEmailTemplate1791000008900 implements MigrationInterface {
	name = 'SeedEstimateAnsweredEmailTemplate1791000008900';

	public async up(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' start running!'));
		try {
			await EmailTemplateUtils.migrateEmailTemplates(queryRunner, EmailTemplateEnum.ESTIMATE_ANSWERED);
		} catch (error) {
			console.error(`Error while migrating email templates for ${EmailTemplateEnum.ESTIMATE_ANSWERED}:`, error);
		}
	}

	/** Deliberate no-op: a tenant may have edited the template since. */
	public async down(): Promise<void> {
		return;
	}
}
