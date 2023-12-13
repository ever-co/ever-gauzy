import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from "chalk";
import { RolePermissionUtils } from './../../role-permission/utils';

export class RolePermissionsReload1644312012849 implements MigrationInterface {
	name = 'RolePermissionsReload1644312012849';

	public async up(queryRunner: QueryRunner): Promise<any> {
		console.log(chalk.yellow(this.name + ' start running!'));

		try {
			await RolePermissionUtils.migrateRolePermissions(queryRunner);
		} catch (error) {
			console.log(`Error while migrating missing role permisions`, error);
		}
	}

	public async down(queryRunner: QueryRunner): Promise<any> { }
}
