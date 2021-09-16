// Modified code from https://github.com/alexitaylor/angular-graphql-nestjs-postgres-starter-kit.
// MIT License, see https://github.com/alexitaylor/angular-graphql-nestjs-postgres-starter-kit/blob/master/LICENSE
// Copyright (c) 2019 Alexi Taylor

import { Connection } from 'typeorm';
import { Role } from './role.entity';
import { IRole, ITenant, RolesEnum } from '@gauzy/contracts';

export const createRoles = async (
	connection: Connection,
	tenants: ITenant[]
): Promise<IRole[]> => {
	try {
		const roles: IRole[] = [];
		for (const tenant of tenants) {
			for (const name of Object.values(RolesEnum)) {
				const role = new Role();
				role.name = name;
				role.tenant = tenant;
				roles.push(role);
			}
		}
		return await connection.manager.save(roles);
	} catch (error) {
		console.log({error})
	}
};
