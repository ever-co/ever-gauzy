import { IPluginConfig, API_PORT, GRAPHQL_API_PATH } from '@gauzy/common';

export const devConfig: IPluginConfig = {
	apiConfigOptions: {
		port: API_PORT,
		middleware: [],
		graphqlConfigOptions: {
			path: GRAPHQL_API_PATH,
			playground: true,
			debug: true,
			apolloServerPlugins: []
		}
	},
	dbConnectionOptions: {
		type: 'mysql',
		port: 3306,
		synchronize: true,
		logging: true,
		database: 'plugin-dev',
		username: 'root',
		password: 'root'
	},
	plugins: []
};
