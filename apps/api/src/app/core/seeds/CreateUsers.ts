// Modified code from https://github.com/alexitaylor/angular-graphql-nestjs-postgres-starter-kit. 
// MIT License, see https://github.com/alexitaylor/angular-graphql-nestjs-postgres-starter-kit/blob/master/LICENSE
// Copyright (c) 2019 Alexi Taylor

import { Connection } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { environment as env } from '@env-api/environment'
import { Role, RolesEnum } from '../../role';
import { User } from '../../user';
import * as faker from 'faker';

export const seedAdminUsers = async (
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

export const createUsers = async (
  connection: Connection,
  roles: Role[],
): Promise<User[]> => {
  let users: User[];
  let user: User;

  const adminUsers: User[] = await seedAdminUsers(connection, roles);
  users = [...adminUsers];

  const role = roles.filter(role => role.name === RolesEnum.EMPLOYEE)[0];

  // Generate 10 random users
  for (let i = 0; i < 10; i++) {
    // Randomly assign role to user
    // role = roles[faker.random.number(roles.length - 1)];
    user = await generateRandomUser(role);
    await connection
      .createQueryBuilder()
      .insert()
      .into(User)
      .values(user)
      .execute();
    users.push(user);
  }

  return users;
};

const generateDefaultAdmin = async (role: Role): Promise<User> => {
  const user = new User();
  user.email = env.defaultAdmin.email;
  user.role = role;
  user.hash = await bcrypt.hash(env.defaultAdmin.password, env.USER_PASSWORD_BCRYPT_SALT_ROUNDS);

  return user;
};

const generateRandomUser = async (role: Role): Promise<User> => {
  const gender = faker.random.number(1);
  const firstName = faker.name.firstName(gender);
  const lastName = faker.name.lastName(gender);
  const username = faker.internet.userName(firstName, lastName);
  const email = faker.internet.email(firstName, lastName);

  const user = new User();
  user.firstName = firstName;
  user.lastName = lastName;
  user.username = username;
  user.email = email;
  user.role = role;
  user.hash = await bcrypt.hash('123456', env.USER_PASSWORD_BCRYPT_SALT_ROUNDS);

  return user;
};