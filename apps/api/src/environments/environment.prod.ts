require('dotenv').config();
import { IEnvironment } from './ienvironment';
import {
	CurrenciesEnum,
	DefaultValueDateTypeEnum,
	LanguagesEnum
} from '@gauzy/models';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

const databaseConfig: TypeOrmModuleOptions = {
	type: 'postgres', // TODO: process process.env.DB_TYPE value (we need to create different options obj depending on it)
	host: process.env.DB_HOST || 'db',
	port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432,
	database: process.env.DB_NAME || 'postgres',
	username: process.env.DB_USER || 'postgres',
	password: process.env.DB_PASS || 'root',
	keepConnectionAlive: true,
	logging: true,
	synchronize: true,
	uuidExtension: 'pgcrypto'
};

console.log(`DB Config: ${JSON.stringify(databaseConfig)}`);

export const environment: IEnvironment = {
	// TODO: port & host used in FB / Google Auth, but we probably should detect that some other way instead of have it as env settings!
	port: process.env.port || 3000,
	host: process.env.host || 'http://localhost',

	production: true,
	envName: 'prod',

	env: {
		LOG_LEVEL: 'debug'
	},

	USER_PASSWORD_BCRYPT_SALT_ROUNDS: 12,
	JWT_SECRET: 'secretKey',

	database: databaseConfig,

	facebookConfig: {
		loginDialogUri: 'https://www.facebook.com/v2.12/dialog/oauth',
		accessTokenUri: 'https://graph.facebook.com/v2.12/oauth/access_token',
		clientId: process.env.FacebookClientId || 'fakeclientid',
		clientSecret: process.env.FacebookClientSecret || 'fakesecret',
		oauthRedirectUri: `${process.env.host}:${process.env.port}/api/auth/facebook/callback`,
		state: '{fbstate}'
	},

	googleConfig: {
		clientId: process.env.GoogleClientId || 'fakeclientid',
		clientSecret: process.env.GoogleClientSecret || 'fakesecret'
	},

	defaultOrganizations: [
		{
			name: 'Ever Technologies LTD',
			currency: CurrenciesEnum.BGN,
			defaultValueDateType: DefaultValueDateTypeEnum.TODAY,
			imageUrl: 'assets/images/logos/ever-large.jpg'
		},
		{
			name: 'Ever Co. Ltd',
			currency: CurrenciesEnum.BGN,
			defaultValueDateType: DefaultValueDateTypeEnum.TODAY,
			imageUrl: 'assets/images/logos/ever-large.jpg'
		}
	],

	defaultSuperAdmins: [
		{
			email: 'admin@ever.co',
			password: 'admin',
			imageUrl: 'assets/images/avatars/ruslan.jpg',
			preferredLanguage: LanguagesEnum.ENGLISH
		}
	],

	defaultAdmins: [
		{
			email: 'local.admin@ever.co',
			password: 'admin',
			imageUrl: 'assets/images/avatars/ruslan.jpg',
			preferredLanguage: LanguagesEnum.ENGLISH
		}
	],

	defaultEmployees: [
		{
			email: 'alish@ever.co',
			password: '123456',
			firstName: 'Alish',
			lastName: 'Meklyov',
			imageUrl: 'assets/images/avatars/alish.jpg',
			preferredLanguage: LanguagesEnum.ENGLISH
		},
		{
			email: 'blagovest@ever.co',
			password: '123456',
			firstName: 'Blagovest',
			lastName: 'Gerov',
			imageUrl: 'assets/images/avatars/blagovest.jpg',
			preferredLanguage: LanguagesEnum.ENGLISH
		},
		{
			email: 'elvis@ever.co',
			password: '123456',
			firstName: 'Elvis',
			lastName: 'Arabadjiiski',
			imageUrl: 'assets/images/avatars/elvis.jpg',
			preferredLanguage: LanguagesEnum.ENGLISH
		},
		{
			email: 'emil@ever.co',
			password: '123456',
			firstName: 'Emil',
			lastName: 'Momchilov',
			imageUrl: 'assets/images/avatars/emil.jpg',
			preferredLanguage: LanguagesEnum.ENGLISH
		},
		{
			email: 'boyan@ever.co',
			password: '123456',
			firstName: 'Boyan',
			lastName: 'Stanchev',
			imageUrl: 'assets/images/avatars/boyan.jpg',
			preferredLanguage: LanguagesEnum.ENGLISH
		},
		{
			email: 'hristo@ever.co',
			password: '123456',
			firstName: 'Hristo',
			lastName: 'Hristov',
			imageUrl: 'assets/images/avatars/hristo.jpg',
			preferredLanguage: LanguagesEnum.ENGLISH
		},
		{
			email: 'alex@ever.co',
			password: '123456',
			firstName: 'Aleksandar',
			lastName: 'Tasev',
			imageUrl: 'assets/images/avatars/alexander.jpg',
			preferredLanguage: LanguagesEnum.ENGLISH
		},
		{
			email: 'milena@ever.co',
			password: '123456',
			firstName: 'Milena',
			lastName: 'Dimova',
			imageUrl: 'assets/images/avatars/milena.jpg',
			preferredLanguage: LanguagesEnum.ENGLISH
		},
		{
			email: 'rachit@ever.co',
			password: '123456',
			firstName: 'Rachit',
			lastName: 'Magon',
			imageUrl: 'assets/images/avatars/rachit.png',
			preferredLanguage: LanguagesEnum.ENGLISH
		},
		{
			email: 'atanas@ever.co',
			password: '123456',
			firstName: 'Atanas',
			lastName: 'Yonkov',
			imageUrl: 'assets/images/avatars/atanas.jpeg',
			preferredLanguage: LanguagesEnum.ENGLISH
		},
		{
			email: 'dimana@ever.co',
			password: '123456',
			firstName: 'Dimana',
			lastName: 'Tsvetkova',
			imageUrl: 'assets/images/avatars/dimana.jpeg',
			preferredLanguage: LanguagesEnum.ENGLISH
		}
	],
	defaultCandidates: [
		{
			email: 'alish@ever.co',
			password: '123456',
			firstName: 'Alish',
			lastName: 'Meklyov',
			imageUrl: 'assets/images/avatars/alish.jpg',
			preferredLanguage: LanguagesEnum.ENGLISH
		}
	],
	defaultTeams: [
		{
			name: 'Employees',
			defaultMembers: [
				'admin@ever.co',
				'alish@ever.co',
				'blagovest@ever.co',
				'elvis@ever.co',
				'emil@ever.co',
				'boyan@ever.co',
				'hristo@ever.co',
				'alex@ever.co',
				'milena@ever.co'
			]
		},
		{
			name: 'Candidates',
			defaultMembers: ['alish@ever.co']
		},
		{
			name: 'Contractors',
			defaultMembers: [
				'rachit@ever.co',
				'atanas@ever.co',
				'dimana@ever.co'
			]
		}
	],
	sentry: {
		dns: 'https://19293d39eaa14d03aac4d3c156c4d30e@sentry.io/4397292'
	},
	randomSeedConfig: {
		tenants: 5,
		organizationsPerTenant: 10,
		employeesPerOrganization: 10,
		candidatesPerOrganization: 2
	},

	defaultHubstaffUserPass:
		process.env.INTEGRATED_HUBSTAFF_USER_PASS || 'hubstaff',

	upworkConfig: {
		callbackUrl:
			process.env.UWPROK_CALLBACK_URL ||
			'http://localhost:4200/#/pages/integrations/upwork'
	}
};
