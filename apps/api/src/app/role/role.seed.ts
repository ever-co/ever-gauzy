// Modified code from https://github.com/alexitaylor/angular-graphql-nestjs-postgres-starter-kit. 
// MIT License, see https://github.com/alexitaylor/angular-graphql-nestjs-postgres-starter-kit/blob/master/LICENSE
// Copyright (c) 2019 Alexi Taylor

import { Connection } from 'typeorm';
import { Role } from './role.entity';
import { RolesEnum } from '@gauzy/models';

export const createRoles = async (connection: Connection): Promise<Role[]> => {
    const roles: Role[] = [];
    const rolesNames = Object.values(RolesEnum);

    for (const name of rolesNames) {
        const role = new Role();
        role.name = name;

        await connection
            .createQueryBuilder()
            .insert()
            .into(Role)
            .values(role)
            .execute();

        roles.push(role);
    }

    return roles;
};
