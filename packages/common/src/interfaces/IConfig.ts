import { DynamicModule, Type } from '@nestjs/common';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { MikroOrmModuleOptions } from '@mikro-orm/nestjs';
import { PluginDefinition } from 'apollo-server-core';
import { ILogger } from './ILogger';

export interface IGraphqlOptions {
	path: string;

	playground: boolean;

	debug: boolean;

	apolloServerPlugins?: PluginDefinition[];
}

export interface IAssetOptions {
	assetPath: string;

	assetPublicPath: string;
}
export interface IApiServerOptions {
	host?: string;

	port: number | string;

	baseUrl?: string;

	middleware?: any;

	graphqlConfigOptions: IGraphqlOptions;
}

export interface IAuthOptions {
	expressSessionSecret: string;

	userPasswordBcryptSaltRounds: number;

	jwtSecret: string;
}

export type IDbConnectionOptions = TypeOrmModuleOptions | MikroOrmModuleOptions

export interface IPluginConfig {
	apiConfigOptions: IApiServerOptions;

	dbConnectionOptions: IDbConnectionOptions;

	plugins?: Array<DynamicModule | Type<any>>;

	logger?: ILogger;

	authOptions?: IAuthOptions;

	assetOptions?: IAssetOptions;
}
