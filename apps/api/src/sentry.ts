import { environment } from '@gauzy/config';
import { SentryPlugin, DefaultSentryIntegrations } from '@gauzy/sentry-plugin';
import { version } from '../version';

/**
 * Initializes and configures the Sentry module.
 * @returns The configured Sentry instance.
 */
export function initializeSentry(): typeof SentryPlugin {
    return SentryPlugin.init({
        dsn: environment.sentry.dsn,
        debug: process.env.SENTRY_DEBUG === 'true' || !environment.production,
        environment: environment.production ? 'production' : 'development',
        release: 'gauzy@' + version,
        logLevels: ['error'],
        integrations: [
            ...DefaultSentryIntegrations
        ],
        tracesSampleRate: process.env.SENTRY_TRACES_SAMPLE_RATE ? parseInt(process.env.SENTRY_TRACES_SAMPLE_RATE) : 0.01,
        profilesSampleRate: process.env.SENTRY_PROFILE_SAMPLE_RATE ? parseInt(process.env.SENTRY_PROFILE_SAMPLE_RATE) : 1,
        close: {
            enabled: true,
            timeout: 3000 // Time in milliseconds to forcefully quit the application
        }
    });
}

export const SentryTracing = initializeSentry();
