import {
    DEFAULT_API_BASE_URL,
    DEFAULT_API_HOST,
    DEFAULT_API_PORT,
    DEFAULT_GRAPHQL_API_PATH,
    IPluginConfig
} from "@gauzy/common";
import { dbConnectionConfig, environment } from "@gauzy/config";

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
		migrationsRun: !environment.production, // Run migrations automatically, you can disable this if you prefer running migration manually.
		...dbConnectionConfig
	},
	plugins: []
};