// Modified code from https://github.com/alexitaylor/angular-graphql-nestjs-postgres-starter-kit.
// MIT License, see https://github.com/alexitaylor/angular-graphql-nestjs-postgres-starter-kit/blob/master/LICENSE
// Copyright (c) 2019 Alexi Taylor

import { Connection } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { environment as env } from '@env-api/environment';
import * as faker from 'faker';
import { DefaultUser, RolesEnum } from '@gauzy/models';
import { Role } from '../role/role.entity';
import { User } from './user.entity';
import { getUserDummyImage } from '../core';
import { Tenant } from '../tenant/tenant.entity';

export const seedSuperAdminUsers = async (
	connection: Connection,
	roles: Role[],
	tenant: Tenant[]
): Promise<User[]> => {
	const superAdmins: User[] = [];
	let superAdminUser: User;

	const superAdminRole = roles.filter(
		(role) => role.name === RolesEnum.SUPER_ADMIN
	)[0];
	const defaultSuperAdmins = env.defaultSuperAdmins || [];

	// Generate default super admins
	for (const superAdmin of defaultSuperAdmins) {
		superAdminUser = await generateDefaultUser(
			superAdmin,
			superAdminRole,
			tenant[0]
		);
		await insertUser(connection, superAdminUser);
		superAdmins.push(superAdminUser);
	}

	return superAdmins;
};

export const seedAdminUsers = async (
	connection: Connection,
	roles: Role[],
	tenant: Tenant[]
): Promise<User[]> => {
	const admins: User[] = [];
	let adminUser: User;

	const adminRole = roles.filter((role) => role.name === RolesEnum.ADMIN)[0];
	const defaultAdmins = env.defaultAdmins || [];

	// Generate default admins
	for (const admin of defaultAdmins) {
		adminUser = await generateDefaultUser(admin, adminRole, tenant[0]);
		await insertUser(connection, adminUser);
		admins.push(adminUser);
	}

	return admins;
};

export const createUsers = async (
	connection: Connection,
	roles: Role[],
	tenant: Tenant[]
): Promise<{
	superAdminUsers: User[];
	adminUsers: User[];
	defaultUsers: User[];
	randomUsers: User[];
	defaultCandidateUser: User[];
	randomCandidateUser: User[];
}> => {
	const defaultUsers: User[] = [];
	const randomUsers: User[] = [];
	const defaultCandidateUser: User[] = [];
	const randomCandidateUser: User[] = [];

	let user: User;

	const superAdminUsers: User[] = await seedSuperAdminUsers(
		connection,
		roles,
		tenant
	);
	const adminUsers: User[] = await seedAdminUsers(connection, roles, tenant);
	// users = [...adminUsers];

	const employeeRole = roles.filter(
		(role) => role.name === RolesEnum.EMPLOYEE
	)[0];
	const candidateRole = roles.filter(
		(role) => role.name === RolesEnum.CANDIDATE
	)[0];
	const defaultEmployees = env.defaultEmployees || [];
	const defaultCandidates = env.defaultCandidates || [];
	let counter = 0;
	// Generate default users
	for (const employee of defaultEmployees) {
		user = await generateDefaultUser(
			employee,
			employeeRole,
			tenant[counter]
		);
		await insertUser(connection, user);
		defaultUsers.push(user);
		counter++;
	}

	// Generate default candidate users
	for (const candidate of defaultCandidates) {
		user = await generateDefaultUser(
			candidate,
			candidateRole,
			tenant[counter]
		);
		await insertUser(connection, user);
		defaultCandidateUser.push(user);
		counter++;
	}
	// Generate 50 random candidate users
	for (let i = 0; i < 100; i++) {
		user = await generateRandomUser(employeeRole);
		await insertUser(connection, user);
		randomCandidateUser.push(user);
	}

	// Generate 50 random users
	for (let i = 0; i < 50; i++) {
		user = await generateRandomUser(employeeRole);
		await insertUser(connection, user);
		randomUsers.push(user);
	}

	return {
		superAdminUsers,
		adminUsers,
		defaultUsers,
		randomUsers,
		defaultCandidateUser,
		randomCandidateUser
	};
};

const generateDefaultUser = async (
	defaultUser: DefaultUser,
	role: Role,
	tenant: Tenant
): Promise<User> => {
	const user = new User();
	const { firstName, lastName, email, imageUrl } = defaultUser;

	user.email = email;
	user.firstName = firstName;
	user.lastName = lastName;
	user.role = role;
	user.imageUrl = getUserDummyImage(user);
	user.imageUrl = imageUrl;
	user.tenant = tenant;

	user.hash = await bcrypt.hash(
		defaultUser.password,
		env.USER_PASSWORD_BCRYPT_SALT_ROUNDS
	);

	return user;
};

const generateRandomUser = async (role: Role): Promise<User> => {
	const gender = faker.random.number(1);
	const firstName = faker.name.firstName(gender);
	const lastName = faker.name.lastName(gender);
	const username = faker.internet.userName(firstName, lastName);
	const email = faker.internet.email(firstName, lastName);
	const avatar = faker.image.avatar();

	const user = new User();
	user.firstName = firstName;
	user.lastName = lastName;
	user.username = username;
	user.email = email;
	user.role = role;
	user.imageUrl = avatar;
	user.hash = await bcrypt.hash(
		'123456',
		env.USER_PASSWORD_BCRYPT_SALT_ROUNDS
	);

	return user;
};

const insertUser = async (
	connection: Connection,
	user: User
): Promise<void> => {
	await connection
		.createQueryBuilder()
		.insert()
		.into(User)
		.values(user)
		.execute();
};
