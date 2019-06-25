// Modified code from https://github.com/alexitaylor/angular-graphql-nestjs-postgres-starter-kit. 
// MIT License, see https://github.com/alexitaylor/angular-graphql-nestjs-postgres-starter-kit/blob/master/LICENSE
// Copyright (c) 2019 Alexi Taylor

import { Connection } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { environment as env } from '@env-api/environment'
import { Role, RolesEnum } from '../../role';
import { User } from '../../user';

export const seedDefaultUsers = async (
  connection: Connection,
  roles: Role[],
): Promise<User[]> => {
  const users: User[] = [];

  const adminRole = roles.filter(role => role.name === RolesEnum.ADMIN)[0];

  const defaultAdmin = await generateDefaultAdmin(adminRole);
  await connection
    .createQueryBuilder()
    .insert()
    .into(User)
    .values(defaultAdmin)
    .execute();
  users.push(defaultAdmin);

  return users;
};

const generateDefaultAdmin = async (role: Role): Promise<User> => {
  const user = new User();
  user.email = env.defaultAdmin.email;
  user.role = role;
  user.hash = await bcrypt.hash(env.defaultAdmin.password, env.USER_PASSWORD_BCRYPT_SALT_ROUNDS);

  return user;
};