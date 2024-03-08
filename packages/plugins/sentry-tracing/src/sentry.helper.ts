import { Integrations } from '@sentry/node';
import { Integration } from '@sentry/types';
import { environment } from '@gauzy/config';
import { SentryPluginOptions } from './sentry.types';

/**
 * Parses and formats Sentry plugin options for configuration.
 * @param config The input configuration options for Sentry plugin.
 * @returns The formatted Sentry configuration options.
 */
export const parseOptions = (config: SentryPluginOptions): Record<string, any> => ({
	dsn: config.dsn, //
	debug: config.debug || false, // Use debug from input config or false as default
	environment: config.environment, //
	release: config.release, //
	logLevels: config.logLevels || [], //
	integrations: config.integrations || [],
	tracesSampleRate: config.tracesSampleRate, //
	profilesSampleRate: config.profilesSampleRate, //
	close: {
		enabled: config.close?.enabled || true, //
		// Time in milliseconds to forcefully quit the application
		timeout: config.close?.timeout || 3000 //
	}
});

/**
 * Creates an array of Sentry integrations based on the provided environment configuration.
 * @returns {Integration[]} An array of Sentry integrations.
 */
export function createDefaultSentryIntegrations(): Integration[] {
	const integrations: Integration[] = [];

	if (environment.sentry && environment.sentry.dsn) {
		addHttpTracingIntegration(integrations);
		addPostgresTrackingIntegration(integrations);
		addConsoleIntegration(integrations);
		addGraphQLIntegration(integrations);
		addApolloIntegration(integrations);
		addLocalVariablesIntegration(integrations);
		addRequestDataIntegration(integrations);
	}

	return integrations;
}

/**
 * Add HTTP Tracing integration if enabled.
 * @param integrations The array of Sentry integrations.
 */
function addHttpTracingIntegration(integrations: Integration[]): void {
	if (process.env.SENTRY_DSN && process.env.SENTRY_HTTP_TRACING_ENABLED === 'true') {
		integrations.push(new Integrations.Http({ tracing: true, breadcrumbs: true }));
		console.log('Sentry HTTP Tracing Enabled');
	}
}

/**
 * Add Postgres Tracking integration if enabled.
 * @param integrations The array of Sentry integrations.
 */
function addPostgresTrackingIntegration(integrations: Integration[]): void {
	if (
		process.env.SENTRY_DSN &&
		process.env.SENTRY_POSTGRES_TRACKING_ENABLED === 'true' &&
		process.env.DB_TYPE === 'postgres'
	) {
		integrations.push(new Integrations.Postgres());
		console.log('Sentry Postgres Tracing Enabled');
	}
}

/**
 * Add Console integration.
 * @param integrations The array of Sentry integrations.
 */
function addConsoleIntegration(integrations: Integration[]): void {
	integrations.push(new Integrations.Console());
	console.log('Sentry Console Enabled');
}

/**
 * Add GraphQL integration.
 * @param integrations The array of Sentry integrations.
 */
function addGraphQLIntegration(integrations: Integration[]): void {
	integrations.push(new Integrations.GraphQL());
	console.log('Sentry GraphQL Enabled');
}

/**
 * Add Apollo integration.
 * @param integrations The array of Sentry integrations.
 */
function addApolloIntegration(integrations: Integration[]): void {
	integrations.push(new Integrations.Apollo({ useNestjs: true }));
	console.log('Sentry Apollo Enabled');
}

/**
 * Add Local Variables integration.
 * @param integrations The array of Sentry integrations.
 */
function addLocalVariablesIntegration(integrations: Integration[]): void {
	integrations.push(new Integrations.LocalVariables({ captureAllExceptions: true }));
	console.log('Sentry Local Variables Enabled');
}

/**
 * Add Request Data integration.
 * @param integrations The array of Sentry integrations.
 */
function addRequestDataIntegration(integrations: Integration[]): void {
	integrations.push(new Integrations.RequestData({ include: { ip: true } }));
	console.log('Sentry Request Data Enabled');
}

/**
 * Removes duplicate integrations based on their names.
 * @param {Integration[]} integrations - Array of integrations to process.
 * @returns {Integration[]} Array of unique integrations.
 */
export function removeDuplicateIntegrations(integrations: Integration[]): Integration[] {
	const map = new Set<string>();

	return integrations.reduce((unique: Integration[], integration) => {
		if (!map.has(integration.name)) {
			map.add(integration.name);
			unique.push(integration);
		}
		return unique;
	}, []);
}
