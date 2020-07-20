// Modified code from https://github.com/alexitaylor/angular-graphql-nestjs-postgres-starter-kit.
// MIT License, see https://github.com/alexitaylor/angular-graphql-nestjs-postgres-starter-kit/blob/master/LICENSE
// Copyright (c) 2019 Alexi Taylor

import { Connection } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { environment as env } from '@env-api/environment';
import * as faker from 'faker';
import {
	IDefaultUser,
	RolesEnum,
	ISeedUsers,
	LanguagesEnum
} from '@gauzy/models';
import { Role } from '../role/role.entity';
import { User } from './user.entity';
import { getUserDummyImage } from '../core';
import { Tenant } from '../tenant/tenant.entity';

export const createDefaultSuperAdminUsers = async (
	connection: Connection,
	roles: Role[],
	tenant: Tenant
): Promise<User[]> => {
	const superAdmins: User[] = [];
	let superAdminUser: User;

	const superAdminRole = roles.filter(
		(role) => role.name === RolesEnum.SUPER_ADMIN
	)[0];
	const defaultSuperAdmins = [
    {
      email: 'admin@ever.co',
      password: 'admin',
      firstName: 'Admin',
      lastName: 'Super',
      imageUrl: 'assets/images/avatars/ruslan.jpg',
      preferredLanguage: LanguagesEnum.ENGLISH
    }
  ];

	// Generate default super admins
	for (const superAdmin of defaultSuperAdmins) {
		superAdminUser = await generateDefaultUser(
			superAdmin,
			superAdminRole,
			tenant
		);
		superAdmins.push(superAdminUser);
	}

	await insertUsers(connection, superAdmins);

	return superAdmins;
};

export const createRandomSuperAdminUsers = async (
	connection: Connection,
	roles: Role[],
	tenants: Tenant[],
	noOfSuperAdmins: number = 1
): Promise<Map<Tenant, User[]>> => {
	const superAdminRole = roles.filter(
		(role) => role.name === RolesEnum.SUPER_ADMIN
	)[0];

	const tenantSuperAdminsMap: Map<Tenant, User[]> = new Map();

	const superAdmins: User[] = [];

	for (const tenant of tenants) {
		const tenantSuperAdmins = [];
		// Generate random super admins
		for (let i = 0; i < noOfSuperAdmins; i++) {
			const superAdminUser = await generateRandomUser(
				superAdminRole,
				tenant
			);
			tenantSuperAdmins.push(superAdminUser);
			superAdmins.push(superAdminUser);
		}
		tenantSuperAdminsMap.set(tenant, tenantSuperAdmins);
	}

	await insertUsers(connection, superAdmins);

	return tenantSuperAdminsMap;
};

export const createDefaultUsers = async (
	connection: Connection,
	roles: Role[],
	tenant: Tenant
): Promise<{
	adminUsers: User[];
	defaultEmployeeUsers: User[];
	defaultCandidateUsers: User[];
}> => {
	const employeeRole = roles.filter(
		(role) => role.name === RolesEnum.EMPLOYEE
	)[0];

	const candidateRole = roles.filter(
		(role) => role.name === RolesEnum.CANDIDATE
	)[0];

	const _adminUsers: Promise<User[]> = seedAdminUsers(roles, tenant);

	const _defaultEmployeeUsers: Promise<User[]> = seedDefaultEmployeeUsers(
		employeeRole,
		tenant
	);

	const _defaultCandidateUsers: Promise<User[]> = seedDefaultCandidateUsers(
		candidateRole,
		tenant
	);

	const [
		adminUsers,
		defaultEmployeeUsers,
		defaultCandidateUsers
	] = await Promise.all([
		_adminUsers,
		_defaultEmployeeUsers,
		_defaultCandidateUsers
	]);

	await insertUsers(connection, [
		...adminUsers,
		...defaultEmployeeUsers,
		...defaultCandidateUsers
	]);

	return {
		adminUsers,
		defaultEmployeeUsers,
		defaultCandidateUsers
	};
};

