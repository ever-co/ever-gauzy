import { DynamicModule, Type } from '@nestjs/common';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { MikroOrmModuleOptions } from '@mikro-orm/nestjs';
import { KnexModuleOptions } from 'nest-knexjs';
import { PluginDefinition } from 'apollo-server-core';
import { AbstractLogger } from './IAbstractLogger';
import { CustomFields } from '../custom-field-types';

/**
 * Configuration options for GraphQL.
 */
export interface GraphqlConfigurationOptions {
	/**
	 * The path where GraphQL will be accessible.
	 * @description Specifies the endpoint path for accessing GraphQL.
	 */
	path: string;

	/**
	 * A boolean indicating whether the GraphQL Playground should be enabled.
	 * @description Determines whether the GraphQL Playground is enabled.
	 */
	playground: boolean;

	/**
	 * A boolean indicating whether debugging should be enabled.
	 * @description Determines whether debugging features are enabled.
	 */
	debug: boolean;

	/**
	 * An array of Apollo Server plugins.
	 * @description Defines an array of plugins for Apollo Server.
	 */
	apolloServerPlugins?: PluginDefinition[];
}

/**
 * Configuration options for handling assets in the application.
 */
export interface AssetConfigurationOptions {
	/**
	 * The path where assets are stored.
	 * @description Specifies the directory path where assets are stored.
	 */
	assetPath: string;

	/**
	 * The public path for accessing assets.
	 * @description Defines the public URL path for accessing assets.
	 */
	assetPublicPath: string;
}

/**
 * Configuration options for the API server.
 */
export interface ApiServerConfigurationOptions {
	/**
	 * The host address for the API server.
	 * @description Specifies the host address for the API server.
	 */
	host?: string;

	/**
	 * The port on which the API server will listen.
	 * @description Specifies the port on which the API server will listen.
	 */
	port: number | string;

	/**
	 * The base URL for the API server.
	 * @description Defines the base URL for the API server.
	 */
	baseUrl?: string;

	/**
	 * Middleware configuration for the API server.
	 * @description Defines middleware configurations for the API server.
	 */
	middleware?: any;

	/**
	 * GraphQL configuration options for the API server.
	 * @description Specifies the GraphQL configuration options for the API server.
	 */
	graphqlConfigOptions: GraphqlConfigurationOptions;
}

/**
 * Configuration options for authentication in the application.
 */
export interface AuthConfigurationOptions {
	/**
	 * Secret used for Express session.
	 * @description Specifies the secret used for Express session.
	 */
	expressSessionSecret: string;

	/**
	 * Number of rounds for bcrypt hashing of user passwords.
	 * @description Defines the number of rounds for bcrypt hashing of user passwords.
	 */
	userPasswordBcryptSaltRounds: number;

	/**
	 * Secret used for JWT (JSON Web Token) generation.
	 * @description Specifies the secret used for JWT generation.
	 */
	jwtSecret: string;
}

export type IDBConnectionOptions = TypeOrmModuleOptions | MikroOrmModuleOptions;

/**
 * Configuration options for plugins in the application.
 */
export interface ApplicationPluginConfig {
	/**
	 * Configuration options for the API server.
	 * @description Defines options for configuring the API server.
	 */
	apiConfigOptions: ApiServerConfigurationOptions;

	/**
	 * Database connection options for TypeORM.
	 * @description Specifies options for connecting to the database using TypeORM.
	 */
	dbConnectionOptions: TypeOrmModuleOptions;

	/**
	 * Database connection options for MikroORM.
	 * @description Specifies options for connecting to the database using MikroORM.
	 */
	dbMikroOrmConnectionOptions: MikroOrmModuleOptions;

	/**
	 * Database connection options for Knex.
	 */
	dbKnexConnectionOptions: KnexModuleOptions;

	/**
	 * Array of plugins to be dynamically added to the application.
	 * @description Defines a list of dynamic modules or classes representing plugins.
	 */
	plugins?: Array<DynamicModule | Type<any>>;

	/**
	 * Logger configuration.
	 * @description Defines options for configuring the application logger.
	 */
	logger?: AbstractLogger;

	/**
	 * Custom fields configuration.
	 * Defines custom fields for different entities in the application.
	 */
	customFields?: CustomFields;

	/**
	 * Authentication options.
	 * @description Defines options for configuring authentication in the application.
	 */
	authOptions?: AuthConfigurationOptions;

	/**
	 * Asset options.
	 * @description Defines options for handling assets in the application.
	 */
	assetOptions?: AssetConfigurationOptions;
}

/**
 * Represents a function that configures the application plugin.
 * @description This function takes an ApplicationPluginConfig as input and returns a modified ApplicationPluginConfig.
 */
export type ApplicationPluginConfigurationFn = (config: ApplicationPluginConfig) => ApplicationPluginConfig;
