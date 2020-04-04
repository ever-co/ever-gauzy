// Modified code from https://github.com/xmlking/ngx-starter-kit.
// MIT License, see https://github.com/xmlking/ngx-starter-kit/blob/develop/LICENSE
// Copyright (c) 2018 Sumanth Chinthagunta

import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import {
	DefaultUser,
	CurrenciesEnum,
	DefaultValueDateTypeEnum
} from '@gauzy/models';
import { IFacebookConfig } from './IFacebookConfig';
import { IGoogleConfig } from './IGoogleConfig';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * environment variables that goes into process.env
 */
export interface Env {
	LOG_LEVEL?: LogLevel;
	[key: string]: string;
}

/**
 * Server Environment
 */
export interface IEnvironment {
	port: number | string;
	host: string;

	production: boolean;
	envName: string;

	env?: Env;

	USER_PASSWORD_BCRYPT_SALT_ROUNDS?: number;
	JWT_SECRET?: string;

	database: TypeOrmModuleOptions;

	facebookConfig: IFacebookConfig;
	googleConfig: IGoogleConfig;

	defaultAdmins: DefaultUser[];
	defaultSuperAdmins: DefaultUser[];

	defaultEmployees?: DefaultUser[];
	defaultCandidates?: DefaultUser[];

	defaultOrganization?: {
		name: string;
		currency: CurrenciesEnum;
		defaultValueDateType: DefaultValueDateTypeEnum;
		imageUrl: string;
	};

	defaultTeams?: {
		name: string;
		defaultMembers: string[];
	}[];
	sentry?: {
		dns: string;
	};
}
