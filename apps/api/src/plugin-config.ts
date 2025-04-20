import { Logger } from '@nestjs/common';
import * as path from 'path';
import { ApplicationPluginConfig } from '@gauzy/common';
import { DEFAULT_API_PORT, DEFAULT_GRAPHQL_API_PATH, DEFAULT_API_HOST, DEFAULT_API_BASE_URL } from '@gauzy/constants';
import {
	dbTypeOrmConnectionConfig,
	dbMikroOrmConnectionConfig,
	environment,
	dbKnexConnectionConfig
} from '@gauzy/config';
import { SentryService } from '@gauzy/plugin-sentry';
import { PosthogService } from '@gauzy/plugin-posthog';
import { PosthogAnalytics as PosthogPlugin } from './posthog';
import { SentryTracing as SentryPlugin } from './sentry';
import { version } from './../version';
import { plugins } from './plugins';

const { sentry, posthog } = environment;

const logger = new Logger('GZY - Plugin Config');

logger.log(`API Version ${version}`);
logger.verbose(`Working directory: ${process.cwd()}`);

const assetPath = path.join(process.cwd(), 'apps', 'api', 'src', 'assets');
const assetPublicPath = path.join(process.cwd(), 'apps', 'api', 'public');

logger.verbose(`AssetPath: ${assetPath}`);
logger.verbose(`AssetPublicPath: ${assetPublicPath}`);
logger.verbose('DB Synchronize: ' + process.env.DB_SYNCHRONIZE);
logger.verbose('Plugins loaded: ' + plugins.length);

/**
 * Application plugin configuration for production environment.
 */
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
		}
	},
	dbConnectionOptions: {
		retryAttempts: 100,
		retryDelay: 3000,
		migrationsTransactionMode: 'each', // Run migrations automatically in each transaction. i.e."all" | "none" | "each"
		migrationsRun: process.env.DB_SYNCHRONIZE !== 'true', // Run migrations automatically if we don't do DB_SYNCHRONIZE
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
	logger: (() => {
		const loggers = [];

		if (sentry?.dsn) {
			loggers.push(new SentryService(SentryPlugin.options));
		}
		if (posthog?.posthogEnabled && posthog?.posthogKey) {
			loggers.push(new PosthogService(PosthogPlugin.options));
		}

		// Combine both, or return undefined if no logger is configured
		if (loggers.length === 0) {
			return undefined;
		} else if (loggers.length === 1) {
			return loggers[0];
		} else {
			return {
				log: (...args) => loggers.forEach((logger) => logger.log?.(...args)),
				error: (...args) => loggers.forEach((logger) => logger.error?.(...args)),
				warn: (...args) => loggers.forEach((logger) => logger.warn?.(...args)),
				debug: (...args) => loggers.forEach((logger) => logger.debug?.(...args)),
				verbose: (...args) => loggers.forEach((logger) => logger.verbose?.(...args))
			};
		}
	})(),
	plugins
};