export const createRandomUsers = async (
	connection: Connection,
	roles: Role[],
	tenants: Tenant[],
	organizationPerTenant: number,
	employeesPerOrganization: number,
	candidatesPerOrganization: number,
	managersPerOrganization: number,
	dataEntriesPerOrganization: number,
	viewerPerOrganization: number
): Promise<Map<Tenant, ISeedUsers>> => {
	const adminRole = roles.filter((role) => role.name === RolesEnum.ADMIN)[0];

	const employeeRole = roles.filter(
		(role) => role.name === RolesEnum.EMPLOYEE
	)[0];

	const candidateRole = roles.filter(
		(role) => role.name === RolesEnum.CANDIDATE
	)[0];

	const managerRole = roles.filter(
		(role) => role.name === RolesEnum.MANAGER
	)[0];

	const dataEntryRole = roles.filter(
		(role) => role.name === RolesEnum.DATA_ENTRY
	)[0];

	const viewerRole = roles.filter(
		(role) => role.name === RolesEnum.VIEWER
	)[0];

	const randomTenantUsers: Map<Tenant, ISeedUsers> = new Map();

	for (const tenant of tenants) {
		const _adminUsers: Promise<User[]> = seedRandomUsers(
			adminRole,
			tenant,
			organizationPerTenant //Because we want to seed at least one admin per organization
		);

		const _employeeUsers: Promise<User[]> = seedRandomUsers(
			employeeRole,
			tenant,
			employeesPerOrganization * organizationPerTenant
		);

		const _candidateUsers: Promise<User[]> = seedRandomUsers(
			candidateRole,
			tenant,
			candidatesPerOrganization * organizationPerTenant
		);

		const _managerUsers: Promise<User[]> = seedRandomUsers(
			managerRole,
			tenant,
			managersPerOrganization * organizationPerTenant
		);

		const _dataEntryUsers: Promise<User[]> = seedRandomUsers(
			dataEntryRole,
			tenant,
			dataEntriesPerOrganization * organizationPerTenant
		);

		const _viewerUsers: Promise<User[]> = seedRandomUsers(
			viewerRole,
			tenant,
			viewerPerOrganization * organizationPerTenant
		);

		const [
			adminUsers,
			employeeUsers,
			candidateUsers,
			managerUsers,
			dataEntryUsers,
			viewerUsers
		] = await Promise.all([
			_adminUsers,
			_employeeUsers,
			_candidateUsers,
			_managerUsers,
			_dataEntryUsers,
			_viewerUsers
		]);

		await insertUsers(connection, [
			...adminUsers,
			...employeeUsers,
			...candidateUsers,
			...managerUsers,
			...dataEntryUsers,
			...viewerUsers
		]);

		randomTenantUsers.set(tenant, {
			adminUsers,
			employeeUsers,
			candidateUsers
		});
	}

	return randomTenantUsers;
};

const seedAdminUsers = async (
	roles: Role[],
	tenant: Tenant
): Promise<User[]> => {
	const admins: Promise<User>[] = [];
	let adminUser: Promise<User>;

	const adminRole = roles.filter((role) => role.name === RolesEnum.ADMIN)[0];
	const defaultAdmins = [
    {
      email: 'local.admin@ever.co',
      password: 'admin',
      firstName: 'Admin',
      lastName: 'Local',
      imageUrl: 'assets/images/avatars/ruslan.jpg',
      preferredLanguage: LanguagesEnum.ENGLISH
    }
  ];

	// Generate default admins
	for (const admin of defaultAdmins) {
		adminUser = generateDefaultUser(admin, adminRole, tenant);
		admins.push(adminUser);
	}

	return Promise.all(admins);
};

