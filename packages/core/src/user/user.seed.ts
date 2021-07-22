// Modified code from https://github.com/alexitaylor/angular-graphql-nestjs-postgres-starter-kit.
// MIT License, see https://github.com/alexitaylor/angular-graphql-nestjs-postgres-starter-kit/blob/master/LICENSE
// Copyright (c) 2019 Alexi Taylor

import { Connection } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { environment as env } from '@gauzy/config';
import * as faker from 'faker';
import {
	IDefaultUser,
	RolesEnum,
	ISeedUsers,
	LanguagesEnum,
	IRole,
	ITenant,
	IUser,
	ComponentLayoutStyleEnum
} from '@gauzy/contracts';
import { User } from './user.entity';
import { getUserDummyImage, Role } from '../core';
import { DEFAULT_EMPLOYEES, DEFAULT_EVER_EMPLOYEES } from '../employee/default-employees';
import { DEFAULT_CANDIDATES } from '../candidate/default-candidates';
import { DEFAULT_SUPER_ADMINS, DEFAULT_ADMINS } from './default-users';

export const createDefaultAdminUsers = async (
	connection: Connection,
	tenant: ITenant
): Promise<{
	defaultSuperAdminUsers: IUser[];
	defaultAdminUsers: IUser[];
}> => {
	// Super Admin Users
	const _defaultSuperAdminUsers: Promise<IUser[]> = seedSuperAdminUsers(connection, tenant);
	// Admin Users
	const _defaultAdminUsers: Promise<IUser[]> = seedAdminUsers(connection, tenant);
	
	const [
		defaultSuperAdminUsers,
		defaultAdminUsers
	] = await Promise.all([
		_defaultSuperAdminUsers,
		_defaultAdminUsers
	]);

	await insertUsers(connection, [
		...defaultSuperAdminUsers,
		...defaultAdminUsers
	]);

	return {
		defaultSuperAdminUsers,
		defaultAdminUsers
	};
};

export const createDefaultEmployeesUsers = async (
	connection: Connection,
	tenant: ITenant,
): Promise<{ defaultEmployeeUsers: IUser[]; }> => {
	// Employee Users
	const _defaultEmployeeUsers: Promise<IUser[]> = seedDefaultEmployeeUsers(connection, tenant, DEFAULT_EMPLOYEES);
	const [ defaultEmployeeUsers ] = await Promise.all([ _defaultEmployeeUsers ]);
	
	await insertUsers(connection, [ ...defaultEmployeeUsers ]);
	
	return {
		defaultEmployeeUsers
	};
};

export const createRandomSuperAdminUsers = async (
	connection: Connection,
	tenants: ITenant[],
	noOfSuperAdmins: number = 1
): Promise<Map<ITenant, IUser[]>> => {
	
	const tenantSuperAdminsMap: Map<ITenant, IUser[]> = new Map();
	const superAdmins: IUser[] = [];

	for await (const tenant of tenants) {
		const superAdminRole = await connection.manager.findOne(Role, {
			tenant,
			name: RolesEnum.SUPER_ADMIN
		});
		const tenantSuperAdmins = [];
		// Generate random super admins
		for (let i = 0; i < noOfSuperAdmins; i++) {
			const superAdminUser = await generateRandomUser(
				superAdminRole,
				tenant
			);
			tenantSuperAdmins.push(superAdminUser);
			superAdmins.push(superAdminUser);
			console.log(superAdminUser);
		}
		tenantSuperAdminsMap.set(tenant, tenantSuperAdmins);
	}

	await insertUsers(connection, superAdmins);
	return tenantSuperAdminsMap;
};

