import { DEFAULT_GLOBAL_ISSUE_TYPES } from './../../tasks/issue-type/default-global-issue-types';
import { getConfig } from '@gauzy/config';
import { MigrationInterface, QueryRunner } from 'typeorm';
import { copyEverIcons } from './../../core/seeds/utils';

export class SeedIssueTypeIcon1680623178558 implements MigrationInterface {
	config = getConfig();
	name = 'SeedIssueTypeIcon1680623178558';

	/**
	 * Up Migration
	 *
	 * @param queryRunner
	 */
	public async up(queryRunner: QueryRunner): Promise<any> {
		await this.seedIssueTypeIcon(queryRunner);
	}

	/**
	 * Down Migration
	 *
	 * @param queryRunner
	 */
	public async down(queryRunner: QueryRunner): Promise<any> {}

	/**
	 *
	 * @param queryRunner
	 */
	async seedIssueTypeIcon(queryRunner: QueryRunner) {
		try {
			for await (const issueType of DEFAULT_GLOBAL_ISSUE_TYPES) {
				const { name, value, icon, color } = issueType;
				const filepath = `ever-icons/${icon}`;

				const query = `UPDATE "issue_type" SET "icon" = '${filepath}', "color" = '${color}' WHERE ("name" = $1 AND "value" = $2) AND ("tenantId" IS NULL AND "organizationId" IS NULL)`;
				await queryRunner.connection.manager.query(query, [name, value]);
				copyEverIcons(issueType.icon, this.config);
			}
		} catch (error) {
			// since we have errors let's rollback changes we made
			console.log('Error while updating issue types icon & color in production server', error);
		}
	}
}
