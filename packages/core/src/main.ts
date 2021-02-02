import {
	DEFAULT_API_HOST,
	DEFAULT_API_PORT,
	DEFAULT_BASE_URL,
	DEFAULT_GRAPHQL_API_PATH
} from '@gauzy/common';
import { dbConnectionConfig } from '@gauzy/config';
import { bootstrap } from './bootstrap';

bootstrap({
	apiConfigOptions: {
		host: process.env.HOST || DEFAULT_API_HOST,
		port: process.env.PORT || DEFAULT_API_PORT,
		baseUrl: process.env.BASE_URL || DEFAULT_BASE_URL,
		middleware: [],
		graphqlConfigOptions: {
			path: DEFAULT_GRAPHQL_API_PATH,
			playground: true,
			debug: true,
			apolloServerPlugins: []
		}
	},
	dbConnectionOptions: {
		synchronize: true,
		...dbConnectionConfig
	},
	plugins: []
}).catch((error) => {
	console.log(error);
	process.exit(1);
});
