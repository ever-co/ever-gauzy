import { DynamicModule, Type } from '@nestjs/common';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { MikroOrmModuleOptions } from '@mikro-orm/nestjs';
import { PluginDefinition } from 'apollo-server-core';
import { ILogger } from './ILogger';

/**
 * Configuration options for GraphQL.
 */
export interface IGraphqlOptions {
	/**
	 * The path where GraphQL will be accessible.
	 */
	path: string;

	/**
	 * A boolean indicating whether the GraphQL Playground should be enabled.
	 */
	playground: boolean;

	/**
	 * A boolean indicating whether debugging should be enabled.
	 */
	debug: boolean;

	/**
	 * An array of Apollo Server plugins.
	 */
	apolloServerPlugins?: PluginDefinition[];
}

/**
 * Configuration options for assets.
 */
export interface IAssetOptions {
	/**
	 * The path where assets are stored.
	 */
	assetPath: string;

	/**
	 * The public path for accessing assets.
	 */
	assetPublicPath: string;
}


/**
 * Configuration options for the API server.
 */
export interface IApiServerOptions {
	/**
	 * The host address for the API server.
	 */
	host?: string;

	/**
	 * The port on which the API server will listen.
	 */
	port: number | string;

	/**
	 * The base URL for the API server.
	 */
	baseUrl?: string;

	/**
	 * Middleware configuration for the API server.
	 */
	middleware?: any;

	/**
	 * GraphQL configuration options for the API server.
	 */
	graphqlConfigOptions: IGraphqlOptions;
}


/**
 * Authentication options.
 */
export interface IAuthOptions {
	/**
	 * Secret used for Express session.
	 */
	expressSessionSecret: string;

	/**
	 * Number of rounds for bcrypt hashing of user passwords.
	 */
	userPasswordBcryptSaltRounds: number;

	/**
	 * Secret used for JWT (JSON Web Token) generation.
	 */
	jwtSecret: string;
}

export type IDBConnectionOptions = TypeOrmModuleOptions | MikroOrmModuleOptions;

export interface IPluginConfig {
	/**
	 * Configuration options for the API server.
	 */
	apiConfigOptions: IApiServerOptions;

	/**
	 * Database connection options.
	 */
	dbConnectionOptions: TypeOrmModuleOptions;
	dbMikroOrmConnectionOptions: MikroOrmModuleOptions;

	plugins?: Array<DynamicModule | Type<any>>;

	/**
	 * Logger configuration.
	 */
	logger?: ILogger;

	/**
	 * Authentication options.
	 */
	authOptions?: IAuthOptions;

	/**
	 * Asset options.
	 */
	assetOptions?: IAssetOptions;
}

/**
 * Represents a function that takes a plugin configuration and returns an updated configuration.
 */
export type PluginConfigurationFn = (config: IPluginConfig) => IPluginConfig;
