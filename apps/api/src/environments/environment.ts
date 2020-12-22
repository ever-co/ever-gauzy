// This file can be replaced during build by using the `fileReplacements` array.
// `ng build ---prod` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.
require('dotenv').config();
import * as path from 'path';
import { IEnvironment, IGauzyFeatures } from './ienvironment';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { FileStorageProviderEnum } from '@gauzy/models';

const dbType =
	process.env.DB_TYPE && process.env.DB_TYPE === 'postgres'
		? 'postgres'
		: 'sqlite';

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
				path.join(
					path.resolve('.', ...['apps', 'api', 'data']),
					'gauzy.sqlite3'
				),
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
		dns: process.env.SENTRY_DSN
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
	gauzyAIGraphQLEndpoint: process.env.GAUZY_AI_GRAPHQL_ENDPOINT,

	smtpConfig: {
		host: process.env.MAIL_HOST,
		port: parseInt(process.env.MAIL_PORT, 10),
		secure: process.env.MAIL_PORT === '465' ? true : false, // true for 465, false for other ports
		auth: {
			user: process.env.MAIL_USERNAME,
			pass: process.env.MAIL_PASSWORD
		},
		from: process.env.MAIL_FROM_ADDRESS
	},
	defaultCurrency: process.env.DEFAULT_CURRENCY || 'USD'
};

