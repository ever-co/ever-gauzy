import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';
import { RolePermissionUtils } from '../../role-permission/utils';

export class RolePermissionsReload1644312012849 implements MigrationInterface {
	name = 'RolePermissionsReload1644312012849';

	/**
	 * Up Migration
	 *
	 * @param queryRunner
	 */
	public async up(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(`${this.constructor.name} start running!`));

		switch (queryRunner.connection.options.type) {
			case DatabaseTypeEnum.sqlite:
			case DatabaseTypeEnum.betterSqlite3:
			case DatabaseTypeEnum.postgres:
				try {
					await RolePermissionUtils.migrateRolePermissions(queryRunner);
				} catch (error) {
					console.log(chalk.red(`Error while migrating missing role permisions: ${error}`));
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
	public async down(queryRunner: QueryRunner): Promise<void> {}
}
