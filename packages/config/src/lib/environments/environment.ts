/** This file can be replaced during build by using the `fileReplacements` array.
 * `ng build ---prod` replaces `environment.ts` with `environment.prod.ts`.
 * The list of file replacements can be found in `angular.json`.
 */

// see https://github.com/motdotla/dotenv#how-do-i-use-dotenv-with-import
import * as dotenv from 'dotenv';
dotenv.config();

import { FileStorageProviderEnum } from '@gauzy/contracts';
import { IEnvironment, IGauzyFeatures } from './ienvironment';
import { isFeatureEnabled } from './environment.helper';

if (process.env.IS_ELECTRON && process.env.GAUZY_USER_PATH) {
	require('app-root-path').setPath(process.env.GAUZY_USER_PATH);
}

export const environment: IEnvironment = {
	port: process.env.API_PORT || 3000,
	host: process.env.API_HOST || 'http://localhost',
	baseUrl: process.env.API_BASE_URL || 'http://localhost:3000',
	clientBaseUrl: process.env.CLIENT_BASE_URL || 'http://localhost:4200',
	production: false,
	envName: 'dev',

	env: {
		LOG_LEVEL: 'debug'
	},

	EXPRESS_SESSION_SECRET: process.env.EXPRESS_SESSION_SECRET || 'gauzy',
	USER_PASSWORD_BCRYPT_SALT_ROUNDS: 12,

	JWT_SECRET: process.env.JWT_SECRET || 'secretKey',
	JWT_TOKEN_EXPIRATION_TIME: parseInt(process.env.JWT_TOKEN_EXPIRATION_TIME) || 86400 * 1, // default JWT token expire time (1 day)

	JWT_REFRESH_TOKEN_SECRET: process.env.JWT_REFRESH_TOKEN_SECRET || 'refreshSecretKey',
	JWT_REFRESH_TOKEN_EXPIRATION_TIME: parseInt(process.env.JWT_REFRESH_TOKEN_EXPIRATION_TIME) || 86400 * 7, // default JWT refresh token expire time (7 days)

	/**
	 * Email verification options
	 */
	JWT_VERIFICATION_TOKEN_SECRET: process.env.JWT_VERIFICATION_TOKEN_SECRET || 'verificationSecretKey',
	JWT_VERIFICATION_TOKEN_EXPIRATION_TIME: parseInt(process.env.JWT_VERIFICATION_TOKEN_EXPIRATION_TIME) || 86400 * 7, // default verification expire token time (7 days)

	/**
	 * Email Reset
	 */
	EMAIL_RESET_EXPIRATION_TIME: parseInt(process.env.EMAIL_RESET_EXPIRATION_TIME) || 1800, // default email reset expiration time (30 minutes)

	/**
	 * Password Less Authentication Configuration
	 */
	MAGIC_CODE_EXPIRATION_TIME: parseInt(process.env.MAGIC_CODE_EXPIRATION_TIME) || 60 * 30, // default magic code expire time (30 minutes)

	/** Organization Team Join Request Configuration **/
	TEAM_JOIN_REQUEST_EXPIRATION_TIME: parseInt(process.env.TEAM_JOIN_REQUEST_EXPIRATION_TIME) || 60 * 60 * 24, // default code expire time (1 day)

	/**
	 * Throttler (Rate Limiting) Options
	 */
	THROTTLE_TTL: parseInt(process.env.THROTTLE_TTL) || 60 * 1000,
	THROTTLE_LIMIT: parseInt(process.env.THROTTLE_LIMIT) || 60000,
	THROTTLE_ENABLED: process.env.THROTTLE_ENABLED == 'true',

	/**
	 * Jitsu Server Configuration
	 */
	jitsu: {
		serverHost: process.env.JITSU_SERVER_URL,
		serverWriteKey: process.env.JITSU_SERVER_WRITE_KEY,
		debug: process.env.JITSU_SERVER_DEBUG === 'true',
		echoEvents: process.env.JITSU_SERVER_ECHO_EVENTS === 'true'
	},

	fileSystem: {
		name: (process.env.FILE_PROVIDER as FileStorageProviderEnum) || FileStorageProviderEnum.LOCAL
	},

	awsConfig: {
		accessKeyId: process.env.AWS_ACCESS_KEY_ID,
		secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
		region: process.env.AWS_REGION || 'us-east-1',
		s3: {
			bucket: process.env.AWS_S3_BUCKET || 'gauzy',
			forcePathStyle: process.env.AWS_S3_FORCE_PATH_STYLE === 'true' || false
		}
	},

	/**
	 * Wasabi Configuration
	 */
	wasabi: {
		accessKeyId: process.env.WASABI_ACCESS_KEY_ID,
		secretAccessKey: process.env.WASABI_SECRET_ACCESS_KEY,
		region: process.env.WASABI_REGION || 'us-east-1',
		serviceUrl: process.env.WASABI_SERVICE_URL || 'https://s3.wasabisys.com',
		s3: {
			bucket: process.env.WASABI_S3_BUCKET || 'gauzy',
			forcePathStyle: process.env.WASABI_S3_FORCE_PATH_STYLE === 'true' || false
		}
	},

	/**
	 * DigitalOcean Spaces Configuration
	 */
	digitalOcean: {
		accessKeyId: process.env.DIGITALOCEAN_ACCESS_KEY_ID,
		secretAccessKey: process.env.DIGITALOCEAN_SECRET_ACCESS_KEY,
		region: process.env.DIGITALOCEAN_REGION || 'us-east-1',
		serviceUrl: process.env.DIGITALOCEAN_SERVICE_URL || 'https://gauzy.sfo2.digitaloceanspaces.com', // Find your endpoint in the control panel, under Settings. Prepend "https://".
		cdnUrl: process.env.DIGITALOCEAN_CDN_URL,
		s3: {
			bucket: process.env.DIGITALOCEAN_S3_BUCKET || 'gauzy',
			forcePathStyle: process.env.DIGITALOCEAN_S3_FORCE_PATH_STYLE === 'true' || false // Configures to use subdomain/virtual calling format.
		}
	},

	/**
	 * Cloudinary FileSystem Storage Configuration
	 */
	cloudinary: {
		cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
		api_key: process.env.CLOUDINARY_API_KEY,
		api_secret: process.env.CLOUDINARY_API_SECRET,
		secure: process.env.CLOUDINARY_API_SECURE === 'false' ? false : true,
		delivery_url: process.env.CLOUDINARY_CDN_URL || `https://res.cloudinary.com`
	},

	github: {
		/** Github App Install Configuration  */
		clientId: process.env.GAUZY_GITHUB_CLIENT_ID,
		clientSecret: process.env.GAUZY_GITHUB_CLIENT_SECRET,
		appId: process.env.GAUZY_GITHUB_APP_ID,
		appName: process.env.GAUZY_GITHUB_APP_NAME,
		appPrivateKey: process.env.GAUZY_GITHUB_APP_PRIVATE_KEY
			? Buffer.from(process.env.GAUZY_GITHUB_APP_PRIVATE_KEY, 'base64').toString('ascii')
			: '',

		/** Github App Post Install Configuration */
		postInstallUrl:
			process.env.GAUZY_GITHUB_POST_INSTALL_URL ||
			`${process.env.CLIENT_BASE_URL}/#/pages/integrations/github/setup/installation`,

		/** Github Webhook Configuration */
		webhookSecret: process.env.GAUZY_GITHUB_WEBHOOK_SECRET,
		webhookUrl: process.env.GAUZY_GITHUB_WEBHOOK_URL || `${process.env.API_BASE_URL}/api/integration/github/webhook`
	},

	jira: {
		/** Jira Integration Configuration */
		appName: process.env.GAUZY_JIRA_APP_NAME,
		appDescription: process.env.GAUZY_JIRA_APP_DESCRIPTION,
		appKey: process.env.GAUZY_JIRA_APP_KEY,
		baseUrl: process.env.GAUZY_JIRA_APP_BASE_URL,
		vendorName: process.env.GAUZY_JIRA_APP_BASE_VENDOR_NAME,
		vendorUrl: process.env.GAUZY_JIRA_APP_BASE_VENDOR_URL
	},

	fiverrConfig: {
		clientId: process.env.FIVERR_CLIENT_ID,
		clientSecret: process.env.FIVERR_CLIENT_SECRET
	},

	keycloakConfig: {
		realm: process.env.KEYCLOAK_REALM,
		clientId: process.env.KEYCLOAK_CLIENT_ID,
		secret: process.env.KEYCLOAK_SECRET,
		authServerUrl: process.env.KEYCLOAK_AUTH_SERVER_URL,
		cookieKey: process.env.KEYCLOAK_COOKIE_KEY
	},

	auth0Config: {
		clientID: process.env.AUTH0_CLIENT_ID,
		clientSecret: process.env.AUTH0_CLIENT_SECRET,
		domain: process.env.AUTH0_DOMAIN
	},

	sentry: {
		dsn: process.env.SENTRY_DSN
	},

	defaultIntegratedUserPass: process.env.INTEGRATED_USER_DEFAULT_PASS || '123456',

	upwork: {
		apiKey: process.env.UPWORK_API_KEY,
		apiSecret: process.env.UPWORK_API_SECRET,
		callbackUrl: process.env.UPWORK_REDIRECT_URL || `${process.env.API_BASE_URL}/api/integrations/upwork/callback`,
		postInstallUrl:
			process.env.UPWORK_POST_INSTALL_URL || `${process.env.CLIENT_BASE_URL}/#/pages/integrations/upwork`
	},

	hubstaff: {
		/** Hubstaff Integration Configuration */
		clientId: process.env.HUBSTAFF_CLIENT_ID,
		clientSecret: process.env.HUBSTAFF_CLIENT_SECRET,
		/** Hubstaff Integration Post Install URL */
		postInstallUrl:
			process.env.HUBSTAFF_POST_INSTALL_URL || `${process.env.CLIENT_BASE_URL}/#/pages/integrations/hubstaff`
	},

	isElectron: process.env.IS_ELECTRON === 'true' ? true : false,
	gauzyUserPath: process.env.GAUZY_USER_PATH,
	gauzySeedPath: process.env.GAUZY_SEED_PATH,
	allowSuperAdminRole: process.env.ALLOW_SUPER_ADMIN_ROLE === 'false' ? false : true,

	/**
	 * Endpoint for Gauzy AI API (optional), e.g.: http://localhost:3005/graphql
	 */
	gauzyAIGraphQLEndpoint: process.env.GAUZY_AI_GRAPHQL_ENDPOINT,

	/**
	 * Endpoint for Gauzy AI REST API (optional), e.g.: http://localhost:3005/api
	 */
	gauzyAIRESTEndpoint: process.env.GAUZY_AI_REST_ENDPOINT,

	gauzyCloudEndpoint: process.env.GAUZY_CLOUD_ENDPOINT,

	smtpConfig: {
		host: process.env.MAIL_HOST,
		port: parseInt(process.env.MAIL_PORT, 10),
		secure: process.env.MAIL_PORT === '465' ? true : false, // true for 465, false for other ports
		auth: {
			user: process.env.MAIL_USERNAME,
			pass: process.env.MAIL_PASSWORD
		},
		fromAddress: process.env.MAIL_FROM_ADDRESS
	},

	defaultCurrency: process.env.DEFAULT_CURRENCY || 'USD',

	unleashConfig: {
		// if UNLEASH_API_URL is not set / empty or it's a spaces only, we consider UNLEASH disabled
		url: process.env.UNLEASH_API_URL ? process.env.UNLEASH_API_URL.trim() : '',
		appName: process.env.UNLEASH_APP_NAME,
		environment: 'development',
		instanceId: process.env.UNLEASH_INSTANCE_ID,
		refreshInterval: parseInt(process.env.UNLEASH_REFRESH_INTERVAL) || 15000,
		metricsInterval: parseInt(process.env.UNLEASH_METRICS_INTERVAL) || 60000,
		apiKey: process.env.UNLEASH_API_KEY
	},

	/**
	 * Email Template Config
	 */
	appIntegrationConfig: {
		appName: process.env.APP_NAME || 'Gauzy',
		appLogo: process.env.APP_LOGO || `${process.env.CLIENT_BASE_URL}/assets/images/logos/logo_Gauzy.png`,
		appSignature: process.env.APP_SIGNATURE || 'Gauzy Team',
		appLink: process.env.APP_LINK || 'http://localhost:4200/',
		appEmailConfirmationUrl:
			process.env.APP_EMAIL_CONFIRMATION_URL || `${process.env.CLIENT_BASE_URL}/#/auth/confirm-email`,
		appMagicSignUrl: process.env.APP_MAGIC_SIGN_URL || `${process.env.CLIENT_BASE_URL}/#/auth/magic-sign-in`,
		companyLink: process.env.COMPANY_LINK || 'https://ever.co',
		companyName: process.env.COMPANY_NAME || 'Ever Co. LTD'
	},

	demo: process.env.DEMO === 'true' ? true : false,

	demoCredentialConfig: {
		superAdminEmail: process.env.DEMO_SUPER_ADMIN_EMAIL || `admin@ever.co`,
		superAdminPassword: process.env.DEMO_SUPER_ADMIN_PASSWORD || `admin`,
		adminEmail: process.env.DEMO_ADMIN_EMAIL || `local.admin@ever.co`,
		adminPassword: process.env.DEMO_ADMIN_PASSWORD || `admin`,
		employeeEmail: process.env.DEMO_EMPLOYEE_EMAIL || `employee@ever.co`,
		employeePassword: process.env.DEMO_EMPLOYEE_PASSWORD || `123456`
	},

	/**
	 * Periodic Time Save
	 */
	periodicTimeSave: process.env.PERIODIC_TIME_SAVE === 'true',
	periodicTimeSaveTimeframe: parseInt(process.env.PERIODIC_TIME_SAVE_TIMEFRAME) || 600 // 10 minutes
};

