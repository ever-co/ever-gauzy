// This file can be replaced during build by using the `fileReplacements` array.
// `ng build ---prod` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.
require('dotenv').config();
import * as path from 'path';
import { IEnvironment } from './ienvironment';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { FileStorageProviderEnum } from '@gauzy/models';

const dbType =
	process.env.DB_TYPE && process.env.DB_TYPE === 'sqlite'
		? 'sqlite'
		: 'postgres';

let databaseConfig: TypeOrmModuleOptions;
if (process.env.IS_ELECTRON && process.env.GAUZY_USER_PATH) {
	require('app-root-path').setPath(process.env.GAUZY_USER_PATH);
}
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
			logger: 'file', //Removes console logging, instead logs all queries in a file ormlogs.log
			synchronize: true,
			uuidExtension: 'pgcrypto'
		};
		break;

	case 'sqlite':
		databaseConfig = {
			type: dbType,
			database:
				process.env.DB_PATH ||
				path.join(__dirname, '../../data/gauzy.sqlite3'),
			keepConnectionAlive: true,
			logging: true,
			logger: 'file', //Removes console logging, instead logs all queries in a file ormlogs.log
			synchronize: true
		};
		break;
}

console.log(`DB Config: ${JSON.stringify(databaseConfig)}`);

export const environment: IEnvironment = {
	port: process.env.port || 3000,
	host: process.env.host || 'http://localhost',
	baseUrl: process.env.BASE_URL || 'http://localhost:3000',

	production: false,
	envName: 'dev',

	env: {
		LOG_LEVEL: 'debug'
	},

	EXPRESS_SESSION_SECRET: 'gauzy',
	USER_PASSWORD_BCRYPT_SALT_ROUNDS: 12,
	JWT_SECRET: 'secretKey',

	fileSystem: {
		name:
			(process.env.FILE_PROVIDER as FileStorageProviderEnum) ||
			FileStorageProviderEnum.LOCAL
	},

	awsConfig: {
		accessKeyId: process.env.AWS_ACCESS_KEY_ID,
		secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
		region: process.env.AWS_REGION,
		s3: {
			bucket: process.env.AWS_S3_BUCKET
		}
	},

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

	sentry: {
		dns:
			process.env.SENTRY ||
			'https://19293d39eaa14d03aac4d3c156c4d30e@sentry.io/4397292'
	},

	defaultHubstaffUserPass:
		process.env.INTEGRATED_HUBSTAFF_USER_PASS || 'hubstaff',

	upworkConfig: {
		callbackUrl:
			process.env.UPWORK_CALLBACK_URL ||
			'http://localhost:4200/#/pages/integrations/upwork'
	},

	isElectron: process.env.IS_ELECTRON === 'true' ? true : false,
	gauzyUserPath: process.env.GAUZY_USER_PATH,
	allowSuperAdminRole:
		process.env.AllowSuperAdminRole === 'false' ? false : true,

	/**
	 * Endpoint for Gauzy AI API (optional), e.g.: http://localhost:3005/graphql
	 */
	gauzyAIGraphQLEndpoint: process.env.GAUZY_AI_GRAPHQL_ENDPOINT
};
