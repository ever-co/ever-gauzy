import { DEFAULT_GLOBAL_ISSUE_TYPES } from './../../tasks/issue-type/default-global-issue-types';
import { v4 as uuidV4 } from 'uuid';
import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedDafaultGlobalIssueType1680622389221
	implements MigrationInterface
{
	name = 'SeedDafaultGlobalIssueType1680622389221';

	/**
	 * Up Migration
	 *
	 * @param queryRunner
	 */
	public async up(queryRunner: QueryRunner): Promise<any> {
		await this.seedDefaultIssueTypes(queryRunner);
	}

	/**
	 * Down Migration
	 *
	 * @param queryRunner
	 */
	public async down(queryRunner: QueryRunner): Promise<any> {}

	/**
	 * Default global issue types
	 *
	 * @param queryRunner
	 */
	async seedDefaultIssueTypes(queryRunner: QueryRunner) {
		try {
			for await (const issueType of DEFAULT_GLOBAL_ISSUE_TYPES) {
				const payload = Object.values(issueType);

				if (queryRunner.connection.options.type === 'sqlite') {
					payload.push(uuidV4());
					const query = `INSERT INTO "issue_type" ("name", "value", "description", "icon", "color", "isSystem", "id") VALUES($1, $2, $3, $4, $5, $6, $7)`;
					await queryRunner.connection.manager.query(query, payload);
				} else {
					const query = `INSERT INTO "issue_type" ("name", "value", "description", "icon", "color", "isSystem") VALUES($1, $2, $3, $4, $5, $6)`;
					await queryRunner.connection.manager.query(query, payload);
				}
			}
		} catch (error) {
			// since we have errors let's rollback changes we made
			console.log(
				'Error while insert default global issue types in production server',
				error
			);
		}
	}
}