/**
 * Gauzy Toggle Features
 */
export const gauzyToggleFeatures: IGauzyFeatures = {
	FEATURE_DASHBOARD: isFeatureEnabled('FEATURE_DASHBOARD'),
	FEATURE_TIME_TRACKING: isFeatureEnabled('FEATURE_TIME_TRACKING'),
	FEATURE_ESTIMATE: isFeatureEnabled('FEATURE_ESTIMATE'),
	FEATURE_ESTIMATE_RECEIVED: isFeatureEnabled('FEATURE_ESTIMATE_RECEIVED'),
	FEATURE_INVOICE: isFeatureEnabled('FEATURE_INVOICE'),
	FEATURE_INVOICE_RECURRING: isFeatureEnabled('FEATURE_INVOICE_RECURRING'),
	FEATURE_INVOICE_RECEIVED: isFeatureEnabled('FEATURE_INVOICE_RECEIVED'),
	FEATURE_INCOME: isFeatureEnabled('FEATURE_INCOME'),
	FEATURE_EXPENSE: isFeatureEnabled('FEATURE_EXPENSE'),
	FEATURE_PAYMENT: isFeatureEnabled('FEATURE_PAYMENT'),
	FEATURE_PROPOSAL: isFeatureEnabled('FEATURE_PROPOSAL'),
	FEATURE_PROPOSAL_TEMPLATE: isFeatureEnabled('FEATURE_PROPOSAL_TEMPLATE'),
	FEATURE_PIPELINE: isFeatureEnabled('FEATURE_PIPELINE'),
	FEATURE_PIPELINE_DEAL: isFeatureEnabled('FEATURE_PIPELINE_DEAL'),
	FEATURE_DASHBOARD_TASK: isFeatureEnabled('FEATURE_DASHBOARD_TASK'),
	FEATURE_TEAM_TASK: isFeatureEnabled('FEATURE_TEAM_TASK'),
	FEATURE_MY_TASK: isFeatureEnabled('FEATURE_MY_TASK'),
	FEATURE_JOB: isFeatureEnabled('FEATURE_JOB'),
	FEATURE_EMPLOYEES: isFeatureEnabled('FEATURE_EMPLOYEES'),
	FEATURE_EMPLOYEE_TIME_ACTIVITY: isFeatureEnabled('FEATURE_EMPLOYEE_TIME_ACTIVITY'),
	FEATURE_EMPLOYEE_TIMESHEETS: isFeatureEnabled('FEATURE_EMPLOYEE_TIMESHEETS'),
	FEATURE_EMPLOYEE_APPOINTMENT: isFeatureEnabled('FEATURE_EMPLOYEE_APPOINTMENT'),
	FEATURE_EMPLOYEE_APPROVAL: isFeatureEnabled('FEATURE_EMPLOYEE_APPROVAL'),
	FEATURE_EMPLOYEE_APPROVAL_POLICY: isFeatureEnabled('FEATURE_EMPLOYEE_APPROVAL_POLICY'),
	FEATURE_EMPLOYEE_LEVEL: isFeatureEnabled('FEATURE_EMPLOYEE_LEVEL'),
	FEATURE_EMPLOYEE_POSITION: isFeatureEnabled('FEATURE_EMPLOYEE_POSITION'),
	FEATURE_EMPLOYEE_TIMEOFF: isFeatureEnabled('FEATURE_EMPLOYEE_TIMEOFF'),
	FEATURE_EMPLOYEE_RECURRING_EXPENSE: isFeatureEnabled('FEATURE_EMPLOYEE_RECURRING_EXPENSE'),
	FEATURE_EMPLOYEE_CANDIDATE: isFeatureEnabled('FEATURE_EMPLOYEE_CANDIDATE'),
	FEATURE_MANAGE_INTERVIEW: isFeatureEnabled('FEATURE_MANAGE_INTERVIEW'),
	FEATURE_MANAGE_INVITE: isFeatureEnabled('FEATURE_MANAGE_INVITE'),
	FEATURE_ORGANIZATION: isFeatureEnabled('FEATURE_ORGANIZATION'),
	FEATURE_ORGANIZATION_EQUIPMENT: isFeatureEnabled('FEATURE_ORGANIZATION_EQUIPMENT'),
	FEATURE_ORGANIZATION_INVENTORY: isFeatureEnabled('FEATURE_ORGANIZATION_INVENTORY'),
	FEATURE_ORGANIZATION_TAG: isFeatureEnabled('FEATURE_ORGANIZATION_TAG'),
	FEATURE_ORGANIZATION_VENDOR: isFeatureEnabled('FEATURE_ORGANIZATION_VENDOR'),
	FEATURE_ORGANIZATION_PROJECT: isFeatureEnabled('FEATURE_ORGANIZATION_PROJECT'),
	FEATURE_ORGANIZATION_DEPARTMENT: isFeatureEnabled('FEATURE_ORGANIZATION_DEPARTMENT'),
	FEATURE_ORGANIZATION_TEAM: isFeatureEnabled('FEATURE_ORGANIZATION_TEAM'),
	FEATURE_ORGANIZATION_DOCUMENT: isFeatureEnabled('FEATURE_ORGANIZATION_DOCUMENT'),
	FEATURE_ORGANIZATION_EMPLOYMENT_TYPE: isFeatureEnabled('FEATURE_ORGANIZATION_EMPLOYMENT_TYPE'),
	FEATURE_ORGANIZATION_RECURRING_EXPENSE: isFeatureEnabled('FEATURE_ORGANIZATION_RECURRING_EXPENSE'),
	FEATURE_ORGANIZATION_HELP_CENTER: isFeatureEnabled('FEATURE_ORGANIZATION_HELP_CENTER'),
	FEATURE_CONTACT: isFeatureEnabled('FEATURE_CONTACT'),
	FEATURE_GOAL: isFeatureEnabled('FEATURE_GOAL'),
	FEATURE_GOAL_REPORT: isFeatureEnabled('FEATURE_GOAL_REPORT'),
	FEATURE_GOAL_SETTING: isFeatureEnabled('FEATURE_GOAL_SETTING'),
	FEATURE_REPORT: isFeatureEnabled('FEATURE_REPORT'),
	FEATURE_USER: isFeatureEnabled('FEATURE_USER'),
	FEATURE_ORGANIZATIONS: isFeatureEnabled('FEATURE_ORGANIZATIONS'),
	FEATURE_APP_INTEGRATION: isFeatureEnabled('FEATURE_APP_INTEGRATION'),
	FEATURE_SETTING: isFeatureEnabled('FEATURE_SETTING'),
	FEATURE_EMAIL_HISTORY: isFeatureEnabled('FEATURE_EMAIL_HISTORY'),
	FEATURE_EMAIL_TEMPLATE: isFeatureEnabled('FEATURE_EMAIL_TEMPLATE'),
	FEATURE_IMPORT_EXPORT: isFeatureEnabled('FEATURE_IMPORT_EXPORT'),
	FEATURE_FILE_STORAGE: isFeatureEnabled('FEATURE_FILE_STORAGE'),
	FEATURE_PAYMENT_GATEWAY: isFeatureEnabled('FEATURE_PAYMENT_GATEWAY'),
	FEATURE_SMS_GATEWAY: isFeatureEnabled('FEATURE_SMS_GATEWAY'),
	FEATURE_SMTP: isFeatureEnabled('FEATURE_SMTP'),
	FEATURE_ROLES_PERMISSION: isFeatureEnabled('FEATURE_ROLES_PERMISSION'),
	FEATURE_EMAIL_VERIFICATION: isFeatureEnabled('FEATURE_EMAIL_VERIFICATION'),
	FEATURE_OPEN_STATS: process.env.FEATURE_OPEN_STATS === 'true' // enable/disable global open stats endpoint configuration
};
