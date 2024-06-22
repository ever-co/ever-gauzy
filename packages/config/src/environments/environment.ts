/** This file can be replaced during build by using the `fileReplacements` array.
 * `ng build ---prod` replaces `environment.ts` with `environment.prod.ts`.
 * The list of file replacements can be found in `angular.json`.
 */

// see https://github.com/motdotla/dotenv#how-do-i-use-dotenv-with-import
import * as dotenv from 'dotenv';
dotenv.config();

import { FileStorageProviderEnum } from '@gauzy/contracts';
import { IEnvironment, Ii4netFeatures } from './ienvironment';

if (process.env.IS_ELECTRON && process.env.GAUZY_USER_PATH) {
	require('app-root-path').setPath(process.env.GAUZY_USER_PATH);
}

export const environment: IEnvironment = {
	port: process.env.API_PORT || 3800,
	host: process.env.API_HOST || 'http://localhost',
	baseUrl: process.env.API_BASE_URL || 'http://localhost:3800',
	clientBaseUrl: process.env.CLIENT_BASE_URL || 'http://localhost:4200',
	production: false,
	envName: 'dev',

	env: {
		LOG_LEVEL: 'debug'
	},

	EXPRESS_SESSION_SECRET: process.env.EXPRESS_SESSION_SECRET || 'i4net',
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
		serviceUrl: process.env.DIGITALOCEAN_SERVICE_URL || 'https://gauzy.sfo2.digitaloceanspaces.com',  // Find your endpoint in the control panel, under Settings. Prepend "https://".
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
		clientId: process.env.I4NET_GITHUB_CLIENT_ID,
		clientSecret: process.env.I4NET_GITHUB_CLIENT_SECRET,
		appId: process.env.I4NET_GITHUB_APP_ID,
		appName: process.env.I4NET_GITHUB_APP_NAME,
		appPrivateKey: process.env.I4NET_GITHUB_APP_PRIVATE_KEY
			? Buffer.from(process.env.I4NET_GITHUB_APP_PRIVATE_KEY, 'base64').toString('ascii')
			: '',

		/** Github App Post Install Configuration */
		postInstallUrl:
			process.env.I4NET_GITHUB_POST_INSTALL_URL ||
			`${process.env.CLIENT_BASE_URL}/#/pages/integrations/github/setup/installation`,

		/** Github Webhook Configuration */
		webhookSecret: process.env.I4NET_GITHUB_WEBHOOK_SECRET,
		webhookUrl: process.env.I4NET_GITHUB_WEBHOOK_URL || `${process.env.API_BASE_URL}/api/integration/github/webhook`
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
	 * Endpoint for i4net AI API (optional), e.g.: http://localhost:3005/graphql
	 */
	gauzyAIGraphQLEndpoint: process.env.I4NET_AI_GRAPHQL_ENDPOINT,

	/**
	 * Endpoint for i4net AI REST API (optional), e.g.: http://localhost:3005/api
	 */
	gauzyAIRESTEndpoint: process.env.I4NET_AI_REST_ENDPOINT,

	gauzyCloudEndpoint: process.env.I4NET_CLOUD_ENDPOINT,

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
		appName: process.env.APP_NAME || 'i4net',
		appLogo: process.env.APP_LOGO || `${process.env.CLIENT_BASE_URL}/assets/images/logos/logo_i4net.png`,
		appSignature: process.env.APP_SIGNATURE || 'i4net Team',
		appLink: process.env.APP_LINK || 'http://localhost:4200/',
		appEmailConfirmationUrl:
			process.env.APP_EMAIL_CONFIRMATION_URL || `${process.env.CLIENT_BASE_URL}/#/auth/confirm-email`,
		appMagicSignUrl: process.env.APP_MAGIC_SIGN_URL || `${process.env.CLIENT_BASE_URL}/#/auth/magic-sign-in`,
		companyLink: process.env.COMPANY_LINK || 'https://i4net.co.il',
		companyName: process.env.COMPANY_NAME || 'i4net'
	},

	demo: process.env.DEMO === 'true' ? true : false,

	demoCredentialConfig: {
		superAdminEmail: process.env.DEMO_SUPER_ADMIN_EMAIL || `admin@i4net.co.il`,
		superAdminPassword: process.env.DEMO_SUPER_ADMIN_PASSWORD || `admin`,
		adminEmail: process.env.DEMO_ADMIN_EMAIL || `local.admin@i4net.co.il`,
		adminPassword: process.env.DEMO_ADMIN_PASSWORD || `admin`,
		employeeEmail: process.env.DEMO_EMPLOYEE_EMAIL || `employee@i4net.co.il`,
		employeePassword: process.env.DEMO_EMPLOYEE_PASSWORD || `123456`
	}
};

