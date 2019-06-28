// Modified code from https://github.com/alexitaylor/angular-graphql-nestjs-postgres-starter-kit. 
// MIT License, see https://github.com/alexitaylor/angular-graphql-nestjs-postgres-starter-kit/blob/master/LICENSE
// Copyright (c) 2019 Alexi Taylor

import { Connection } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { environment as env } from '@env-api/environment'
import * as faker from 'faker';
import { DefaultUser, RolesEnum } from '@gauzy/models';
import { Role } from '../role';
import { User } from './user.entity';
import { getDummyImage, getUserDummyImage } from '../core';

export const seedAdminUsers = async (
  connection: Connection,
  roles: Role[],
): Promise<User[]> => {
  const admins: User[] = [];
  let adminUser: User;

  const adminRole = roles.filter(role => role.name === RolesEnum.ADMIN)[0];
  const defaultAdmins = env.defaultAdmins || [];

  // Generate default admins
  for (const admin of defaultAdmins) {
    adminUser = await generateDefaultUser(admin, adminRole);
    await insertUser(connection, adminUser);
    admins.push(adminUser);
  }

  return admins;
};

export const createUsers = async (
  connection: Connection,
  roles: Role[],
): Promise<{ adminUsers: User[], defaultUsers: User[], randomUsers: User[] }> => {
  const defaultUsers: User[] = [];
  const randomUsers: User[] = [];
  let user: User;

  const adminUsers: User[] = await seedAdminUsers(connection, roles);
  // users = [...adminUsers];

  const employeeRole = roles.filter(role => role.name === RolesEnum.EMPLOYEE)[0];
  const defaultEmployees = env.defaultEmployees || [];

  // Generate default users
  for (const employee of defaultEmployees) {
    user = await generateDefaultUser(employee, employeeRole);
    await insertUser(connection, user);
    defaultUsers.push(user);
  }

  // Generate 30 random users
  for (let i = 0; i < 30; i++) {
    user = await generateRandomUser(employeeRole);
    await insertUser(connection, user);
    randomUsers.push(user);
  }

  return { adminUsers, defaultUsers, randomUsers };
};

const generateDefaultUser = async (defaultUser: DefaultUser, role: Role): Promise<User> => {
  const user = new User();

  const firstName = defaultUser.firstName;
  const lastName = defaultUser.lastName;
  const email = defaultUser.email;

  user.email = email;
  user.firstName = firstName;
  user.lastName = lastName;
  user.role = role;
  user.imageUrl = getUserDummyImage(user);
  user.hash = await bcrypt.hash(defaultUser.password, env.USER_PASSWORD_BCRYPT_SALT_ROUNDS);

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
  user.imageUrl = getUserDummyImage(user);
  user.hash = await bcrypt.hash('123456', env.USER_PASSWORD_BCRYPT_SALT_ROUNDS);

  return user;
};

const insertUser = async (connection: Connection, user: User): Promise<void> => {
  await connection
    .createQueryBuilder()
    .insert()
    .into(User)
    .values(user)
    .execute();
}