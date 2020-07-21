require('dotenv').config();
import * as path from 'path';
import { IEnvironment } from './ienvironment';
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
	}
};
