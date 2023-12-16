import { TlsOptions } from 'tls';
import {
	IPluginConfig,
	DEFAULT_API_PORT,
	DEFAULT_GRAPHQL_API_PATH,
	DEFAULT_API_HOST,
	DEFAULT_API_BASE_URL
} from '@gauzy/common';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { DataSourceOptions } from 'typeorm';
import * as path from 'path';
import { KnowledgeBasePlugin } from '@gauzy/knowledge-base';
import { ChangelogPlugin } from '@gauzy/changelog';

let assetPath;
let assetPublicPath;

console.log('Plugin Config -> __dirname: ' + __dirname);
console.log('Plugin Config -> process.cwd: ' + process.cwd());

// TODO: maybe better to use process.cwd() instead of __dirname?

// for Docker
if (__dirname.startsWith('/srv/gauzy')) {
	assetPath = '/srv/gauzy/apps/api/src/assets';
	assetPublicPath = '/srv/gauzy/apps/api/public';
} else {
	assetPath = path.join(path.resolve(__dirname, '../../../', ...['apps', 'api', 'src', 'assets']));

	assetPublicPath = path.join(path.resolve(__dirname, '../../../', ...['apps', 'api', 'public']));
}

console.log('Plugin Config -> assetPath: ' + assetPath);
console.log('Plugin Config -> assetPublicPath: ' + assetPublicPath);

console.log('DB Synchronize: ' + process.env.DB_SYNCHRONIZE);

export const pluginConfig: IPluginConfig = {
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
		...getDbConfig()
	},
	assetOptions: {
		assetPath: assetPath,
		assetPublicPath: assetPublicPath
	},
	plugins: [KnowledgeBasePlugin, ChangelogPlugin]
};

function getDbConfig(): DataSourceOptions {
	let dbType: string;

	if (process.env.DB_TYPE) dbType = process.env.DB_TYPE;
	else dbType = 'better-sqlite3';

	console.log('DB Type: ' + dbType);

	switch (dbType) {
		case 'mongodb':
			throw 'MongoDB not supported yet';

		case 'postgres':
			const ssl = process.env.DB_SSL_MODE === 'true' ? true : undefined;

			let sslParams: TlsOptions;

			if (ssl) {
				const base64data = process.env.DB_CA_CERT;
				const buff = Buffer.from(base64data, 'base64');
				const sslCert = buff.toString('ascii');

				sslParams = {
					rejectUnauthorized: true,
					ca: sslCert
				};
			}

			const postgresConnectionOptions: PostgresConnectionOptions = {
				type: dbType,
				ssl: ssl ? sslParams : undefined,
				host: process.env.DB_HOST || 'localhost',
				port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432,
				database: process.env.DB_NAME || 'postgres',
				username: process.env.DB_USER || 'postgres',
				password: process.env.DB_PASS || 'root',
				logging: process.env.DB_LOGGING == 'all' ? 'all' : ['query', 'error'],
				logger: 'advanced-console',
				// log queries that take more than 3 sec as warnings
				maxQueryExecutionTime: process.env.DB_SLOW_QUERY_LOGGING_TIMEOUT
					? parseInt(process.env.DB_SLOW_QUERY_LOGGING_TIMEOUT)
					: 3000,
				synchronize: process.env.DB_SYNCHRONIZE === 'true' ? true : false, // We are using migrations, synchronize should be set to false.
				uuidExtension: 'pgcrypto',
				// NOTE: in new TypeORM version this unified too `poolSize` in the root of connections option object.
				// See https://typeorm.io/data-source-options#common-data-source-options
				extra: {
					// based on  https://node-postgres.com/api/pool max connection pool size
					max: process.env.DB_POOL_SIZE || 40,
					// connection timeout
					connectionTimeoutMillis: process.env.DB_CONNECTION_TIMEOUT
						? parseInt(process.env.DB_CONNECTION_TIMEOUT)
						: 1000
				}
			};

			return postgresConnectionOptions;

		case 'sqlite':
			const sqlitePath =
				process.env.DB_PATH || path.join(path.resolve('.', ...['apps', 'api', 'data']), 'gauzy.sqlite3');

			return {
				type: dbType,
				database: sqlitePath,
				logging: 'all',
				logger: 'file', // Removes console logging, instead logs all queries in a file ormlogs.log
				synchronize: process.env.DB_SYNCHRONIZE === 'true' ? true : false // We are using migrations, synchronize should be set to false.
			};

		case 'better-sqlite3':
			const betterSqlitePath =
				process.env.DB_PATH || path.join(path.resolve('.', ...['apps', 'api', 'data']), 'gauzy.sqlite3');

			return {
				type: dbType,
				database: betterSqlitePath,
				logging: 'all',
				logger: 'file', // Removes console logging, instead logs all queries in a file ormlogs.log
				synchronize: process.env.DB_SYNCHRONIZE === 'true' ? true : false, // We are using migrations, synchronize should be set to false.
				prepareDatabase: (db) => {
					if (!process.env.IS_ELECTRON) {
						// Enhance performance
						db.pragma('journal_mode = WAL');
					}
				}
			};
	}
}
