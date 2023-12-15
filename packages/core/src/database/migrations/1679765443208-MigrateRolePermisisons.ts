import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from "chalk";
import { RolePermissionUtils } from './../../role-permission/utils';

export class MigrateRolePermisisons1679765443208 implements MigrationInterface {
	name = 'MigrateRolePermisisons1679765443208';

	/**
	 * Up Migration
	 *
	 * @param queryRunner
	 */
	public async up(queryRunner: QueryRunner): Promise<any> {
		console.log(chalk.yellow(this.name + ' start running!'));

		try {
			await RolePermissionUtils.migrateRolePermissions(queryRunner);
		} catch (error) {
			console.log(`Error while migrating missing role permisions`, error);
		}
	}

	/**
	 * Down Migration
	 *
	 * @param queryRunner
	 */
	public async down(queryRunner: QueryRunner): Promise<any> { }
}
