import { QueryRunner } from 'typeorm';
import { v4 as uuidV4 } from 'uuid';
import * as chalk from 'chalk';
import * as moment from 'moment';
import { DatabaseTypeEnum, environment } from '@gauzy/config';
import { ID, IRole, ITenant, PermissionsEnum, RolesEnum } from '@gauzy/contracts';
import { isNotEmpty } from '@gauzy/utils';
import { prepareSQLQuery as p } from '../database/database.helper';
import { replacePlaceholders } from '../core/utils';
import { DEFAULT_ROLE_PERMISSIONS } from './default-role-permissions';

/**
 * Role permissions utils functions.
 */
export class RolePermissionUtils {
	/**
	 * Migrate role permissions
	 * @param queryRunner - The QueryRunner instance
	 */
	public static async migrateRolePermissions(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow('Starting migration of role permissions'));

		// Get all tenants from the database
		const tenants = await this.getAllTenants(queryRunner);
		console.log(chalk.green(`Fetched ${tenants.length} tenants from the database`));

		// Get all permissions, excluding certain ones if in demo mode.
		const permissions = this.getPermissions();
		console.log(chalk.green(`Fetched ${permissions.length} permissions`));

		// Loop through all tenants
		for await (const { id: tenantId, name: tenantName } of tenants) {
			console.log(chalk.blue(`Processing tenant: ${tenantName} (${tenantId})`));

			// Get all roles for specific tenant
			const roles = await this.getRolesByTenantId(queryRunner, tenantId);
			console.log(chalk.green(`Fetched ${roles.length} roles for tenant: ${tenantName}`));

			// Loop through all roles
			for await (const role of roles) {
				// Get default role permissions
				const defaultRolePermissions = this.getDefaultRolePermissions(role);
				const { role: roleEnum, defaultEnabledPermissions = [] } = defaultRolePermissions || {};
				console.log(chalk.blue(`Processing role: ${role.name} (${role.id})`));

				// Get role ID
				const roleId = role.id;

				// Loop through all permissions
				for await (const permission of permissions) {
					// Check permission existence
					const isPermissionExisted = await this.checkPermissionExistence(
						queryRunner,
						tenantId,
						roleId,
						permission
					);

					// If permission does not exist
					if (!isPermissionExisted) {
						// Log missing permission
						const timestamp = moment().format('DD.MM.YYYY HH:mm:ss');
						const message = `${timestamp} unlocked missing permission for the tenant: ${tenantName}`;
						console.log(chalk.magenta(message, roleEnum, permission));

						// Missing role permission payload for insert into database
						const payload = await this.getInsertPayload(
							queryRunner,
							tenantId,
							roleId,
							permission,
							defaultEnabledPermissions.includes(permission)
						);

						// Insert role permission into database
						await this.insertRolePermissions(queryRunner, payload);
					}
				}
			}
		}

