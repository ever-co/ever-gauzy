// Modified code from https://github.com/alexitaylor/angular-graphql-nestjs-postgres-starter-kit.
// MIT License, see https://github.com/alexitaylor/angular-graphql-nestjs-postgres-starter-kit/blob/master/LICENSE
// Copyright (c) 2019 Alexi Taylor

import { IRole, ITenant, IRolePermission } from '@gauzy/models';
import { Connection } from 'typeorm';
import { DEFAULT_ROLE_PERMISSIONS } from './default-role-permissions';
import { RolePermissions } from './role-permissions.entity';

export const createRolePermissions = async (
	connection: Connection,
	roles: IRole[],
	tenants: ITenant[]
): Promise<IRolePermission[]> => {
	const rolePermissions: IRolePermission[] = [];

	tenants.forEach((t) => {
		DEFAULT_ROLE_PERMISSIONS.forEach((r) => {
			const role = roles.find(
				(dbRole) =>
					dbRole.name === r.role && dbRole.tenant.name === t.name
			);
			if (role) {
				r.defaultEnabledPermissions.forEach((p) => {
					const rolePermission = new RolePermissions();
					rolePermission.roleId = role.id;
					rolePermission.permission = p;
					rolePermission.enabled = true;
					rolePermission.tenant = role.tenant;
					rolePermissions.push(rolePermission);
				});
			}
		});
	});

	return await connection.manager.save(rolePermissions);
};
