import {
	IPluginConfig,
	DEFAULT_API_PORT,
	DEFAULT_GRAPHQL_API_PATH,
	DEFAULT_API_HOST,
	DEFAULT_API_BASE_URL
} from '@gauzy/common';
import { ConnectionOptions } from 'typeorm';
import * as path from 'path';
import { KnowledgeBasePlugin } from '@gauzy/knowledge-base';
import { ChangelogPlugin } from '@gauzy/changelog';

let assetPath;
let assetPublicPath;

// for Docker
if (__dirname.startsWith('/srv/gauzy/')) {
	assetPath = '/srv/gauzy/apps/api/src/assets';
	assetPublicPath = '/srv/gauzy/apps/api/public';
} else {
	assetPath = path.join(
		path.resolve(
			__dirname,
			'../../../',
			...['apps', 'api', 'src', 'assets']
		)
	);

	assetPublicPath = path.join(
		path.resolve(__dirname, '../../../', ...['apps', 'api', 'public'])
	);
}

export const pluginConfig: IPluginConfig = {
	apiConfigOptions: {
		host: process.env.HOST || DEFAULT_API_HOST,
		port: process.env.PORT || DEFAULT_API_PORT,
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
		synchronize: true,
		...getDbConfig()
	},
	assetOptions: {
		assetPath: assetPath,
		assetPublicPath: assetPublicPath
	},
	plugins: [KnowledgeBasePlugin, ChangelogPlugin]
};

function getDbConfig(): ConnectionOptions {
	const dbType =
		process.env.DB_TYPE && process.env.DB_TYPE === 'postgres'
			? 'postgres'
			: 'sqlite';

	switch (dbType) {
		case 'postgres':
			const ssl = process.env.DB_SSL_MODE == 'true' ? true : undefined;

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
				ssl: ssl,
				// Removes console logging, instead logs all queries in a file ormlogs.log
				logger: 'file',
				synchronize: true,
				uuidExtension: 'pgcrypto'
			};
		case 'sqlite':
			return {
				type: dbType,
				database:
					process.env.DB_PATH ||
					path.join(
						path.resolve('.', ...['apps', 'api', 'data']),
						'gauzy.sqlite3'
					),
				logging: true,
				// Removes console logging, instead logs all queries in a file ormlogs.log
				logger: 'file',
				synchronize: true
			};
	}
}
