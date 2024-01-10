import {
	DEFAULT_API_BASE_URL,
	DEFAULT_API_HOST,
	DEFAULT_API_PORT,
	DEFAULT_GRAPHQL_API_PATH,
	IPluginConfig,
	IDBConnectionOptions
} from '@gauzy/common';
import { dbConnectionConfig } from '@gauzy/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { getORMType } from 'core';

const typeORMDefaultConfig: any = {
	retryAttempts: 100,
	retryDelay: 3000,
	migrationsTransactionMode: 'each', // Run migrations automatically in each transaction. i.e."all" | "none" | "each"
	migrationsRun: process.env.DB_SYNCHRONIZE === 'true' ? false : true, // Run migrations automatically if we don't do DB_SYNCHRONIZE
};

// Define the dev configuration
export const devConfig: IPluginConfig = {
	apiConfigOptions: {
		host: process.env.API_HOST || DEFAULT_API_HOST,
		port: process.env.API_PORT || DEFAULT_API_PORT,
		baseUrl: process.env.API_BASE_URL || DEFAULT_API_BASE_URL,
		middleware: [],
		graphqlConfigOptions: {
			path: DEFAULT_GRAPHQL_API_PATH,
			playground: true,
			debug: true,
			apolloServerPlugins: []
		}
	},
	dbConnectionOptions: {
		...(getORMType() === 'typeorm' ? typeORMDefaultConfig : {}),
		...dbConnectionConfig
	},
	plugins: []
};