const seedDefaultEmployeeUsers = async (
	role: Role,
	tenant: Tenant
): Promise<User[]> => {
	const defaultUsers: Promise<User>[] = [];
	let user: Promise<User>;

	const defaultEmployees = [
    {
      email: 'ruslan@ever.co',
      password: '123456',
      firstName: 'Ruslan',
      lastName: 'Konviser',
      imageUrl: 'assets/images/avatars/ruslan.jpg',
      preferredLanguage: LanguagesEnum.ENGLISH
    },
    {
      email: 'alish@ever.co',
      password: '123456',
      firstName: 'Alish',
      lastName: 'Meklyov',
      imageUrl: 'assets/images/avatars/alish.jpg',
      startedWorkOn: '2018-03-20',
      endWork: null,
      employeeLevel: 'D',
      preferredLanguage: LanguagesEnum.ENGLISH
    },
    {
      email: 'blagovest@ever.co',
      password: '123456',
      firstName: 'Blagovest',
      lastName: 'Gerov',
      imageUrl: 'assets/images/avatars/blagovest.jpg',
      startedWorkOn: '2018-03-19',
      endWork: null,
      employeeLevel: 'C',
      preferredLanguage: LanguagesEnum.ENGLISH
    },
    {
      email: 'elvis@ever.co',
      password: '123456',
      firstName: 'Elvis',
      lastName: 'Arabadjiiski',
      imageUrl: 'assets/images/avatars/elvis.jpg',
      startedWorkOn: '2018-05-25',
      endWork: null,
      employeeLevel: 'C',
      preferredLanguage: LanguagesEnum.ENGLISH
    },
    {
      email: 'emil@ever.co',
      password: '123456',
      firstName: 'Emil',
      lastName: 'Momchilov',
      imageUrl: 'assets/images/avatars/emil.jpg',
      startedWorkOn: '2019-01-21',
      endWork: null,
      employeeLevel: 'C',
      preferredLanguage: LanguagesEnum.ENGLISH
    },
    {
      email: 'boyan@ever.co',
      password: '123456',
      firstName: 'Boyan',
      lastName: 'Stanchev',
      imageUrl: 'assets/images/avatars/boyan.jpg',
      startedWorkOn: '2019-01-21',
      endWork: null,
      employeeLevel: 'C',
      preferredLanguage: LanguagesEnum.ENGLISH
    },
    {
      email: 'hristo@ever.co',
      password: '123456',
      firstName: 'Hristo',
      lastName: 'Hristov',
      imageUrl: 'assets/images/avatars/hristo.jpg',
      startedWorkOn: '2019-06-17',
      endWork: null,
      employeeLevel: 'B',
      preferredLanguage: LanguagesEnum.ENGLISH
    },
    {
      email: 'alex@ever.co',
      password: '123456',
      firstName: 'Aleksandar',
      lastName: 'Tasev',
      imageUrl: 'assets/images/avatars/alexander.jpg',
      startedWorkOn: '2019-08-01',
      endWork: null,
      employeeLevel: 'B',
      preferredLanguage: LanguagesEnum.ENGLISH
    },
    {
      email: 'rachit@ever.co',
      password: '123456',
      firstName: 'Rachit',
      lastName: 'Magon',
      imageUrl: 'assets/images/avatars/rachit.png',
      startedWorkOn: '2019-11-27',
      endWork: null,
      employeeLevel: null,
      preferredLanguage: LanguagesEnum.ENGLISH
    },
    {
      email: 'atanas@ever.co',
      password: '123456',
      firstName: 'Atanas',
      lastName: 'Yonkov',
      imageUrl: 'assets/images/avatars/atanas.jpeg',
      startedWorkOn: '2020-02-01',
      endWork: null,
      employeeLevel: 'A',
      preferredLanguage: LanguagesEnum.ENGLISH
    },
    {
      email: 'dimana@ever.co',
      password: '123456',
      firstName: 'Dimana',
      lastName: 'Tsvetkova',
      imageUrl: 'assets/images/avatars/dimana.jpeg',
      startedWorkOn: '2019-11-26',
      endWork: null,
      employeeLevel: null,
      preferredLanguage: LanguagesEnum.ENGLISH
    },
    {
      email: 'sunko@ever.co',
      password: '123456',
      firstName: 'Alexander',
      lastName: 'Savov',
      imageUrl: 'assets/images/avatars/savov.jpg',
      startedWorkOn: '2020-02-04',
      endWork: null,
      employeeLevel: 'A',
      preferredLanguage: LanguagesEnum.ENGLISH
    },
    {
      email: 'lubomir@ever.co',
      password: '123456',
      firstName: 'Lubomir',
      lastName: 'Petrov',
      imageUrl: 'assets/images/avatars/lubomir.jpg',
      startedWorkOn: '2020-02-06',
      endWork: null,
      employeeLevel: 'A',
      preferredLanguage: LanguagesEnum.ENGLISH
    },
    {
      email: 'pavel@ever.co',
      password: '123456',
      firstName: 'Pavel',
      lastName: 'Denchev',
      imageUrl: 'assets/images/avatars/pavel.jpg',
      startedWorkOn: '2020-03-16',
      endWork: null,
      employeeLevel: 'A',
      preferredLanguage: LanguagesEnum.ENGLISH
    },
    {
      email: 'yavor@ever.co',
      password: '123456',
      firstName: 'Yavor',
      lastName: 'Grancharov',
      imageUrl: 'assets/images/avatars/yavor.jpg',
      startedWorkOn: '2020-02-05',
      endWork: null,
      employeeLevel: 'A',
      preferredLanguage: LanguagesEnum.ENGLISH
    },
    {
      email: 'tsvetelina@ever.co',
      password: '123456',
      firstName: 'Tsvetelina',
      lastName: 'Yordanova',
      imageUrl: 'assets/images/avatars/tsvetelina.jpg',
      startedWorkOn: '2020-03-02',
      endWork: null,
      employeeLevel: 'A',
      preferredLanguage: LanguagesEnum.ENGLISH
    },
    {
      email: 'everq@ever.co',
      password: '123456',
      firstName: 'Ruslan',
      lastName: 'Konviser',
      imageUrl: 'assets/images/avatars/ruslan.jpg',
      startedWorkOn: '2018-08-01',
      endWork: null,
      employeeLevel: 'C',
      preferredLanguage: LanguagesEnum.ENGLISH
    },
    {
      email: 'muiz@smooper.xyz',
      password: '123456',
      firstName: 'Muiz',
      lastName: 'Nadeem',
      imageUrl: 'assets/images/avatars/muiz.jpg',
      startedWorkOn: '2019-11-27',
      endWork: null,
      employeeLevel: null,
      preferredLanguage: LanguagesEnum.ENGLISH
    },
    {
      email: 'deko898@hotmail.com',
      password: '123456',
      firstName: 'Dejan',
      lastName: 'Obradovikj',
      imageUrl: 'assets/images/avatars/dejan.jpg',
      startedWorkOn: '2020-03-07',
      endWork: null,
      employeeLevel: null,
      preferredLanguage: LanguagesEnum.ENGLISH
    },
    {
      email: 'ckhandla94@gmail.com',
      password: '123456',
      firstName: 'Chetan',
      lastName: 'Khandla',
      imageUrl: 'assets/images/avatars/chetan.png',
      startedWorkOn: '2020-03-07',
      endWork: null,
      employeeLevel: null,
      preferredLanguage: LanguagesEnum.ENGLISH
    },
    {
      email: 'julia@ever.co',
      password: '123456',
      firstName: 'Julia',
      lastName: 'Konviser',
      imageUrl: 'assets/images/avatars/julia.png',
      startedWorkOn: '2018-08-01',
      endWork: null,
      employeeLevel: 'C',
      preferredLanguage: LanguagesEnum.ENGLISH
    },
    {
      email: '',
      password: '123456',
      firstName: 'Milena',
      lastName: 'Dimova',
      imageUrl: 'assets/images/avatars/milena.png',
      startedWorkOn: '2019-07-15',
      endWork: '2019-10-15',
      employeeLevel: 'A',
      preferredLanguage: LanguagesEnum.ENGLISH
    },
    {
      email: 'yordan@ever.co',
      password: '123456',
      firstName: 'Yordan ',
      lastName: 'Genovski',
      imageUrl: 'assets/images/avatars/yordan.jpg',
      startedWorkOn: '2018-08-01',
      endWork: null,
      employeeLevel: 'C',
      preferredLanguage: LanguagesEnum.ENGLISH
    }
  ];
	let counter = 0;
	// Generate default users
	for (const employee of defaultEmployees) {
		user = generateDefaultUser(employee, role, tenant);
		defaultUsers.push(user);
		counter++;
	}
	return Promise.all(defaultUsers);
};

