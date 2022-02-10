import { TlsOptions } from 'tls';
import {
	IPluginConfig,
	DEFAULT_API_PORT,
	DEFAULT_GRAPHQL_API_PATH,
	DEFAULT_API_HOST,
	DEFAULT_API_BASE_URL
} from '@gauzy/common';
import { environment } from '@gauzy/config';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { ConnectionOptions } from 'typeorm';
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

console.log('Plugin Config -> assetPath: ' + assetPath);
console.log('Plugin Config -> assetPublicPath: ' + assetPublicPath);

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
		migrationsRun: !environment.production, // Run migrations automatically, you can disable this if you prefer running migration manually.
		...getDbConfig(),
	},
	assetOptions: {
		assetPath: assetPath,
		assetPublicPath: assetPublicPath
	},
	plugins: [KnowledgeBasePlugin, ChangelogPlugin]
};

function getDbConfig(): ConnectionOptions {
	let dbType:string;

	if (process.env.DB_TYPE)
	  	dbType = process.env.DB_TYPE;
	else 
		dbType = 'sqlite';	

	switch (dbType) {

		case 'mongodb':
			throw "MongoDB not supported yet";

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
				}
			}

			const postgresConnectionOptions: PostgresConnectionOptions = {
				type: dbType,
				host: process.env.DB_HOST || 'localhost',
				port: process.env.DB_PORT
					? parseInt(process.env.DB_PORT, 10)
					: 5432,
				database: process.env.DB_NAME || 'postgres',
				username: process.env.DB_USER || 'postgres',
				password: process.env.DB_PASS || 'root',
				ssl: ssl ? sslParams : undefined,
				logging: true,
				logger: 'file', // Removes console logging, instead logs all queries in a file ormlogs.log
				synchronize: process.env.DB_SYNCHRONIZE === 'true' ? true : false, // We are using migrations, synchronize should be set to false.
				uuidExtension: 'pgcrypto'
			}

			return postgresConnectionOptions;

		case 'sqlite':
			const sqlitePath =
				process.env.DB_PATH ||
				path.join(
					path.resolve('.', ...['apps', 'api', 'data']),
					'gauzy.sqlite3'
				);

			return {
				type: dbType,
				database: sqlitePath,
				logging: true,
				logger: 'file', // Removes console logging, instead logs all queries in a file ormlogs.log
				synchronize: process.env.DB_SYNCHRONIZE === 'true' ? true : false, // We are using migrations, synchronize should be set to false.
			};
	}
}