export const createDefaultUsers = async (
	connection: Connection,
	tenant: ITenant
): Promise<{
	defaultEverEmployeeUsers: IUser[];
	defaultCandidateUsers: IUser[];
}> => {
	const _defaultEverEmployeeUsers: Promise<IUser[]> = seedDefaultEmployeeUsers(
		connection,
		tenant,
		DEFAULT_EVER_EMPLOYEES
	);

	const _defaultCandidateUsers: Promise<IUser[]> = seedDefaultCandidateUsers(
		connection,
		tenant
	);

	const [
		defaultEverEmployeeUsers,
		defaultCandidateUsers
	] = await Promise.all([
		_defaultEverEmployeeUsers,
		_defaultCandidateUsers
	]);

	await insertUsers(connection, [
		...defaultEverEmployeeUsers,
		...defaultCandidateUsers
	]);

	return {
		defaultEverEmployeeUsers,
		defaultCandidateUsers
	};
};

export const createRandomUsers = async (
	connection: Connection,
	tenants: ITenant[],
	organizationPerTenant: number,
	employeesPerOrganization: number,
	candidatesPerOrganization: number,
	managersPerOrganization: number,
	dataEntriesPerOrganization: number,
	viewerPerOrganization: number
): Promise<Map<ITenant, ISeedUsers>> => {
	const randomTenantUsers: Map<ITenant, ISeedUsers> = new Map();

	for (const tenant of tenants) {
		const _adminUsers: Promise<IUser[]> = seedRandomUsers(
			connection,
			RolesEnum.ADMIN,
			tenant,
			organizationPerTenant //Because we want to seed at least one admin per organization
		);

		const _employeeUsers: Promise<IUser[]> = seedRandomUsers(
			connection,
			RolesEnum.EMPLOYEE,
			tenant,
			employeesPerOrganization * organizationPerTenant
		);

		const _candidateUsers: Promise<IUser[]> = seedRandomUsers(
			connection,
			RolesEnum.CANDIDATE,
			tenant,
			candidatesPerOrganization * organizationPerTenant
		);

		const _managerUsers: Promise<IUser[]> = seedRandomUsers(
			connection,
			RolesEnum.MANAGER,
			tenant,
			managersPerOrganization * organizationPerTenant
		);

		const _dataEntryUsers: Promise<IUser[]> = seedRandomUsers(
			connection,
			RolesEnum.DATA_ENTRY,
			tenant,
			dataEntriesPerOrganization * organizationPerTenant
		);

		const _viewerUsers: Promise<IUser[]> = seedRandomUsers(
			connection,
			RolesEnum.VIEWER,
			tenant,
			viewerPerOrganization * organizationPerTenant
		);

		const [
			promiseAdminUsers,
			promiseEmployeeUsers,
			promiseCandidateUsers,
			promiseManagerUsers,
			promiseDataEntryUsers,
			promiseViewerUsers
		] = await Promise.all([
			_adminUsers,
			_employeeUsers,
			_candidateUsers,
			_managerUsers,
			_dataEntryUsers,
			_viewerUsers
		]);

		const adminUsers = await insertUsers(connection, [
			...promiseAdminUsers
		]);
		const employeeUsers = await insertUsers(connection, [
			...promiseEmployeeUsers
		]);
		const candidateUsers = await insertUsers(connection, [
			...promiseCandidateUsers
		]);

		await insertUsers(connection, [
			...promiseManagerUsers,
			...promiseDataEntryUsers,
			...promiseViewerUsers
		]);

		randomTenantUsers.set(tenant, {
			adminUsers,
			employeeUsers,
			candidateUsers
		});
	}

	return randomTenantUsers;
};

const seedSuperAdminUsers = async (
	connection: Connection,
	tenant: ITenant
): Promise<IUser[]> => {
	const superAdmins: Promise<IUser>[] = [];
	const superAdminRole = await connection.manager.findOne(Role, {
		tenant,
		name: RolesEnum.SUPER_ADMIN
	});
	
	// Generate default super admins
	for (const superAdmin of DEFAULT_SUPER_ADMINS) {
		const superAdminUser: Promise<IUser> = generateDefaultUser(
			superAdmin,
			superAdminRole,
			tenant
		);
		superAdmins.push(superAdminUser);
	}
	return Promise.all(superAdmins);
};

