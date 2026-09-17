import * as path from 'node:path';
import * as chalk from 'chalk';
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
import { resolvePluginLoadOrder } from '@gauzy/plugin';
import { PosthogAnalytics as PosthogPlugin } from './posthog';
import { SentryTracing as SentryPlugin } from './sentry';
import { version } from '../version';
import { plugins } from './plugins';

const { sentry, posthog } = environment;

console.log(chalk.magenta(`API Version %s`), version);
console.log('Plugin Config -> __dirname: ' + __dirname);
console.log('Plugin Config -> process.cwd: ' + process.cwd());

// TODO: maybe better to use process.cwd() instead of __dirname?

let assetPath: any;
let assetPublicPath: any;

// For Docker environment
if (__dirname.startsWith('/srv/gauzy')) {
	assetPath = '/srv/gauzy/apps/api/src/assets';
	assetPublicPath = '/srv/gauzy/apps/api/public';
} else {
	// Determine if running in production (dist) or development (src)
	const isDist = __dirname.includes(path.join('dist'));
	console.log('Plugin Config -> isDist: ' + isDist);

	// Adjust the base path based on the environment
	const basePath = isDist
		? path.resolve(process.cwd(), 'dist/apps/api') // For production
		: path.resolve(process.cwd(), 'apps/api'); // For development

	console.log('Plugin Config -> basePath: ' + basePath);

	// Set the asset paths relative to basePath
	assetPath = isDist
		? path.join(basePath, 'assets') // In dist, assets are directly under 'assets'
		: path.join(basePath, 'src', 'assets'); // In dev, assets are under 'src/assets'

	// Default public directory for assets
	assetPublicPath = isDist
		? path.resolve(process.cwd(), 'apps/api/public') // Adjusted for dist structure
		: path.resolve(__dirname, '../../../apps/api/public');
}

console.log('Plugin Config -> assetPath: ' + assetPath);
console.log('Plugin Config -> assetPublicPath: ' + assetPublicPath);
console.log('DB Synchronize: ' + process.env.DB_SYNCHRONIZE);

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
	// The configured list, ordered so every declared prerequisite loads before the plugin that
	// requires it. A plugin states what it needs with `dependsOn`; until this call existed that
	// declaration was inert and the order was whatever this file happened to list, which meant a
	// plugin could be mounted before the package whose tables it references. The resolver keeps the
	// configured order for every plugin that declares nothing, so enabling a dependency never
	// reshuffles unrelated plugins, and it refuses a list whose prerequisite is absent — naming the
	// plugin and the dependency as they were written — rather than letting the omission surface as a
	// missing provider at the first request.
	plugins: resolvePluginLoadOrder(plugins)
};
