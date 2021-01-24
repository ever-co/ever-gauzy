import { bootstrap } from './bootstrap';
export { bootstrap } from './bootstrap';

export * from './logger/index';

bootstrap({
	apiConfigOptions: {
		port: 3001,
		middleware: [],
		graphqlConfigOptions: {
			path: 'graphql',
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