const seedAdminUsers = async (
	connection: Connection,
	tenant: ITenant
): Promise<IUser[]> => {
	const admins: Promise<IUser>[] = [];
	const adminRole = await connection.manager.findOne(Role, {
		tenant,
		name: RolesEnum.ADMIN
	});

	// Generate default admins
	for (const admin of DEFAULT_ADMINS) {
		const adminUser: Promise<IUser> = generateDefaultUser(
			admin, 
			adminRole, 
			tenant
		);
		admins.push(adminUser);
	}
	return Promise.all(admins);
};

const seedDefaultEmployeeUsers = async (
	connection: Connection,
	tenant: ITenant,
	employees: any[]
): Promise<IUser[]> => {
	const employeeRole = await connection.manager.findOne(Role, {
		tenant,
		name: RolesEnum.EMPLOYEE
	});

	const defaultUsers: Promise<IUser>[] = [];
	// Generate default users
	for (const employee of employees) {
		const user: Promise<IUser> = generateDefaultUser(employee, employeeRole, tenant);
		defaultUsers.push(user);
	}

	return Promise.all(defaultUsers);
};

const seedRandomUsers = async (
	connection: Connection,
	roleEnum: RolesEnum,
	tenant: ITenant,
	maxUserCount: number
): Promise<IUser[]> => {
	const role = await connection.manager.findOne(Role, {
		tenant,
		name: roleEnum
	});
	const randomUsers: Promise<IUser>[] = [];
	let user: Promise<IUser>;

	// Generate 50 random users
	for (let i = 0; i < maxUserCount; i++) {
		user = generateRandomUser(role, tenant);
		randomUsers.push(user);
	}
	return Promise.all(randomUsers);
};

const seedDefaultCandidateUsers = async (
	connection: Connection,
	tenant: ITenant
): Promise<IUser[]> => {
	const candidateRole = await connection.manager.findOne(Role, {
		tenant,
		name: RolesEnum.CANDIDATE
	});
	const defaultCandidates = DEFAULT_CANDIDATES;
	const defaultCandidateUsers: Promise<IUser>[] = [];
	let user: Promise<IUser>;

	// Generate default candidate users
	for (const candidate of defaultCandidates) {
		user = generateDefaultUser(candidate, candidateRole, tenant);
		defaultCandidateUsers.push(user);
	}

	return Promise.all(defaultCandidateUsers);
};

const generateDefaultUser = async (
	defaultUser: IDefaultUser,
	role: IRole,
	tenant: ITenant
): Promise<IUser> => {
	const user = new User();
	const {
		firstName,
		lastName,
		email,
		imageUrl,
		preferredLanguage,
		preferredComponentLayout = ComponentLayoutStyleEnum.TABLE
	} = defaultUser;

	user.email = email;
	user.firstName = firstName;
	user.lastName = lastName;
	user.role = role;
	user.imageUrl = getUserDummyImage(user);
	user.imageUrl = imageUrl;
	user.tenant = tenant;
	user.preferredLanguage = preferredLanguage;
	user.preferredComponentLayout = preferredComponentLayout;

	user.hash = await bcrypt.hash(
		defaultUser.password,
		env.USER_PASSWORD_BCRYPT_SALT_ROUNDS
	);

	return user;
};

const generateRandomUser = async (
	role: IRole,
	tenant: ITenant
): Promise<IUser> => {
	const gender = faker.datatype.number(1);
	const firstName = faker.name.firstName(gender);
	const lastName = faker.name.lastName(gender);
	const username = faker.internet.userName(firstName, lastName);
	const email = faker.internet.email(firstName, lastName);
	const avatar = faker.image.avatar();

	const user = new User();
	user.firstName = firstName;
	user.lastName = lastName;
	user.username = username;
	user.email = email.toLowerCase();
	user.role = role;
	user.imageUrl = avatar;
	user.tenant = tenant;

	const languages = Object.values(LanguagesEnum);
	user.preferredLanguage =
		languages[Math.floor(Math.random() * languages.length)];

	user.hash = await bcrypt.hash(
		'123456',
		env.USER_PASSWORD_BCRYPT_SALT_ROUNDS
	);

	return user;
};

const insertUsers = async (
	connection: Connection,
	users: IUser[]
): Promise<IUser[]> => {
	return await connection.manager.save(users);
};
