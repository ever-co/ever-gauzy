require('dotenv').config();
import * as path from 'path';
import { IEnvironment } from './ienvironment';
import {
	CurrenciesEnum,
	DefaultValueDateTypeEnum,
	LanguagesEnum
} from '@gauzy/models';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

const dbType =
	process.env.DB_TYPE && process.env.DB_TYPE === 'sqlite'
		? 'sqlite'
		: 'postgres';

let databaseConfig: TypeOrmModuleOptions;

switch (dbType) {
	case 'postgres':
		databaseConfig = {
			type: dbType,
			host: process.env.DB_HOST || 'localhost',
			port: process.env.DB_PORT
				? parseInt(process.env.DB_PORT, 10)
				: 5432,
			database: process.env.DB_NAME || 'postgres',
			username: process.env.DB_USER || 'postgres',
			password: process.env.DB_PASS || 'root',
			keepConnectionAlive: true,
			logging: true,
			synchronize: true,
			uuidExtension: 'pgcrypto'
		};
		break;

	case 'sqlite':
		databaseConfig = {
			type: dbType,
			database: path.join(__dirname, '../../data/gauzy.sqlite3'),
			keepConnectionAlive: true,
			logging: true,
			synchronize: true
		};
		break;
}

console.log(`DB Config: ${JSON.stringify(databaseConfig)}`);

export const environment: IEnvironment = {
	port: process.env.port || 3000,
	host: process.env.host || 'http://localhost',
	baseUrl: process.env.BASE_URL || 'http://localhost:3000',

	production: true,
	envName: 'prod',

	env: {
		LOG_LEVEL: 'debug'
	},

	EXPRESS_SESSION_SECRET: 'gauzy',
	USER_PASSWORD_BCRYPT_SALT_ROUNDS: 12,
	JWT_SECRET: 'secretKey',

	database: databaseConfig,

	facebookConfig: {
		loginDialogUri: 'https://www.facebook.com/v2.12/dialog/oauth',
		accessTokenUri: 'https://graph.facebook.com/v2.12/oauth/access_token',
		clientId: process.env.FacebookClientId,
		clientSecret: process.env.FacebookClientSecret,
		oauthRedirectUri: `${process.env.host}:${process.env.port}/api/auth/facebook/callback`,
		state: '{fbstate}'
	},

	googleConfig: {
		clientId: process.env.GoogleClientId,
		clientSecret: process.env.GoogleClientSecret
	},

	githubConfig: {
		clientId: process.env.GithubClientId,
		clientSecret: process.env.GithubClientSecret
	},

	microsoftConfig: {
		clientId: process.env.MicrosoftClientId,
		clientSecret: process.env.MicrosoftConfig,
		resource: process.env.MicrosoftResource,
		tenant: process.env.MicrosoftTenant
	},

	linkedinConfig: {
		clientId: process.env.LinkedinClientId,
		clientSecret: process.env.LinkedinClientSecret
	},

	twitterConfig: {
		clientId: process.env.TwitterClientId,
		clientSecret: process.env.TwitterClientSecret
	},

	fiverrConfig: {
		clientId: process.env.FiverrClientId,
		clientSecret: process.env.FiverrClientSecret
	},

	keycloakConfig: {
		realm: process.env.KeycloakRealm,
		clientId: process.env.KeycloakClientId,
		secret: process.env.KeycloakSecret,
		authServerUrl: process.env.KeycloakAuthServerURL,
		cookieKey: process.env.KeycloakCookieKey
	},

	auth0Config: {
		clientID: process.env.Auth0ClientId,
		clientSecret: process.env.Auth0ClientSecret,
		domain: process.env.Auth0Domanin
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
			],
			manager: ['ruslan@ever.co']
		},
		{
			name: 'Contractors',
			defaultMembers: ['atanas@ever.co', 'dimana@ever.co'],
			manager: ['ruslan@ever.co', 'rachit@ever.co']
		},
		{
			name: 'Designers',
			defaultMembers: ['julia@ever.co', 'yordan@ever.co'],
			manager: []
		},
		{
			name: 'QA',
			defaultMembers: ['julia@ever.co', 'yordan@ever.co'],
			manager: []
		}
	],

	sentry: {
		dns:
			process.env.SENTRY ||
			'https://19293d39eaa14d03aac4d3c156c4d30e@sentry.io/4397292'
	},

	randomSeedConfig: {
		tenants: 5,
		organizationsPerTenant: 10,
		employeesPerOrganization: 10,
		candidatesPerOrganization: 2,
		managersPerOrganization: 2,
		dataEntriesPerOrganization: 4,
		viewersPerOrganization: 4,
		projectsPerOrganization: 30,
		emailsPerOrganization: 30,
		invitePerOrganization: 30,
		requestApprovalPerOrganization: 20,
		employeeTimeOffPerOrganization: 10,
		equipmentPerTenant: 20,
		equipmentSharingPerTenant: 20,
		proposalsSharingPerOrganizations: 30
	},

	defaultHubstaffUserPass:
		process.env.INTEGRATED_HUBSTAFF_USER_PASS || 'hubstaff',

	upworkConfig: {
		callbackUrl:
			process.env.UPWORK_CALLBACK_URL ||
			'http://localhost:4200/#/pages/integrations/upwork'
	}
};
