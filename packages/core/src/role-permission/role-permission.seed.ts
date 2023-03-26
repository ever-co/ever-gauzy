// Modified code from https://github.com/alexitaylor/angular-graphql-nestjs-postgres-starter-kit.
// MIT License, see https://github.com/alexitaylor/angular-graphql-nestjs-postgres-starter-kit/blob/master/LICENSE
// Copyright (c) 2019 Alexi Taylor

import { DataSource } from 'typeorm';
import { IRole, ITenant, IRolePermission, PermissionsEnum } from '@gauzy/contracts';
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
