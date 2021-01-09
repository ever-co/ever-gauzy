import { DynamicModule, Type } from '@nestjs/common';
import { ConnectionOptions } from 'typeorm';
import { PluginDefinition } from 'apollo-server-core';
import { Logger } from './logger';

export interface GraphqlOptions {
	path: string;

	playground: boolean;

	debug: boolean;

	apolloServerPlugins?: PluginDefinition[];
}

export interface ApiServerOptions {
	hostname?: string;

	port: number;

	middleware?: any;

	graphqlConfig: GraphqlOptions;
}

export interface PluginConfig {
	apiConfig: ApiServerOptions;

	dbConnectionConfig: ConnectionOptions;

	plugins?: Array<DynamicModule | Type<any>>;

	logger?: Logger;
}
