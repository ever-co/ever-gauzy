// Modified code from https://github.com/alexitaylor/angular-graphql-nestjs-postgres-starter-kit. 
// MIT License, see https://github.com/alexitaylor/angular-graphql-nestjs-postgres-starter-kit/blob/master/LICENSE
// Copyright (c) 2019 Alexi Taylor

import { Connection } from "typeorm";
import { Role, RolesEnum } from '../../role';

export const createRoles = async (connection: Connection): Promise<Role[]> => {
  const roles: Role[] = [];

  const rolesName = Object.values(RolesEnum);

  for (const name of rolesName) {
    const role = new Role();
    role.name = name;

    await connection.createQueryBuilder().insert().into(Role).values(role).execute();
    roles.push(role);
  }

  return roles;
};
