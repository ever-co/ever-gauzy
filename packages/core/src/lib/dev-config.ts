import { ApplicationPluginConfig } from '@gauzy/common';
import { DEFAULT_API_BASE_URL, DEFAULT_API_HOST, DEFAULT_API_PORT, DEFAULT_GRAPHQL_API_PATH } from '@gauzy/constants';
import { dbTypeOrmConnectionConfig, dbMikroOrmConnectionConfig, dbKnexConnectionConfig } from '@gauzy/config';

/**
 * Application plugin configuration for development environment.
 */
export const devConfig: ApplicationPluginConfig = {
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
		retryAttempts: 100,
		retryDelay: 3000,
		migrationsTransactionMode: 'each', // Run migrations automatically in each transaction. i.e."all" | "none" | "each"
		migrationsRun: process.env.DB_SYNCHRONIZE === 'true' ? false : true, // Run migrations automatically if we don't do DB_SYNCHRONIZE
		...dbTypeOrmConnectionConfig
	},
	dbMikroOrmConnectionOptions: {
		...dbMikroOrmConnectionConfig
	},
	dbKnexConnectionOptions: {
		retryAttempts: 100,
		retryDelay: 3000,
		...dbKnexConnectionConfig
	},
	plugins: []
};
