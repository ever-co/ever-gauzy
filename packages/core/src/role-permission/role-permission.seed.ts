// Modified code from https://github.com/alexitaylor/angular-graphql-nestjs-postgres-starter-kit.
// MIT License, see https://github.com/alexitaylor/angular-graphql-nestjs-postgres-starter-kit/blob/master/LICENSE
// Copyright (c) 2019 Alexi Taylor

import { IRole, ITenant, IRolePermission, PermissionsEnum } from '@gauzy/contracts';
import { Connection } from 'typeorm';
import { DEFAULT_ROLE_PERMISSIONS } from './default-role-permissions';
import { RolePermission } from './role-permission.entity';

export const createRolePermissions = async (
	connection: Connection,
	roles: IRole[],
	tenants: ITenant[],
	isDemo: boolean
): Promise<IRolePermission[]> => {
	
	// removed permissions for all users in DEMO mode
	const deniedPermisisons = [
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
					.filter((permission) => isDemo ? !deniedPermisisons.includes(permission) : true)
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
