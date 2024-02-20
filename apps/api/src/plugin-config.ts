import * as path from 'path';
import * as chalk from 'chalk';
import { ApplicationPluginConfig, DEFAULT_API_PORT, DEFAULT_GRAPHQL_API_PATH, DEFAULT_API_HOST, DEFAULT_API_BASE_URL } from '@gauzy/common';
import { dbTypeOrmConnectionConfig, dbMikroOrmConnectionConfig, environment, dbKnexConnectionConfig } from '@gauzy/config';
import { ChangelogPlugin } from '@gauzy/changelog-plugin';
import { JitsuAnalyticsPlugin } from '@gauzy/jitsu-analytics-plugin';
import { KnowledgeBasePlugin } from '@gauzy/knowledge-base-plugin';
import { SentryService } from '@gauzy/sentry-plugin';
import { Sentry as SentryPlugin } from './sentry';
import { version } from './../version';

const { jitsu } = environment;

let assetPath: any;
let assetPublicPath: any;

console.log(chalk.magenta(`API Version %s`), version);
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

export const pluginConfig: ApplicationPluginConfig = {
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
		},
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
		retryAttempts: 100,
		retryDelay: 3000,
		...dbKnexConnectionConfig
	},
	assetOptions: {
		assetPath: assetPath,
		assetPublicPath: assetPublicPath
	},
	...(environment.sentry && environment.sentry.dsn ? {
		logger: new SentryService(SentryPlugin.options)
	} : {}),
	plugins: [
		// Indicates the inclusion or intention to use the ChangelogPlugin in the codebase.
		ChangelogPlugin,
		// Indicates the inclusion or intention to use the KnowledgeBasePlugin in the codebase.
		KnowledgeBasePlugin,
		// Initializes the Jitsu Analytics Plugin by providing a configuration object.
		JitsuAnalyticsPlugin.init({
			config: {
				host: jitsu.serverHost,
				writeKey: jitsu.serverWriteKey,
				debug: jitsu.debug,
				echoEvents: jitsu.echoEvents
			}
		}),
		...(environment.sentry && environment.sentry.dsn
			? [
				SentryPlugin
			]
			: []),
	]
};
