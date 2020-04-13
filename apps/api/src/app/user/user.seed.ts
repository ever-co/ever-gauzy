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

const seedSuperAdminUsers = async (
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
		superAdmins.push(superAdminUser);
	}
	return superAdmins;
};

const seedAdminUsers = async (
	roles: Role[],
	tenant: Tenant[]
): Promise<User[]> => {
	const admins: Promise<User>[] = [];
	let adminUser: Promise<User>;

	const adminRole = roles.filter((role) => role.name === RolesEnum.ADMIN)[0];
	const defaultAdmins = env.defaultAdmins || [];

	// Generate default admins
	for (const admin of defaultAdmins) {
		adminUser = generateDefaultUser(admin, adminRole, tenant[0]);
		admins.push(adminUser);
	}

	return Promise.all(admins);
};

const seedDefaultUsers = async (
	role: Role,
	tenant: Tenant[]
): Promise<User[]> => {
	const defaultUsers: Promise<User>[] = [];
	let user: Promise<User>;

	const defaultEmployees = env.defaultEmployees || [];
	let counter = 0;
	// Generate default users
	for (const employee of defaultEmployees) {
		user = generateDefaultUser(
			employee,
			role,
			tenant[counter % tenant.length]
		);
		defaultUsers.push(user);
		counter++;
	}
	return Promise.all(defaultUsers);
};

const seedRandomUsers = async (
	role: Role,
	tenant: Tenant[]
): Promise<User[]> => {
	const randomUsers: Promise<User>[] = [];
	let user: Promise<User>;

	let counter = 0;
	// Generate 50 random users
	for (let i = 0; i < 50; i++) {
		user = generateRandomUser(role, tenant[counter % tenant.length]);
		randomUsers.push(user);
		counter++;
	}
	return Promise.all(randomUsers);
};

const seedDefaultCandidateUsers = async (
	role: Role,
	tenant: Tenant[]
): Promise<User[]> => {
	const defaultCandidateUsers: Promise<User>[] = [];
	let user: Promise<User>;

	const defaultCandidates = env.defaultCandidates || [];

	let counter = 0;
	// Generate default candidate users
	for (const candidate of defaultCandidates) {
		user = generateDefaultUser(
			candidate,
			role,
			tenant[counter % tenant.length]
		);
		defaultCandidateUsers.push(user);
		counter++;
	}
	return Promise.all(defaultCandidateUsers);
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
	const employeeRole = roles.filter(
		(role) => role.name === RolesEnum.EMPLOYEE
	)[0];

	const candidateRole = roles.filter(
		(role) => role.name === RolesEnum.CANDIDATE
	)[0];

	const _superAdminUsers: Promise<User[]> = seedSuperAdminUsers(
		roles,
		tenant
	);
	const _adminUsers: Promise<User[]> = seedAdminUsers(roles, tenant);

	const _defaultUsers: Promise<User[]> = seedDefaultUsers(
		employeeRole,
		tenant
	);
	const _randomUsers: Promise<User[]> = seedRandomUsers(employeeRole, tenant);

	const _defaultCandidateUser: Promise<User[]> = seedDefaultCandidateUsers(
		candidateRole,
		tenant
	);
	const _randomCandidateUser: Promise<User[]> = seedRandomUsers(
		candidateRole,
		tenant
	);

	const [
		superAdminUsers,
		adminUsers,
		defaultUsers,
		randomUsers,
		defaultCandidateUser,
		randomCandidateUser
	] = await Promise.all([
		_superAdminUsers,
		_adminUsers,
		_defaultUsers,
		_randomUsers,
		_defaultCandidateUser,
		_randomCandidateUser
	]);

	await insertUsers(connection, [
		...superAdminUsers,
		...adminUsers,
		...defaultUsers,
		...randomUsers,
		...defaultCandidateUser,
		...randomCandidateUser
	]);

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

const generateRandomUser = async (
	role: Role,
	tenant: Tenant
): Promise<User> => {
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
	user.tenant = tenant;

	user.hash = await bcrypt.hash(
		'123456',
		env.USER_PASSWORD_BCRYPT_SALT_ROUNDS
	);

	return user;
};

const insertUsers = async (
	connection: Connection,
	users: User[]
): Promise<void> => {
	await connection
		.createQueryBuilder()
		.insert()
		.into(User)
		.values(users)
		.execute();
};
