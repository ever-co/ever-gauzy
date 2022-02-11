// Modified code from https://github.com/alexitaylor/angular-graphql-nestjs-postgres-starter-kit.
// MIT License, see https://github.com/alexitaylor/angular-graphql-nestjs-postgres-starter-kit/blob/master/LICENSE
// Copyright (c) 2019 Alexi Taylor

import { Connection } from 'typeorm';
import { IRole, ITenant, IRolePermission, PermissionsEnum } from '@gauzy/contracts';
import { isEmpty, isNotEmpty } from '@gauzy/common';
import { v4 as uuidV4 } from 'uuid';
import { DEFAULT_ROLE_PERMISSIONS } from './default-role-permissions';
import { RolePermission } from './role-permission.entity';

export const createRolePermissions = async (
	connection: Connection,
	roles: IRole[],
	tenants: ITenant[],
	isDemo: boolean
): Promise<IRolePermission[]> => {
	
	// removed permissions for all users in DEMO mode
	const deniedPermissions = [
		PermissionsEnum.ACCESS_DELETE_ACCOUNT,
		PermissionsEnum.ACCESS_DELETE_ALL_DATA
	];

	const rolePermissions: IRolePermission[] = [];
	for (const tenant of tenants) {
		DEFAULT_ROLE_PERMISSIONS.forEach(({ role: roleEnum, defaultEnabledPermissions }) => {
			const role = roles.find(
				(dbRole) => dbRole.name === roleEnum && dbRole.tenant.name === tenant.name
			);
			if (role) {
				defaultEnabledPermissions
					.filter((permission) => isDemo ? !deniedPermissions.includes(permission) : true)
					.forEach((permission) => {
						const rolePermission = new RolePermission();
						rolePermission.role = role;
						rolePermission.permission = permission;
						rolePermission.enabled = true;
						rolePermission.tenant = tenant;

						rolePermissions.push(rolePermission);
					});
			}
		});
	}
	return await connection.manager.save(rolePermissions);
};


export const reloadRolePermissions = async (
	connection: Connection,
	isDemo: boolean
) => {
	// removed permissions for all users in DEMO mode
	const deniedPermissions = [
		PermissionsEnum.ACCESS_DELETE_ACCOUNT,
		PermissionsEnum.ACCESS_DELETE_ALL_DATA
	];

	/**
	 * GET all tenants in the system
	 */
	const tenants = await connection.manager.query(`SELECT * FROM tenant`);
	for await (const tenant of tenants) {
		const tenantId = tenant.id;
		/**
		 * GET all roles for specific tenant
		 */
		const roles = await connection.manager.query(`SELECT * FROM "role" WHERE "role"."tenantId" = $1`, [tenantId]);

		for await (const { role: roleEnum, defaultEnabledPermissions } of DEFAULT_ROLE_PERMISSIONS) {
			const permissions = defaultEnabledPermissions.filter(
				(permission) => isDemo ? !deniedPermissions.includes(permission) : true
			);
			const role = roles.find((dbRole) => dbRole.name === roleEnum);
			if (isNotEmpty(permissions)) {
				for await (const permission of permissions) {
					const existPermission = await connection.manager.query(
						`SELECT DISTINCT 
							"distinctAlias"."role_permission_id"
						FROM (
							SELECT 
								"role_permission"."id" AS "role_permission_id",
								"role_permission"."tenantId" AS "role_permission_tenantId",
								"role_permission"."permission" AS "role_permission_permission",
								"role_permission"."roleId" AS "role_permission_roleId"
							FROM "role_permission" "role_permission"
							INNER JOIN "role" "role" 
								ON "role"."id"="role_permission"."roleId" 
							WHERE (
								"role_permission"."tenantId" = $1 AND
								"role_permission"."permission" = $2 AND
								"role"."name" = $3
							)
						) 
						"distinctAlias" ORDER BY "role_permission_id" ASC LIMIT 1`, [
							tenantId,
							permission,
							roleEnum
						]
					);
					if (isEmpty(existPermission) && role) {
						console.log('Unauthorized access blocked permission', {
							permission,
							enabled: true,
							role,
							tenant
						});

						const payload = [
							tenantId,
							permission,
							true,
							role.id
						];
						if (connection.options.type === 'sqlite') {
							payload.push(uuidV4());
							await connection.manager.query(`
								INSERT INTO "role_permission" ("tenantId", "permission", "enabled", "roleId", "id") 
								VALUES($1, $2, $3, $4, $5)`,
								payload
							);
						} else {
							await connection.manager.query(`
								INSERT INTO "role_permission" ("tenantId", "permission", "enabled", "roleId") 
								VALUES($1, $2, $3, $4)`,
								payload
							);
						}
					}
				}
			}
		}
	}
}
