// Modified code from https://github.com/xmlking/ngx-starter-kit.
// MIT License, see https://github.com/xmlking/ngx-starter-kit/blob/develop/LICENSE
// Copyright (c) 2018 Sumanth Chinthagunta

import { FileStorageProviderEnum } from '@gauzy/contracts';
import {
	IAppIntegrationConfig,
	IAuth0Config,
	IAwsConfig,
	ICloudinaryConfig,
	IFiverrConfig,
	IGithubIntegrationConfig,
	IHubstaffConfig,
	IJitsuConfig,
	IKeycloakConfig,
	ISMTPConfig,
	IUnleashConfig,
	IUpworkConfig,
	IWasabiConfig,
	IJiraIntegrationConfig,
	IDigitalOceanConfig
} from '@gauzy/common';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * environment variables that goes into process.env
 */
export interface Env {
	LOG_LEVEL?: LogLevel;
	[key: string]: string;
}

export interface FileSystem {
	name: FileStorageProviderEnum;
}

export interface IGauzyFeatures {
	[key: string]: boolean;
}

export interface IDemoCredential {
	readonly superAdminEmail?: string;
	readonly superAdminPassword?: string;
	readonly adminEmail?: string;
	readonly adminPassword?: string;
	readonly employeeEmail?: string;
	readonly employeePassword?: string;
}

/**
 * Server Environment
 */
export interface IEnvironment {
	port: number | string;
	host: string;
	baseUrl: string;
	clientBaseUrl: string;

	production: boolean;
	envName: string;

	env?: Env;

	EXPRESS_SESSION_SECRET: string;
	USER_PASSWORD_BCRYPT_SALT_ROUNDS?: number;

	JWT_SECRET?: string;
	JWT_TOKEN_EXPIRATION_TIME?: number;

	/**
	 * JWT refresh token Options
	 */
	JWT_REFRESH_TOKEN_SECRET?: string;
	JWT_REFRESH_TOKEN_EXPIRATION_TIME?: number;

	/**
	 * Email verification options
	 */
	JWT_VERIFICATION_TOKEN_SECRET?: string;
	JWT_VERIFICATION_TOKEN_EXPIRATION_TIME?: number;

	/**
	 * Password Less Authentication Configuration
	 */
	MAGIC_CODE_EXPIRATION_TIME?: number;

	/** Organization Team Join Request Configuration */
	TEAM_JOIN_REQUEST_EXPIRATION_TIME?: number;

	/**
	 * Throttler (Rate Limiting) Options
	 */
	THROTTLE_ENABLED?: boolean;
	THROTTLE_TTL?: number;
	THROTTLE_LIMIT?: number;

	fileSystem: FileSystem;
	awsConfig?: IAwsConfig;
	wasabi?: IWasabiConfig;
	cloudinary?: ICloudinaryConfig;
	digitalOcean?: IDigitalOceanConfig;
	github: IGithubIntegrationConfig /** Github Configuration */;
	jira: IJiraIntegrationConfig /** Jira Configuration */;
	fiverrConfig: IFiverrConfig;
	keycloakConfig: IKeycloakConfig;
	auth0Config: IAuth0Config;

	sentry?: {
		dsn: string;
	};

	/**
	 * Default Integrated User Password
	 */
	defaultIntegratedUserPass?: string;

	/** Third Party Integrations */
	upwork?: IUpworkConfig;
	hubstaff?: IHubstaffConfig;

	isElectron?: boolean;
	gauzyUserPath?: string;
	allowSuperAdminRole?: boolean;
	gauzySeedPath?: string;

	/**
	 * Endpoint for Gauzy AI API (optional), e.g.: http://localhost:3005/graphql
	 */
	gauzyAIGraphQLEndpoint?: string;

	/**
	 * Endpoint for Gauzy AI REST API (optional), e.g.: http://localhost:3005/api
	 */
	gauzyAIRESTEndpoint?: string;

	gauzyCloudEndpoint?: string;

	smtpConfig?: ISMTPConfig;
	defaultCurrency: string;

	unleashConfig?: IUnleashConfig;

	/**
	 * Email Template Config
	 */
	appIntegrationConfig?: IAppIntegrationConfig;

	demo: boolean;
	demoCredentialConfig?: IDemoCredential;

	/**
	 * Email Reset
	 */
	EMAIL_RESET_EXPIRATION_TIME?: number;

	/**
	 * Jitsu Configuration
	 */
	jitsu: IJitsuConfig;

	/**
	 * Periodic Time Save
	 */
	periodicTimeSave: boolean;
	periodicTimeSaveTimeframe: number;
}
