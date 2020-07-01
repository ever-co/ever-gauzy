// Modified code from https://github.com/xmlking/ngx-starter-kit.
// MIT License, see https://github.com/xmlking/ngx-starter-kit/blob/develop/LICENSE
// Copyright (c) 2018 Sumanth Chinthagunta

import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import {
	IDefaultUser,
	IDefaultOrganization,
	IDefaultCandidate,
	IDefaultEmployee,
	IDefaultProductCategory,
	IDefaultProductType
} from '@gauzy/models';
import { IFacebookConfig } from './IFacebookConfig';
import { IGoogleConfig } from './IGoogleConfig';
import { IUpworkConfig } from './IUpworkConfig';
import { IGithubConfig } from './IGithubConfig';
import { IMicrosoftConfig } from './IMicrosoftConfig';
import { ILinkedinConfig } from './ILinkedinIConfig';

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
	githunConfig: IGithubConfig;
	microsoftConfig: IMicrosoftConfig;
	linkedinConfig: ILinkedinConfig;

	defaultAdmins: IDefaultUser[];
	defaultSuperAdmins: IDefaultUser[];

	defaultEmployees?: IDefaultEmployee[];
	defaultCandidates?: IDefaultCandidate[];

	defaultOrganizations?: IDefaultOrganization[];

	defaultProductCategories?: IDefaultProductCategory[];

	defaultProductTypes?: IDefaultProductType[];

	defaultTeams?: {
		name: string;
		defaultMembers: string[];
	}[];

	randomSeedConfig?: {
		tenants: number; //The number of random tenants to be seeded.
		organizationsPerTenant: number; //No of random organizations seeded will be (organizationsPerTenant * tenants)
		employeesPerOrganization: number; //No of random employees seeded will be (employeesPerOrganization * organizationsPerTenant * tenants)
		candidatesPerOrganization: number; //No of random employees seeded will be (candidatesPerOrganization * organizationsPerTenant * tenants)
	};

	sentry?: {
		dns: string;
	};

	defaultHubstaffUserPass?: string;
	upworkConfig?: IUpworkConfig;
}
