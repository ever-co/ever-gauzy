import { DatabaseTypeEnum } from '@gauzy/config';
import * as chalk from 'chalk';
import { MigrationInterface, QueryRunner } from 'typeorm';
import { RolePermissionUtils } from '../../role-permission/utils';

export class DocumentsRolePermissionsReload1790000003000 implements MigrationInterface {
	name = 'DocumentsRolePermissionsReload1790000003000';

	/**
	 * Up Migration
	 *
	 * Reloads default role permissions onto every existing tenant's roles so that the
	 * Documents permissions added to the defaults (`DOCS_READ`, `DOCS_CREATE`,
	 * `DOCS_UPDATE`, `DOCS_DELETE`, `DOCS_MANAGE`, `DOCS_REVIEW`, `DOCS_AI_IMPORT`)
	 * are granted to existing roles per `DEFAULT_ROLE_PERMISSIONS`.
	 * `migrateRolePermissions` only INSERTS missing role_permission rows (enabled per
	 * the current defaults) — it never disables or removes an existing grant — so it is
	 * safe to re-run. New tenants get the rows through the normal seeded path.
	 *
	 * @param queryRunner
	 */
	public async up(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' start running!'));

		switch (queryRunner.connection.options.type as DatabaseTypeEnum) {
			case DatabaseTypeEnum.sqlite:
			case DatabaseTypeEnum.betterSqlite3:
			case DatabaseTypeEnum.postgres:
				try {
					await RolePermissionUtils.migrateRolePermissions(queryRunner);
				} catch (error) {
					console.log(chalk.red(`Error while migrating missing role permissions: ${error}`));
				}
				break;
			case DatabaseTypeEnum.mysql:
				console.log('role permission migration is not supported for mysql yet');
				break;
			default:
				throw Error(`Unsupported database: ${queryRunner.connection.options.type}`);
		}
	}

	/**
	 * Down Migration
	 *
	 * Deliberate no-op: removing permission rows would destroy tenant customizations;
	 * the `FEATURE_DOCUMENTS` feature flag is the rollback lever for the feature.
	 *
	 * @param queryRunner
	 */
	public async down(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' reverting changes!'));
	}
}
