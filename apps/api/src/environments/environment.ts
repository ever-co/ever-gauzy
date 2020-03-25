// This file can be replaced during build by using the `fileReplacements` array.
// `ng build ---prod` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.
require('dotenv').config();
import { IEnvironment } from './ienvironment';
import { CurrenciesEnum, DefaultValueDateTypeEnum } from '@gauzy/models';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

const databaseConfig: TypeOrmModuleOptions = {
	type: 'postgres', // TODO: process process.env.DB_TYPE value (we need to create different options obj depending on it)
	host: process.env.DB_HOST || 'localhost',
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

	production: false,
	envName: 'dev',

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
		clientId:
			process.env.GoogleClientId ||
			'1061129983046-pt4tnjteh9h1phfqapqkkea03iq0s351.apps.googleusercontent.com',
		clientSecret:
			process.env.GoogleClientSecret || 'liU5ihpwoqnsmXJNxNjFp1yP'
	},

	defaultOrganization: {
		name: 'Ever Technologies LTD',
		currency: CurrenciesEnum.BGN,
		defaultValueDateType: DefaultValueDateTypeEnum.TODAY,
		imageUrl: 'assets/images/logos/ever-large.jpg'
	},

	defaultAdmins: [
		{
			email: 'admin@ever.co',
			password: 'admin',
			imageUrl: 'assets/images/avatars/ruslan.jpg'
		}
	],

	defaultEmployees: [
		{
			email: 'alish@ever.co',
			password: '123456',
			firstName: 'Alish',
			lastName: 'Meklyov',
			imageUrl: 'assets/images/avatars/alish.jpg',
			startedWorkOn: '20.03.2018',
			employeeLevel: 'D'
		},
		{
			email: 'blagovest@ever.co',
			password: '123456',
			firstName: 'Blagovest',
			lastName: 'Gerov',
			imageUrl: 'assets/images/avatars/blagovest.jpg',
			startedWorkOn: '19.03.2018',
			employeeLevel: 'D'
		},
		{
			email: 'elvis@ever.co',
			password: '123456',
			firstName: 'Elvis',
			lastName: 'Arabadjiiski',
			imageUrl: 'assets/images/avatars/elvis.jpg',
			startedWorkOn: '25.05.2018',
			employeeLevel: 'C'
		},
		{
			email: 'emil@ever.co',
			password: '123456',
			firstName: 'Emil',
			lastName: 'Momchilov',
			imageUrl: 'assets/images/avatars/emil.jpg',
			startedWorkOn: '21.01.2019',
			employeeLevel: 'C'
		},
		{
			email: 'boyan@ever.co',
			password: '123456',
			firstName: 'Boyan',
			lastName: 'Stanchev',
			imageUrl: 'assets/images/avatars/boyan.jpg',
			startedWorkOn: '21.01.2019',
			employeeLevel: 'C'
		},
		{
			email: 'hristo@ever.co',
			password: '123456',
			firstName: 'Hristo',
			lastName: 'Hristov',
			imageUrl: 'assets/images/avatars/hristo.jpg',
			startedWorkOn: '17.06.2019',
			employeeLevel: 'B'
		},
		{
			email: 'alex@ever.co',
			password: '123456',
			firstName: 'Aleksandar',
			lastName: 'Tasev',
			imageUrl: 'assets/images/avatars/alexander.jpg',
			startedWorkOn: '01.08.2019',
			employeeLevel: 'B'
		},
		{
			email: 'rachit@ever.co',
			password: '123456',
			firstName: 'Rachit',
			lastName: 'Magon',
			imageUrl: 'assets/images/avatars/rachit.png',
			startedWorkOn: '27.11.2019',
			employeeLevel: null
		},
		{
			email: 'atanas@ever.co',
			password: '123456',
			firstName: 'Atanas',
			lastName: 'Yonkov',
			imageUrl: 'assets/images/avatars/atanas.jpeg',
			startedWorkOn: '01.02.2020',
			employeeLevel: 'A'
		},
		{
			email: 'dimana@ever.co',
			password: '123456',
			firstName: 'Dimana',
			lastName: 'Tsvetkova',
			imageUrl: 'assets/images/avatars/dimana.jpeg',
			startedWorkOn: '26.11.2019',
			employeeLevel: null
		},
		{
			email: 'sunko@ever.co',
			password: '123456',
			firstName: 'Alexander',
			lastName: 'Savov',
			imageUrl: 'assets/images/avatars/savov.jpg',
			startedWorkOn: '04.02.2020',
			employeeLevel: 'A'
		},
		{
			email: 'lubomir@ever.co',
			password: '123456',
			firstName: 'Lubomir',
			lastName: 'Petrov',
			imageUrl: 'assets/images/avatars/lubomir.jpg',
			startedWorkOn: '06.02.2020',
			employeeLevel: 'A'
		},
		{
			email: 'pavel@ever.co',
			password: '123456',
			firstName: 'Pavel',
			lastName: 'Denchev',
			imageUrl: 'assets/images/avatars/pavel.jpg',
			startedWorkOn: '16.03.2020',
			employeeLevel: 'A'
		},
		{
			email: 'yavor@ever.co',
			password: '123456',
			firstName: 'Yavor',
			lastName: 'Grancharov',
			imageUrl: 'assets/images/avatars/yavor.jpg',
			startedWorkOn: '05.02.2020',
			employeeLevel: 'A'
		},
		{
			email: 'tsvetelina@ever.co',
			password: '123456',
			firstName: 'Tsvetelina',
			lastName: 'Yordanova',
			imageUrl: 'assets/images/avatars/tsvetelina.jpg',
			startedWorkOn: '02.03.2020',
			employeeLevel: 'A'
		},
		{
			email: 'everq@ever.co',
			password: '123456',
			firstName: 'Ruslan',
			lastName: 'Konviser',
			imageUrl: 'assets/images/avatars/ruslan.jpg',
			startedWorkOn: '01.08.2018',
			employeeLevel: 'C'
		},
		{
			email: 'muiz@smooper.xyz',
			password: '123456',
			firstName: 'Muiz',
			lastName: 'Nadeem',
			imageUrl: 'assets/images/avatars/muiz.jpg',
			startedWorkOn: '27.11.2019',
			employeeLevel: null
		},
		{
			email: 'deko898@hotmail.com',
			password: '123456',
			firstName: 'Dejan',
			lastName: 'Obradovikj',
			imageUrl: 'assets/images/avatars/dejan.jpg',
			startedWorkOn: '07.03.2020',
			employeeLevel: null
		},
		{
			email: 'ckhandla94@gmail.com',
			password: '123456',
			firstName: 'Chetan',
			lastName: 'Khandla',
			imageUrl: 'assets/images/avatars/chetan.png',
			startedWorkOn: '07.03.2020',
			employeeLevel: null
		},
		{
			email: 'julia@ever.co',
			password: '123456',
			firstName: 'Julia',
			lastName: 'Konviser',
			imageUrl: 'assets/images/avatars/julia.png',
			startedWorkOn: '01.08.2018',
			employeeLevel: 'C'
		},
		{
			email: '',
			password: '123456',
			firstName: 'Milena',
			lastName: 'Dimova',
			imageUrl: 'assets/images/avatars/milena.png',
			startedWorkOn: '15.07.2019',
			employeeLevel: 'A'
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
				'atanas@ever.co',
				'hristo@ever.co',
				'alex@ever.co',
				'milena@ever.co',
				'sunko@ever.co',
				'lubomir@ever.co',
				'pavel@ever.co',
				'yavor@ever.co',
				'tsvetelina@ever.co',
				'everq@ever.co',
				'julia@ever.co'
			]
		},
		{
			name: 'Contractors',
			defaultMembers: [
				'rachit@ever.co',
				'dimana@ever.co',
				'deko898@hotmail.com',
				'muiz@smooper.xyz',
				'ckhandla94@gmail.com'
			]
		}
	],
	sentry: {
		dns: 'https://19293d39eaa14d03aac4d3c156c4d30e@sentry.io/4397292'
	}
};
