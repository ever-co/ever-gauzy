// Modified code from https://github.com/alexitaylor/angular-graphql-nestjs-postgres-starter-kit.
// MIT License, see https://github.com/alexitaylor/angular-graphql-nestjs-postgres-starter-kit/blob/master/LICENSE
// Copyright (c) 2019 Alexi Taylor

import { DataSource } from 'typeorm';
import { IRole, ITenant, IRolePermission, PermissionsEnum } from '@gauzy/contracts';
import { isEmpty, isNotEmpty } from '@gauzy/common';
import { v4 as uuidV4 } from 'uuid';
import { environment } from '@gauzy/config'
import { DEFAULT_ROLE_PERMISSIONS } from './default-role-permissions';
import { RolePermission } from './role-permission.entity';

export const createRolePermissions = async (
	dataSource: DataSource,
	roles: IRole[],
	tenants: ITenant[]
) => {

	// removed permissions for all users in DEMO mode
	const deniedPermissions = [
		PermissionsEnum.ACCESS_DELETE_ACCOUNT,
		PermissionsEnum.ACCESS_DELETE_ALL_DATA
	];

	for (const tenant of tenants) {
		const rolePermissions: IRolePermission[] = [];
		DEFAULT_ROLE_PERMISSIONS.forEach(({ role: roleEnum, defaultEnabledPermissions }) => {
			const role = roles.find(
				(dbRole: IRole) => dbRole.name === roleEnum && dbRole.tenant.name === tenant.name
			);
			if (role) {
				const permissions = Object.values(PermissionsEnum).filter(
					(permission: PermissionsEnum) => environment.demo ? !deniedPermissions.includes(permission) : true
				);
				for (const permission of permissions) {
					const rolePermission = new RolePermission();
					rolePermission.role = role;
					rolePermission.permission = permission;
					rolePermission.enabled = defaultEnabledPermissions.includes(permission);
					rolePermission.tenant = tenant;
					rolePermissions.push(rolePermission);
				}
			}
		});
		await dataSource.manager.save(rolePermissions);
	}
};


export const reloadRolePermissions = async (dataSource: DataSource) => {
	// removed permissions for all users in DEMO mode
	const deniedPermissions = [
		PermissionsEnum.ACCESS_DELETE_ACCOUNT,
		PermissionsEnum.ACCESS_DELETE_ALL_DATA
	];

	/**
	 * GET all tenants in the system
	 */
	const tenants = await dataSource.manager.query(`SELECT * FROM tenant`);
	for await (const tenant of tenants) {
		const tenantId = tenant.id;
		/**
		 * GET all roles for specific tenant
		 */
		const roles = await dataSource.manager.query(`SELECT * FROM "role" WHERE "role"."tenantId" = $1`, [tenantId]);

		for await (const { role: roleEnum, defaultEnabledPermissions } of DEFAULT_ROLE_PERMISSIONS) {
			const permissions = defaultEnabledPermissions.filter(
				(permission: PermissionsEnum) => environment.demo ? !deniedPermissions.includes(permission) : true
			);
			const role = roles.find((dbRole: IRole) => dbRole.name === roleEnum);
			if (isNotEmpty(permissions)) {
				for await (const permission of permissions) {
					const existPermission = await dataSource.manager.query(
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
						if (dataSource.options.type === 'sqlite') {
							payload.push(uuidV4());
							await dataSource.manager.query(`
								INSERT INTO "role_permission" ("tenantId", "permission", "enabled", "roleId", "id")
								VALUES($1, $2, $3, $4, $5)`,
								payload
							);
						} else {
							await dataSource.manager.query(`
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
