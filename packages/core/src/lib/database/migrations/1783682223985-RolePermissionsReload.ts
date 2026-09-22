import { DatabaseTypeEnum } from '@gauzy/config';
import * as chalk from 'chalk';
import { MigrationInterface, QueryRunner } from 'typeorm';
import { RolePermissionUtils } from '../../role-permission/utils';

export class RolePermissionsReload1783682223985 implements MigrationInterface {
	name = 'RolePermissionsReload1783682223985';

	/**
	 * Up Migration
	 *
	 * Reloads default role permissions onto every existing tenant's roles so that
	 * permissions added to the defaults AFTER a tenant was created (e.g. the AI Chat
	 * `AI_CHAT_ACCESS` / `AI_CHAT_SETTINGS` and OAuth client `OAUTH_CLIENT_VIEW` /
	 * `OAUTH_CLIENT_EDIT` permissions) are granted to existing ADMIN / SUPER_ADMIN
	 * (and EMPLOYEE, per defaults) roles. `migrateRolePermissions` only INSERTS
	 * missing role_permission rows (enabled per the current defaults) — it never
	 * disables or removes an existing grant — so it is safe to re-run.
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
	 * @param queryRunner
	 */
	public async down(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' reverting changes!'));
	}
}