		console.log(chalk.yellow('Completed migration of role permissions'));
	}

	/**
	 * Get all tenants from the database
	 * @param queryRunner - The QueryRunner instance
	 * @returns A promise that resolves to an array of tenants
	 */
	private static async getAllTenants(queryRunner: QueryRunner): Promise<ITenant[]> {
		const query = p(`SELECT * FROM "tenant"`);
		return await queryRunner.connection.manager.query(query);
	}

	/**
	 * Get roles by tenant ID
	 * @param queryRunner - The QueryRunner instance
	 * @param tenantId - The tenant ID
	 * @returns A promise that resolves to an array of roles
	 */
	private static async getRolesByTenantId(queryRunner: QueryRunner, tenantId: ID): Promise<IRole[]> {
		let query = p(`SELECT * FROM "role" WHERE "tenantId" = $1`);
		query = replacePlaceholders(query, queryRunner.connection.options.type as DatabaseTypeEnum);

		return await queryRunner.connection.manager.query(query, [tenantId]);
	}

	/**
	 * Get all permissions, excluding certain ones if in demo mode.
	 * @returns An array of permissions.
	 */
	private static getPermissions(): PermissionsEnum[] {
		/** Permissions to exclude for all users in DEMO mode */
		const excludePermissions: PermissionsEnum[] = [
			PermissionsEnum.ACCESS_DELETE_ACCOUNT,
			PermissionsEnum.ACCESS_DELETE_ALL_DATA
		];

		// Log the current mode (demo or not)
		console.log(chalk.yellow(`Environment demo mode: ${environment.demo}`));

		// Log the excluded permissions if in demo mode
		if (environment.demo) {
			console.log(chalk.red('Excluding permissions:'), chalk.redBright(JSON.stringify(excludePermissions)));
		}

		// If in demo mode, exclude certain permissions
		return environment.demo
			? Object.values(PermissionsEnum).filter((permission) => !excludePermissions.includes(permission))
			: Object.values(PermissionsEnum);
	}

	/**
	 * Get default role permissions
	 * @param role - The role
	 * @returns The default role permissions
	 */
	private static getDefaultRolePermissions(role: IRole):
		| {
				role: RolesEnum;
				defaultEnabledPermissions: PermissionsEnum[];
		  }
		| undefined {
		return DEFAULT_ROLE_PERMISSIONS.find((defaultRole) => role.name === defaultRole.role);
	}

	/**
	 * Check if the permission already exists
	 * @param queryRunner - The QueryRunner instance
	 * @param tenantId - The tenant ID
	 * @param roleId - The role ID
	 * @param permission - The permission enum value
	 * @returns A promise that resolves to a boolean indicating if the permission exists
	 */
	private static async checkPermissionExistence(
		queryRunner: QueryRunner,
		tenantId: ID,
		roleId: ID,
		permission: PermissionsEnum
	): Promise<boolean> {
		const dbType = queryRunner.connection.options.type as DatabaseTypeEnum;
		let query = p(`
			SELECT DISTINCT
				"distinctAlias"."role_permission_id"
			FROM (
				SELECT
					"role_permission"."id" AS "role_permission_id",
					"role_permission"."tenantId" AS "role_permission_tenantId",
					"role_permission"."permission" AS "role_permission_permission",
					"role_permission"."roleId" AS "role_permission_roleId"
				FROM
					"role_permission" "role_permission"
				INNER JOIN "role" "role"
					ON "role"."id" = "role_permission"."roleId"
				WHERE (
					"role_permission"."tenantId" = $1 AND
					"role_permission"."permission" = $2 AND
					"role_permission"."roleId" = $3 AND
					"role"."tenantId" = $4 AND
					"role"."id" = $5
				)
			)
			"distinctAlias" ORDER BY "role_permission_id" ASC LIMIT 1
		`);
		query = replacePlaceholders(query, dbType);

		const result = await queryRunner.connection.manager.query(query, [
			tenantId,
			permission,
			roleId,
			tenantId,
			roleId
		]);

		return isNotEmpty(result);
	}

	/**
	 * Get insert payload for role permission
	 * @param queryRunner - The QueryRunner instance
	 * @param tenantId - The tenant ID
	 * @param roleId - The role ID
	 * @param permission - The permission enum value
	 * @param isEnabled - Boolean indicating if the permission is enabled
	 * @returns The payload array for the insert query
	 */
	private static async getInsertPayload(
		queryRunner: QueryRunner,
		tenantId: ID,
		roleId: ID,
		permission: PermissionsEnum,
		isEnabled: boolean
	): Promise<any[]> {
		const dbType = queryRunner.connection.options.type as DatabaseTypeEnum;
		const payload = [tenantId, roleId, permission, isEnabled ? 1 : 0];

		// Add UUID for specific database types
		if (
			dbType === DatabaseTypeEnum.sqlite ||
			dbType === DatabaseTypeEnum.betterSqlite3 ||
			dbType === DatabaseTypeEnum.mysql
		) {
			payload.push(uuidV4());
		}

		return payload;
	}

	/**
	 * Insert role permissions into the database
	 * @param queryRunner - The QueryRunner instance
	 * @param payload - The payload for the insert query
	 */
	private static async insertRolePermissions(queryRunner: QueryRunner, payload: any[]): Promise<void> {
		const dbType = queryRunner.connection.options.type as DatabaseTypeEnum;
		let query: string;

		switch (dbType) {
			case DatabaseTypeEnum.sqlite:
			case DatabaseTypeEnum.betterSqlite3:
			case DatabaseTypeEnum.mysql:
				query = p(
					`INSERT INTO "role_permission" ("tenantId", "roleId", "permission", "enabled", "id") VALUES (?, ?, ?, ?, ?)`
				);
				break;
			case DatabaseTypeEnum.postgres:
				query = p(
					`INSERT INTO "role_permission" ("tenantId", "roleId", "permission", "enabled") VALUES($1, $2, $3, $4)`
				);
				break;
			default:
				console.log(chalk.red('Unsupported database type'));
				break;
		}

		query = replacePlaceholders(query, dbType);
		console.log(chalk.yellow(`Insert Query: ${query}`));
		await queryRunner.connection.manager.query(query, payload);
		console.log(chalk.green(`Inserted role permission for ${dbType}:`, payload));
	}
}
