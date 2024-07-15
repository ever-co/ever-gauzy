import { QueryRunner } from 'typeorm';
import { v4 as uuidV4 } from 'uuid';
import * as chalk from 'chalk';
import * as moment from 'moment';
import { DatabaseTypeEnum, environment } from '@gauzy/config';
import { ID, IRole, ITenant, PermissionsEnum, RolesEnum } from '@gauzy/contracts';
import { isNotEmpty } from '@gauzy/common';
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
		// Get all tenants from the database
		const tenants = await this.getAllTenants(queryRunner);

		// Get all permissions, excluding certain ones if in demo mode.
		const permissions = this.getPermissions();

		// Loop through all tenants
		for await (const { id: tenantId, name: tenantName } of tenants) {
			// Get all roles for specific tenant
			const roles = await this.getRolesByTenantId(queryRunner, tenantId);

			// Loop through all roles
			for await (const role of roles) {
				// Get default role permissions
				const { role: roleEnum, defaultEnabledPermissions = [] } = this.getDefaultRolePermissions(role);

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

					// If permission is not existed
					if (!isPermissionExisted) {
						// Log missing permission
						const timestamp = moment().format('DD.MM.YYYY HH:mm:ss');
						const message = `${timestamp} unlocked missing permission for the tenant: ${tenantName}`;
						console.log(chalk.magenta(message, roleEnum, permission));

						// Missing role permission payload for insert into database
						const payload = this.getInsertPayload(
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
	}

	/**
	 * Get all tenants from the database
	 * @param queryRunner - The QueryRunner instance
	 * @returns A promise that resolves to an array of tenants
	 */
	private static async getAllTenants(queryRunner: QueryRunner): Promise<ITenant[]> {
		const query = `SELECT * FROM tenant`;
		return await queryRunner.connection.manager.query(query);
	}

	/**
	 * Get roles by tenant ID
	 * @param queryRunner - The QueryRunner instance
	 * @param tenantId - The tenant ID
	 * @returns A promise that resolves to an array of roles
	 */
	private static async getRolesByTenantId(queryRunner: QueryRunner, tenantId: ID): Promise<IRole[]> {
		const query = `SELECT * FROM "role" WHERE "tenantId" = $1`;
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
		const query = `
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
		`;

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
	private static getInsertPayload(
		queryRunner: QueryRunner,
		tenantId: ID,
		roleId: ID,
		permission: PermissionsEnum,
		isEnabled: boolean
	): any[] {
		const payload = [tenantId, roleId, permission, isEnabled];

		switch (queryRunner.connection.options.type) {
			case DatabaseTypeEnum.sqlite:
			case DatabaseTypeEnum.betterSqlite3:
				payload.push(uuidV4());
				break;
			default:
				break;
		}

		console.log(chalk.magenta(payload));
		return payload;
	}

	/**
	 * Insert role permissions into the database
	 * @param queryRunner - The QueryRunner instance
	 * @param payload - The payload for the insert query
	 */
	private static async insertRolePermissions(queryRunner: QueryRunner, payload: any[]): Promise<void> {
		let query: string;
		switch (queryRunner.connection.options.type) {
			case DatabaseTypeEnum.sqlite:
			case DatabaseTypeEnum.betterSqlite3:
				query = `INSERT INTO "role_permission" ("tenantId", "roleId", "permission", "enabled", "id") VALUES ($1, $2, $3, $4, $5)`;
				await queryRunner.connection.manager.query(query, payload);
				break;
			case DatabaseTypeEnum.postgres:
				query = `INSERT INTO "role_permission" ("tenantId", "roleId", "permission", "enabled") VALUES($1, $2, $3, $4)`;
				await queryRunner.connection.manager.query(query, payload);
				break;
		}
	}
}
