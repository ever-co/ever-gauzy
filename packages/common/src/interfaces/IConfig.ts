import { DynamicModule, Type } from '@nestjs/common';
import { ConnectionOptions } from 'typeorm';
import { PluginDefinition } from 'apollo-server-core';
import { ILogger } from './ILogger';

export interface IGraphqlOptions {
	path: string;

	playground: boolean;

	debug: boolean;

	apolloServerPlugins?: PluginDefinition[];
}

export interface IApiServerOptions {
	hostname?: string;

	port: number;

	baseUrl?: string;

	middleware?: any;

	graphqlConfigOptions: IGraphqlOptions;
}

export interface IAuthOptions {
	expressSessionSecret: string;

	userPasswordBcryptSaltRounds: number;

	jwtSecret: string;
}

export interface IPluginConfig {
	apiConfigOptions: IApiServerOptions;

	dbConnectionOptions: ConnectionOptions;

	plugins?: Array<DynamicModule | Type<any>>;

	logger?: ILogger;

	authOptions?: IAuthOptions;
}
