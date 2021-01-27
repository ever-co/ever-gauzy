import { API_PORT, GRAPHQL_API_PATH } from '@gauzy/common';
import { bootstrap } from './bootstrap';

bootstrap({
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
		type: 'postgres',
		port: 5432,
		synchronize: true,
		logging: true,
		database: 'plugin-dev',
		username: 'postgres',
		password: 'root'
	},
	plugins: []
});
