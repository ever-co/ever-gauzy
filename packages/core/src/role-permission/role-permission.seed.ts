// Modified code from https://github.com/alexitaylor/angular-graphql-nestjs-postgres-starter-kit.
// MIT License, see https://github.com/alexitaylor/angular-graphql-nestjs-postgres-starter-kit/blob/master/LICENSE
// Copyright (c) 2019 Alexi Taylor

import { DataSource } from 'typeorm';
import { IRole, ITenant, IRolePermission, PermissionsEnum } from '@gauzy/contracts';
import { environment } from '@gauzy/config';
import { DEFAULT_ROLE_PERMISSIONS } from './default-role-permissions';
import { RolePermission } from './role-permission.entity';

/**
 * Creates role permissions for each tenant and role.
 *
 * @param {DataSource} dataSource - The data source to interact with the database.
 * @param {IRole[]} roles - The list of roles to create permissions for.
 * @param {ITenant[]} tenants - The list of tenants for whom to create role permissions.
 */
export const createRolePermissions = async (
	dataSource: DataSource,
	roles: IRole[],
	tenants: ITenant[]
): Promise<void> => {
	// Permissions that should be denied in DEMO mode
	const deniedPermissions = new Set([PermissionsEnum.ACCESS_DELETE_ACCOUNT, PermissionsEnum.ACCESS_DELETE_ALL_DATA]);

	for (const tenant of tenants) {
		const rolePermissions: IRolePermission[] = [];

		// Loop through each default role permission configuration
		for (const { role: roleEnum, defaultEnabledPermissions } of DEFAULT_ROLE_PERMISSIONS) {
			// Find the corresponding role for the current tenant
			const role = roles.find((dbRole: IRole) => dbRole.name === roleEnum && dbRole.tenant.name === tenant.name);

			if (role) {
				// Filter permissions, excluding denied permissions in DEMO mode
				const permissions = environment.demo
					? Object.values(PermissionsEnum).filter((permission) => !deniedPermissions.has(permission))
					: Object.values(PermissionsEnum);

				// Create RolePermission objects and add them to the array
				rolePermissions.push(
					...permissions.map((permission: string) => {
						const rolePermission = new RolePermission();
						rolePermission.role = role;
						rolePermission.permission = permission;
						rolePermission.enabled = defaultEnabledPermissions.includes(permission);
						rolePermission.tenant = tenant;
						return rolePermission;
					})
				);
			}
		}

		// Save all role permissions in one batch for the current tenant
		await dataSource.manager.save(rolePermissions);
	}
};
