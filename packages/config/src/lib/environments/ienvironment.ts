// Modified code from https://github.com/xmlking/ngx-starter-kit.
// MIT License, see https://github.com/xmlking/ngx-starter-kit/blob/develop/LICENSE
// Copyright (c) 2018 Sumanth Chinthagunta

import {
	IActivepiecesConfig,
	IAppIntegrationConfig,
	IAuth0Config,
	IAwsConfig,
	ICloudinaryConfig,
	IFiverrConfig,
	IGithubIntegrationConfig,
	IHubstaffConfig,
	IJitsuConfig,
	ISMTPConfig,
	ISimConfig,
	IUnleashConfig,
	IUpworkConfig,
	IWasabiConfig,
	IJiraIntegrationConfig,
	IDigitalOceanConfig,
	IMakeComConfig,
	IPosthogConfig,
	IZapierConfig
} from '@gauzy/common';
import { FileStorageProviderEnum } from '@gauzy/contracts';
import { ISocialAuthClientsConfig } from './social-auth.helper';

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

	/**
	 * Whether the deployment sits behind Cloudflare, so the `CF-Connecting-IP` request header may be
	 * used as the rate-limit bucket key. OFF unless explicitly enabled: the header is client-writable
	 * on any deployment Cloudflare does not front, and trusting it lets an attacker mint a fresh
	 * throttle bucket per request (GHSA-86mw-2crg-vmhc).
	 */
	THROTTLE_TRUST_CF_CONNECTING_IP?: boolean;

	/**
	 * Identifier-scoped brute-force control. Counts consecutive authentication failures per account
	 * identifier (not per IP), so rotating source addresses does not reset the counter.
	 */
	AUTH_MAX_FAILED_ATTEMPTS?: number;
	AUTH_LOCKOUT_SECONDS?: number;

	fileSystem: FileSystem;
	awsConfig?: IAwsConfig;
	wasabi?: IWasabiConfig;
	cloudinary?: ICloudinaryConfig;
	digitalOcean?: IDigitalOceanConfig;
	github: IGithubIntegrationConfig /** Github Configuration */;
	/** OAuth clients accepted by the email-based social sign-in routes (GHSA-58x4-7mw9-gmqg). */
	socialAuth?: ISocialAuthClientsConfig;
	jira: IJiraIntegrationConfig /** Jira Configuration */;
	fiverrConfig: IFiverrConfig;
	auth0Config: IAuth0Config;

	sentry?: {
		dsn: string;
	};

	posthog?: IPosthogConfig;

	/**
	 * Default Integrated User Password
	 */
	defaultIntegratedUserPass?: string;

	/** Third Party Integrations */
	upwork?: IUpworkConfig;
	hubstaff?: IHubstaffConfig;
	zapier?: IZapierConfig;
	makeCom?: IMakeComConfig;
	/** ActivePieces Configuration */
	activepieces?: IActivepiecesConfig;
	/** SIM (Sim Studio) Configuration */
	sim?: ISimConfig;
	isElectron?: boolean;
	gauzyUserPath?: string;
	allowSuperAdminRole?: boolean;
	gauzySeedPath?: string;
	electronResourcesPath?: string;

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
}
