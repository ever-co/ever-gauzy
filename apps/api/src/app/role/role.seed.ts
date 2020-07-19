// Modified code from https://github.com/alexitaylor/angular-graphql-nestjs-postgres-starter-kit.
// MIT License, see https://github.com/alexitaylor/angular-graphql-nestjs-postgres-starter-kit/blob/master/LICENSE
// Copyright (c) 2019 Alexi Taylor

import { Connection } from 'typeorm';
import { Role } from './role.entity';
import { RolesEnum } from '@gauzy/models';
import { Tenant } from '../tenant/tenant.entity';

export const createRoles = async (
	connection: Connection,
	tenants: Tenant[]
): Promise<Role[]> => {
	const roles: Role[] = [];
	const rolesNames = Object.values(RolesEnum);

	tenants.forEach((tenant) => {
		for (const name of rolesNames) {
			const role = new Role();
			role.name = name;
			role.tenant = tenant;
			roles.push(role);
		}
	});

	await connection
		.createQueryBuilder()
		.insert()
		.into(Role)
		.values(roles)
		.execute();

	return roles;
};
