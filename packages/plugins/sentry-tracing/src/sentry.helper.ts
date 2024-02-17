import { Integrations } from "@sentry/node";
import { Integration } from '@sentry/types';
import { ProfilingIntegration } from '@sentry/profiling-node';
import { environment } from "@gauzy/config";
import { SentryPluginOptions } from "./sentry.types";

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
        // Uncomment the following line if needed
        // addProfilingIntegration(integrations);
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
export function addHttpTracingIntegration(integrations: Integration[]): void {
    if (process.env.SENTRY_HTTP_TRACING_ENABLED === 'true') {
        integrations.push(new Integrations.Http({ tracing: true, breadcrumbs: true }));
        console.log('Sentry HTTP Tracing Enabled');
    }
}

/**
 * Add Postgres Tracking integration if enabled.
 * @param integrations The array of Sentry integrations.
 */
export function addPostgresTrackingIntegration(integrations: Integration[]): void {
    if (process.env.SENTRY_POSTGRES_TRACKING_ENABLED === 'true' && process.env.DB_TYPE === 'postgres') {
        integrations.push(new Integrations.Postgres());
        console.log('Sentry Postgres Tracking Enabled');
    }
}

/**
 * Adds the ProfilingIntegration to the array of Sentry integrations if profiling is enabled.
 * @param integrations The array of Sentry integrations.
 */
export function addProfilingIntegration(integrations: Integration[]): void {
    // Check if Sentry profiling is enabled
    if (process.env.SENTRY_PROFILING_ENABLED === 'true') {
        // Add ProfilingIntegration to the array
        integrations.push(new ProfilingIntegration());
        // Log a message indicating that Sentry Profiling is enabled
        console.log('Sentry Profiling Enabled');
    }
}

/**
 * Add Console integration.
 * @param integrations The array of Sentry integrations.
 */
export function addConsoleIntegration(integrations: Integration[]): void {
    integrations.push(new Integrations.Console());
    console.log('Sentry Console Enabled');
}

/**
 * Add GraphQL integration.
 * @param integrations The array of Sentry integrations.
 */
export function addGraphQLIntegration(integrations: Integration[]): void {
    integrations.push(new Integrations.GraphQL());
    console.log('Sentry GraphQL Enabled');
}

/**
 * Add Apollo integration.
 * @param integrations The array of Sentry integrations.
 */
export function addApolloIntegration(integrations: Integration[]): void {
    integrations.push(new Integrations.Apollo({ useNestjs: true }));
    console.log('Sentry Apollo Enabled');
}

/**
 * Add Local Variables integration.
 * @param integrations The array of Sentry integrations.
 */
export function addLocalVariablesIntegration(integrations: Integration[]): void {
    integrations.push(new Integrations.LocalVariables({ captureAllExceptions: true }));
    console.log('Sentry Local Variables Enabled');
}

/**
 * Add Request Data integration.
 * @param integrations The array of Sentry integrations.
 */
export function addRequestDataIntegration(integrations: Integration[]): void {
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
