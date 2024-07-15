import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { RolePermissionUtils } from '../../role-permission/utils';
import { DatabaseTypeEnum } from '@gauzy/config';

export class MigrateRolePermisisons1679765443208 implements MigrationInterface {
	name = 'MigrateRolePermisisons1679765443208';

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
			case DatabaseTypeEnum.mysql:
				try {
					await RolePermissionUtils.migrateRolePermissions(queryRunner);
				} catch (error) {
					console.log(chalk.red(`Error while migrating missing role permisions: ${error}`));
				}
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
