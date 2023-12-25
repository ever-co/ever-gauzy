import {
	DEFAULT_API_BASE_URL,
	DEFAULT_API_HOST,
	DEFAULT_API_PORT,
	DEFAULT_GRAPHQL_API_PATH,
	IPluginConfig
} from '@gauzy/common';
import { dbConnectionConfig } from '@gauzy/config';

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
		migrationsTransactionMode: 'each', // Run migrations automatically in each transaction. i.e."all" | "none" | "each"
		migrationsRun: process.env.DB_SYNCHRONIZE === 'true' ? false : true, // Run migrations automatically if we don't do DB_SYNCHRONIZE
		...dbConnectionConfig
	},
	plugins: []
};
