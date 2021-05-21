// Modified code from https://github.com/xmlking/ngx-starter-kit.
// MIT License, see https://github.com/xmlking/ngx-starter-kit/blob/develop/LICENSE
// Copyright (c) 2018 Sumanth Chinthagunta

import { FileStorageProviderEnum } from '@gauzy/contracts';
import {
	IAuth0Config,
	IAWSConfig,
	IFacebookConfig,
	IFiverrConfig,
	IGithubConfig,
	IGoogleConfig,
	IKeycloakConfig,
	ILinkedinConfig,
	IMicrosoftConfig,
	ISMTPConfig,
	ITwitterConfig,
	IUnleashConfig,
	IUpworkConfig
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

	fileSystem: FileSystem;
	awsConfig?: IAWSConfig;

	facebookConfig: IFacebookConfig;
	googleConfig: IGoogleConfig;
	githubConfig: IGithubConfig;
	microsoftConfig: IMicrosoftConfig;
	linkedinConfig: ILinkedinConfig;
	twitterConfig: ITwitterConfig;
	fiverrConfig: IFiverrConfig;
	keycloakConfig: IKeycloakConfig;
	auth0Config: IAuth0Config;

	sentry?: {
		dns: string;
	};

	defaultHubstaffUserPass?: string;
	upworkConfig?: IUpworkConfig;
	isElectron?: boolean;
	gauzyUserPath?: string;
	allowSuperAdminRole?: boolean;

	/**
	 * Endpoint for Gauzy AI API (optional), e.g.: http://localhost:3005/graphql
	 */
	gauzyAIGraphQLEndpoint?: string;

	smtpConfig?: ISMTPConfig;
	defaultCurrency: string;

	unleashConfig?: IUnleashConfig;
	
	demo: boolean;
}