const seedRandomUsers = async (
	role: Role,
	tenant: Tenant,
	maxUserCount: number
): Promise<User[]> => {
	const randomUsers: Promise<User>[] = [];
	let user: Promise<User>;

	// Generate 50 random users
	for (let i = 0; i < maxUserCount; i++) {
		user = generateRandomUser(role, tenant);
		randomUsers.push(user);
	}
	return Promise.all(randomUsers);
};

const seedDefaultCandidateUsers = async (
	role: Role,
	tenant: Tenant
): Promise<User[]> => {
	const defaultCandidateUsers: Promise<User>[] = [];
	let user: Promise<User>;

	const defaultCandidates = [
    {
      email: 'john@ever.co',
      password: '123456',
      firstName: 'John',
      lastName: 'Smith',
      imageUrl: 'assets/images/avatars/alish.jpg',
      candidateLevel: 'D',
      preferredLanguage: LanguagesEnum.ENGLISH
    },
    {
      email: 'jaye@ever.co',
      password: '123456',
      firstName: 'Jaye',
      lastName: 'Jeffreys',
      imageUrl: 'assets/images/avatars/alexander.jpg',
      candidateLevel: 'B',
      preferredLanguage: LanguagesEnum.ENGLISH
    },
    {
      email: 'kasey@ever.co',
      password: '123456',
      firstName: 'Kasey',
      lastName: 'Kraker',
      imageUrl: 'assets/images/avatars/rachit.png',
      candidateLevel: null,
      preferredLanguage: LanguagesEnum.ENGLISH
    },
    {
      email: 'norris@ever.co',
      password: '123456',
      firstName: 'Norris ',
      lastName: 'Nesbit',
      imageUrl: 'assets/images/avatars/atanas.jpeg',
      candidateLevel: 'A',
      preferredLanguage: LanguagesEnum.ENGLISH
    },
    {
      email: 'estella@ever.co',
      password: '123456',
      firstName: 'Estella',
      lastName: 'Ennis',
      imageUrl: 'assets/images/avatars/dimana.jpeg',
      candidateLevel: null,
      preferredLanguage: LanguagesEnum.ENGLISH
    },
    {
      email: 'greg@ever.co',
      password: '123456',
      firstName: 'Greg ',
      lastName: 'Grise',
      imageUrl: 'assets/images/avatars/savov.jpg',
      candidateLevel: 'A',
      preferredLanguage: LanguagesEnum.ENGLISH
    }
  ];

	let counter = 0;
	// Generate default candidate users
	for (const candidate of defaultCandidates) {
		user = generateDefaultUser(candidate, role, tenant);
		defaultCandidateUsers.push(user);
		counter++;
	}
	return Promise.all(defaultCandidateUsers);
};

const generateDefaultUser = async (
	defaultUser: IDefaultUser,
	role: Role,
	tenant: Tenant
): Promise<User> => {
	const user = new User();
	const {
		firstName,
		lastName,
		email,
		imageUrl,
		preferredLanguage
	} = defaultUser;

	user.email = email;
	user.firstName = firstName;
	user.lastName = lastName;
	user.role = role;
	user.imageUrl = getUserDummyImage(user);
	user.imageUrl = imageUrl;
	user.tenant = tenant;
	user.preferredLanguage = preferredLanguage;

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
	users: User[]
): Promise<void> => {
	await connection
		.createQueryBuilder()
		.insert()
		.into(User)
		.values(users)
		.execute();
};