export const gauzyToggleFeatures: IGauzyFeatures = {
	FEATURE_DASHBOARD: process.env.FEATURE_DASHBOARD === 'false' ? false : true,
	FEATURE_TIME_TRACKING:
		process.env.FEATURE_TIME_TRACKING === 'false' ? false : true,
	FEATURE_ESTIMATE: process.env.FEATURE_ESTIMATE === 'false' ? false : true,
	FEATURE_ESTIMATE_RECEIVED:
		process.env.FEATURE_ESTIMATE_RECEIVED === 'false' ? false : true,
	FEATURE_INVOICE: process.env.FEATURE_INVOICE === 'false' ? false : true,
	FEATURE_INVOICE_RECURRING:
		process.env.FEATURE_INVOICE_RECURRING === 'false' ? false : true,
	FEATURE_INVOICE_RECEIVED:
		process.env.FEATURE_INVOICE_RECEIVED === 'false' ? false : true,
	FEATURE_INCOME: process.env.FEATURE_INCOME === 'false' ? false : true,
	FEATURE_EXPENSE: process.env.FEATURE_EXPENSE === 'false' ? false : true,
	FEATURE_PAYMENT: process.env.FEATURE_PAYMENT === 'false' ? false : true,
	FEATURE_PROPOSAL: process.env.FEATURE_PROPOSAL === 'false' ? false : true,
	FEATURE_PROPOSAL_TEMPLATE:
		process.env.FEATURE_PROPOSAL_TEMPLATE === 'false' ? false : true,
	FEATURE_PIPELINE: process.env.FEATURE_PIPELINE === 'false' ? false : true,
	FEATURE_PIPELINE_DEAL:
		process.env.FEATURE_PIPELINE_DEAL === 'false' ? false : true,
	FEATURE_DASHBOARD_TASK:
		process.env.FEATURE_DASHBOARD_TASK === 'false' ? false : true,
	FEATURE_TEAM_TASK: process.env.FEATURE_TEAM_TASK === 'false' ? false : true,
	FEATURE_MY_TASK: process.env.FEATURE_MY_TASK === 'false' ? false : true,
	FEATURE_JOB: process.env.FEATURE_JOB === 'false' ? false : true,
	FEATURE_EMPLOYEES: process.env.FEATURE_EMPLOYEES === 'false' ? false : true,
	FEATURE_EMPLOYEE_TIME_ACTIVITY:
		process.env.FEATURE_EMPLOYEE_TIME_ACTIVITY === 'false' ? false : true,
	FEATURE_EMPLOYEE_TIMESHEETS:
		process.env.FEATURE_EMPLOYEE_TIMESHEETS === 'false' ? false : true,
	FEATURE_EMPLOYEE_APPOINTMENT:
		process.env.FEATURE_EMPLOYEE_APPOINTMENT === 'false' ? false : true,
	FEATURE_EMPLOYEE_APPROVAL:
		process.env.FEATURE_EMPLOYEE_APPROVAL === 'false' ? false : true,
	FEATURE_EMPLOYEE_APPROVAL_POLICY:
		process.env.FEATURE_EMPLOYEE_APPROVAL_POLICY === 'false' ? false : true,
	FEATURE_EMPLOYEE_LEVEL:
		process.env.FEATURE_EMPLOYEE_LEVEL === 'false' ? false : true,
	FEATURE_EMPLOYEE_POSITION:
		process.env.FEATURE_EMPLOYEE_POSITION === 'false' ? false : true,
	FEATURE_EMPLOYEE_TIMEOFF:
		process.env.FEATURE_EMPLOYEE_TIMEOFF === 'false' ? false : true,
	FEATURE_EMPLOYEE_RECURRING_EXPENSE:
		process.env.FEATURE_EMPLOYEE_RECURRING_EXPENSE === 'false'
			? false
			: true,
	FEATURE_EMPLOYEE_CANDIDATE:
		process.env.FEATURE_EMPLOYEE_CANDIDATE === 'false' ? false : true,
	FEATURE_MANAGE_INTERVIEW:
		process.env.FEATURE_MANAGE_INTERVIEW === 'false' ? false : true,
	FEATURE_MANAGE_INVITE:
		process.env.FEATURE_MANAGE_INVITE === 'false' ? false : true,
	FEATURE_ORGANIZATION:
		process.env.FEATURE_ORGANIZATION === 'false' ? false : true,
	FEATURE_ORGANIZATION_EQUIPMENT:
		process.env.FEATURE_ORGANIZATION_EQUIPMENT === 'false' ? false : true,
	FEATURE_ORGANIZATION_INVENTORY:
		process.env.FEATURE_ORGANIZATION_INVENTORY === 'false' ? false : true,
	FEATURE_ORGANIZATION_TAG:
		process.env.FEATURE_ORGANIZATION_TAG === 'false' ? false : true,
	FEATURE_ORGANIZATION_VENDOR:
		process.env.FEATURE_ORGANIZATION_VENDOR === 'false' ? false : true,
	FEATURE_ORGANIZATION_PROJECT:
		process.env.FEATURE_ORGANIZATION_PROJECT === 'false' ? false : true,
	FEATURE_ORGANIZATION_DEPARTMENT:
		process.env.FEATURE_ORGANIZATION_DEPARTMENT === 'false' ? false : true,
	FEATURE_ORGANIZATION_TEAM:
		process.env.FEATURE_ORGANIZATION_TEAM === 'false' ? false : true,
	FEATURE_ORGANIZATION_DOCUMENT:
		process.env.FEATURE_ORGANIZATION_DOCUMENT === 'false' ? false : true,
	FEATURE_ORGANIZATION_EMPLOYMENT_TYPE:
		process.env.FEATURE_ORGANIZATION_EMPLOYMENT_TYPE === 'false'
			? false
			: true,
	FEATURE_ORGANIZATION_RECURRING_EXPENSE:
		process.env.FEATURE_ORGANIZATION_RECURRING_EXPENSE === 'false'
			? false
			: true,
	FEATURE_ORGANIZATION_HELP_CENTER:
		process.env.FEATURE_ORGANIZATION_HELP_CENTER === 'false' ? false : true,
	FEATURE_CONTACT: process.env.FEATURE_CONTACT === 'false' ? false : true,
	FEATURE_GOAL: process.env.FEATURE_GOAL === 'false' ? false : true,
	FEATURE_GOAL_REPORT:
		process.env.FEATURE_GOAL_REPORT === 'false' ? false : true,
	FEATURE_GOAL_SETTING:
		process.env.FEATURE_GOAL_SETTING === 'false' ? false : true,
	FEATURE_REPORT: process.env.FEATURE_REPORT === 'false' ? false : true,
	FEATURE_USER: process.env.FEATURE_USER === 'false' ? false : true,
	FEATURE_ORGANIZATIONS:
		process.env.FEATURE_ORGANIZATIONS === 'false' ? false : true,
	FEATURE_APP_INTEGRATION:
		process.env.FEATURE_APP_INTEGRATION === 'false' ? false : true,
	FEATURE_SETTING: process.env.FEATURE_SETTING === 'false' ? false : true,
	FEATURE_EMAIL_HISTORY:
		process.env.FEATURE_EMAIL_HISTORY === 'false' ? false : true,
	FEATURE_EMAIL_TEMPLATE:
		process.env.FEATURE_EMAIL_TEMPLATE === 'false' ? false : true,
	FEATURE_IMPORT_EXPORT:
		process.env.FEATURE_IMPORT_EXPORT === 'false' ? false : true,
	FEATURE_FILE_STORAGE:
		process.env.FEATURE_FILE_STORAGE === 'false' ? false : true,
	FEATURE_PAYMENT_GATEWAY:
		process.env.FEATURE_PAYMENT_GATEWAY === 'false' ? false : true,
	FEATURE_SMS_GATEWAY:
		process.env.FEATURE_SMS_GATEWAY === 'false' ? false : true,
	FEATURE_SMTP: process.env.FEATURE_SMTP === 'false' ? false : true,
	FEATURE_ROLES_PERMISSION:
		process.env.FEATURE_ROLES_PERMISSION === 'false' ? false : true
};
