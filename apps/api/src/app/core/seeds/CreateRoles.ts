// Modified code from https://github.com/alexitaylor/angular-graphql-nestjs-postgres-starter-kit. 
// MIT License, see https://github.com/alexitaylor/angular-graphql-nestjs-postgres-starter-kit/blob/master/LICENSE
// Copyright (c) 2019 Alexi Taylor

import { Connection } from "typeorm";
import { Role, RolesEnum } from '../../role';

export const createRoles = async (connection: Connection): Promise<Role[]> => {
  const roles: Role[] = [];

  const roleAdmin = new Role();
  roleAdmin.name = RolesEnum.ADMIN;

  await connection.createQueryBuilder().insert().into(Role).values(roleAdmin).execute();
  roles.push(roleAdmin);

  const roleDataEntry = new Role();
  roleDataEntry.name = RolesEnum.DATA_ENTRY;

  await connection.createQueryBuilder().insert().into(Role).values(roleDataEntry).execute();
  roles.push(roleDataEntry);

  const roleEmployee = new Role();
  roleEmployee.name = RolesEnum.EMPLOYEE;

  await connection.createQueryBuilder().insert().into(Role).values(roleEmployee).execute();
  roles.push(roleEmployee);

  return roles;
};
