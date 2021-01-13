import { PluginConfig, API_PORT, GRAPHQL_API_PATH } from '@gauzy/common';
import { ReviewsPlugin } from '@gauzy/plugins';

export const devConfig: PluginConfig = {
	apiConfig: {
		port: API_PORT,
		middleware: [],
		graphqlConfig: {
			path: GRAPHQL_API_PATH,
			playground: true,
			debug: true,
			apolloServerPlugins: []
		}
	},
	dbConnectionConfig: {
		type: 'mysql',
		port: 3306,
		synchronize: true,
		logging: true,
		database: 'plugin-dev',
		username: 'root',
		password: 'root'
	},
	plugins: [ReviewsPlugin]
};
