import * as dotenv from 'dotenv';
dotenv.config();

import * as path from 'path';
import {
	DEFAULT_API_HOST,
	DEFAULT_API_PORT,
	DEFAULT_API_BASE_URL,
	DEFAULT_GRAPHQL_API_PATH,
	ApplicationPluginConfig
} from '@gauzy/common';
import { dbTypeOrmConnectionConfig, dbMikroOrmConnectionConfig, dbKnexConnectionConfig } from './database';

process.cwd();

let assetPath: string;
let assetPublicPath: string;

console.log('Default Config -> __dirname: ' + __dirname);
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

console.log('Default Config -> assetPath: ' + assetPath);
console.log('Default Config -> assetPublicPath: ' + assetPublicPath);

/**
 * Application plugin default configuration
 */
export const defaultConfiguration: ApplicationPluginConfig = {
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
		retryAttempts: 100,
		retryDelay: 3000,
		migrationsTransactionMode: 'each', // Run migrations automatically in each transaction. i.e."all" | "none" | "each"
		migrationsRun: process.env.DB_SYNCHRONIZE === 'true' ? false : true, // Run migrations automatically if we don't do DB_SYNCHRONIZE
		...dbTypeOrmConnectionConfig
	},
	dbMikroOrmConnectionOptions: {
		...dbMikroOrmConnectionConfig
	},
	dbKnexConnectionOptions: {
		retryAttempts: 100, // Number of retry attempts in case of connection failures
		retryDelay: 3000, // Delay between retry attempts in milliseconds
		...dbKnexConnectionConfig
	},
	plugins: [],
	customFields: {
		Employee: [],
		Organization: [],
		OrganizationProject: [],
		Tag: [],
		Tenant: [],
		User: []
	},
	authOptions: {
		expressSessionSecret: process.env.EXPRESS_SESSION_SECRET || 'gauzy',
		userPasswordBcryptSaltRounds: 12,
		jwtSecret: process.env.JWT_SECRET || 'secretKey'
	},
	assetOptions: {
		assetPath: assetPath,
		assetPublicPath: assetPublicPath
	}
};
