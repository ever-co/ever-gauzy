import { bootstrap } from './bootstrap';
export { bootstrap } from './bootstrap';

export * from './logger/index';

bootstrap({
	apiConfig: {
		port: 3001,
		middleware: [],
		graphqlConfig: {
			path: 'graphql',
			playground: true,
			debug: true,
			apolloServerPlugins: []
		}
	},
	dbConnectionConfig: {
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
