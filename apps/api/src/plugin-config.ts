import { IPluginConfig, API_PORT, GRAPHQL_API_PATH } from '@gauzy/common';
import { ConnectionOptions } from 'typeorm';
import * as path from 'path';

export const pluginConfig: IPluginConfig = {
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
		synchronize: true,
		...getDbConfig()
	},
	assetOptions: {
		assetPath: path.join(
			path.resolve(
				__dirname,
				'../../../',
				...['apps', 'api', 'src', 'assets']
			)
		),
		assetPublicPath: path.join(
			path.resolve(__dirname, '../../../', ...['apps', 'api', 'public'])
		)
	},
	plugins: []
};

function getDbConfig(): ConnectionOptions {
	const dbType = process.env.DB_TYPE || 'postgres';
	switch (dbType) {
		case 'postgres':
			return {
				type: dbType,
				host: process.env.DB_HOST || 'localhost',
				port: process.env.DB_PORT
					? parseInt(process.env.DB_PORT, 10)
					: 5432,
				database: process.env.DB_NAME || 'postgres',
				username: process.env.DB_USER || 'postgres',
				password: process.env.DB_PASS || 'root',
				logging: true,
				logger: 'file', //Removes console logging, instead logs all queries in a file ormlogs.log
				synchronize: true,
				uuidExtension: 'pgcrypto'
			};
		case 'sqlite':
			return {
				type: dbType,
				database:
					process.env.DB_PATH ||
					path.join(__dirname, 'data/gauzy.sqlite3'),
				logging: true,
				logger: 'file', //Removes console logging, instead logs all queries in a file ormlogs.log
				synchronize: true
			};
	}
}