export const gauzyToggleFeatures: Ii4netFeatures = {
	FEATURE_DASHBOARD: process.env.FEATURE_DASHBOARD === 'false' ? false : true,
	FEATURE_TIME_TRACKING: process.env.FEATURE_TIME_TRACKING === 'false' ? false : true,
	FEATURE_ESTIMATE: process.env.FEATURE_ESTIMATE === 'false' ? false : true,
	FEATURE_ESTIMATE_RECEIVED: process.env.FEATURE_ESTIMATE_RECEIVED === 'false' ? false : true,
	FEATURE_INVOICE: process.env.FEATURE_INVOICE === 'false' ? false : true,
	FEATURE_INVOICE_RECURRING: process.env.FEATURE_INVOICE_RECURRING === 'false' ? false : true,
	FEATURE_INVOICE_RECEIVED: process.env.FEATURE_INVOICE_RECEIVED === 'false' ? false : true,
	FEATURE_INCOME: process.env.FEATURE_INCOME === 'false' ? false : true,
	FEATURE_EXPENSE: process.env.FEATURE_EXPENSE === 'false' ? false : true,
	FEATURE_PAYMENT: process.env.FEATURE_PAYMENT === 'false' ? false : true,
	FEATURE_PROPOSAL: process.env.FEATURE_PROPOSAL === 'false' ? false : true,
	FEATURE_PROPOSAL_TEMPLATE: process.env.FEATURE_PROPOSAL_TEMPLATE === 'false' ? false : true,
	FEATURE_PIPELINE: process.env.FEATURE_PIPELINE === 'false' ? false : true,
	FEATURE_PIPELINE_DEAL: process.env.FEATURE_PIPELINE_DEAL === 'false' ? false : true,
	FEATURE_DASHBOARD_TASK: process.env.FEATURE_DASHBOARD_TASK === 'false' ? false : true,
	FEATURE_TEAM_TASK: process.env.FEATURE_TEAM_TASK === 'false' ? false : true,
	FEATURE_MY_TASK: process.env.FEATURE_MY_TASK === 'false' ? false : true,
	FEATURE_JOB: process.env.FEATURE_JOB === 'false' ? false : true,
	FEATURE_EMPLOYEES: process.env.FEATURE_EMPLOYEES === 'false' ? false : true,
	FEATURE_EMPLOYEE_TIME_ACTIVITY: process.env.FEATURE_EMPLOYEE_TIME_ACTIVITY === 'false' ? false : true,
	FEATURE_EMPLOYEE_TIMESHEETS: process.env.FEATURE_EMPLOYEE_TIMESHEETS === 'false' ? false : true,
	FEATURE_EMPLOYEE_APPOINTMENT: process.env.FEATURE_EMPLOYEE_APPOINTMENT === 'false' ? false : true,
	FEATURE_EMPLOYEE_APPROVAL: process.env.FEATURE_EMPLOYEE_APPROVAL === 'false' ? false : true,
	FEATURE_EMPLOYEE_APPROVAL_POLICY: process.env.FEATURE_EMPLOYEE_APPROVAL_POLICY === 'false' ? false : true,
	FEATURE_EMPLOYEE_LEVEL: process.env.FEATURE_EMPLOYEE_LEVEL === 'false' ? false : true,
	FEATURE_EMPLOYEE_POSITION: process.env.FEATURE_EMPLOYEE_POSITION === 'false' ? false : true,
	FEATURE_EMPLOYEE_TIMEOFF: process.env.FEATURE_EMPLOYEE_TIMEOFF === 'false' ? false : true,
	FEATURE_EMPLOYEE_RECURRING_EXPENSE: process.env.FEATURE_EMPLOYEE_RECURRING_EXPENSE === 'false' ? false : true,
	FEATURE_EMPLOYEE_CANDIDATE: process.env.FEATURE_EMPLOYEE_CANDIDATE === 'false' ? false : true,
	FEATURE_MANAGE_INTERVIEW: process.env.FEATURE_MANAGE_INTERVIEW === 'false' ? false : true,
	FEATURE_MANAGE_INVITE: process.env.FEATURE_MANAGE_INVITE === 'false' ? false : true,
	FEATURE_ORGANIZATION: process.env.FEATURE_ORGANIZATION === 'false' ? false : true,
	FEATURE_ORGANIZATION_EQUIPMENT: process.env.FEATURE_ORGANIZATION_EQUIPMENT === 'false' ? false : true,
	FEATURE_ORGANIZATION_INVENTORY: process.env.FEATURE_ORGANIZATION_INVENTORY === 'false' ? false : true,
	FEATURE_ORGANIZATION_TAG: process.env.FEATURE_ORGANIZATION_TAG === 'false' ? false : true,
	FEATURE_ORGANIZATION_VENDOR: process.env.FEATURE_ORGANIZATION_VENDOR === 'false' ? false : true,
	FEATURE_ORGANIZATION_PROJECT: process.env.FEATURE_ORGANIZATION_PROJECT === 'false' ? false : true,
	FEATURE_ORGANIZATION_DEPARTMENT: process.env.FEATURE_ORGANIZATION_DEPARTMENT === 'false' ? false : true,
	FEATURE_ORGANIZATION_TEAM: process.env.FEATURE_ORGANIZATION_TEAM === 'false' ? false : true,
	FEATURE_ORGANIZATION_DOCUMENT: process.env.FEATURE_ORGANIZATION_DOCUMENT === 'false' ? false : true,
	FEATURE_ORGANIZATION_EMPLOYMENT_TYPE: process.env.FEATURE_ORGANIZATION_EMPLOYMENT_TYPE === 'false' ? false : true,
	FEATURE_ORGANIZATION_RECURRING_EXPENSE:
		process.env.FEATURE_ORGANIZATION_RECURRING_EXPENSE === 'false' ? false : true,
	FEATURE_ORGANIZATION_HELP_CENTER: process.env.FEATURE_ORGANIZATION_HELP_CENTER === 'false' ? false : true,
	FEATURE_CONTACT: process.env.FEATURE_CONTACT === 'false' ? false : true,
	FEATURE_GOAL: process.env.FEATURE_GOAL === 'false' ? false : true,
	FEATURE_GOAL_REPORT: process.env.FEATURE_GOAL_REPORT === 'false' ? false : true,
	FEATURE_GOAL_SETTING: process.env.FEATURE_GOAL_SETTING === 'false' ? false : true,
	FEATURE_REPORT: process.env.FEATURE_REPORT === 'false' ? false : true,
	FEATURE_USER: process.env.FEATURE_USER === 'false' ? false : true,
	FEATURE_ORGANIZATIONS: process.env.FEATURE_ORGANIZATIONS === 'false' ? false : true,
	FEATURE_APP_INTEGRATION: process.env.FEATURE_APP_INTEGRATION === 'false' ? false : true,
	FEATURE_SETTING: process.env.FEATURE_SETTING === 'false' ? false : true,
	FEATURE_EMAIL_HISTORY: process.env.FEATURE_EMAIL_HISTORY === 'false' ? false : true,
	FEATURE_EMAIL_TEMPLATE: process.env.FEATURE_EMAIL_TEMPLATE === 'false' ? false : true,
	FEATURE_IMPORT_EXPORT: process.env.FEATURE_IMPORT_EXPORT === 'false' ? false : true,
	FEATURE_FILE_STORAGE: process.env.FEATURE_FILE_STORAGE === 'false' ? false : true,
	FEATURE_PAYMENT_GATEWAY: process.env.FEATURE_PAYMENT_GATEWAY === 'false' ? false : true,
	FEATURE_SMS_GATEWAY: process.env.FEATURE_SMS_GATEWAY === 'false' ? false : true,
	FEATURE_SMTP: process.env.FEATURE_SMTP === 'false' ? false : true,
	FEATURE_ROLES_PERMISSION: process.env.FEATURE_ROLES_PERMISSION === 'false' ? false : true,
	FEATURE_EMAIL_VERIFICATION: process.env.FEATURE_EMAIL_VERIFICATION === 'false' ? false : true
};
