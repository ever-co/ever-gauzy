import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { EmailTemplateEnum } from '@gauzy/contracts';
import { EmailTemplateUtils } from '../../email-template/utils';

/** The invitations whose subject names the app again: a user's, an employee's and a team member's. */
const INVITATIONS = [
	EmailTemplateEnum.INVITE_USER,
	EmailTemplateEnum.INVITE_EMPLOYEE,
	EmailTemplateEnum.INVITE_GAUZY_TEAMS
];

/**
 * The subject of the three invitation emails names the app again (`{{appName}}: You have been invited to join ...`),
 * as it did before the redesign (`Welcome to Gauzy ...`).
 *
 * `RedesignDefaultEmailTemplates1791000009150` reads the template files when it runs, so an installation that ran it
 * before this change keeps the subjects without the name: they are written again here. Where both run together, this
 * repeats what the redesign has just written. Only the default rows change, as there (`migrateEmailTemplates`).
 */
export class RestoreAppNameInInvitationEmailSubjects1791000011300 implements MigrationInterface {
	name = 'RestoreAppNameInInvitationEmailSubjects1791000011300';

	public async up(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' start running!'));
		for (const template of INVITATIONS) {
			try {
				await EmailTemplateUtils.migrateEmailTemplates(queryRunner, template);
			} catch (error) {
				console.error(`Error while migrating email templates for ${template}:`, error);
			}
		}
	}

	/** Deliberate no-op: the subjects without the app's name are kept nowhere to go back to. */
	public async down(): Promise<void> {
		return;
	}
}
