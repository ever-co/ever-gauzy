import * as Sentry from '@sentry/angular-ivy';
import { environment } from '../environments/environment';
import { version } from '../../version';

/**
 * Initializes and configures the Sentry module.
 * @returns The configured Sentry instance.
 */
export function initializeSentry(): void {
    return Sentry.init({
        dsn: environment.SENTRY_DSN,
        environment: environment.production ? 'production' : 'development',
        debug: !environment.production,
        integrations: [
            // Registers and configures the Tracing integration,
            // which automatically instruments your application to monitor its
            // performance, including custom Angular routing instrumentation
            Sentry.browserTracingIntegration(),
            // Registers the Replay integration,
            // which automatically captures Session Replays
            Sentry.replayIntegration()
        ],

        // Set `tracePropagationTargets` to control for which URLs distributed tracing should be enabled
        tracePropagationTargets: [
            'localhost',
            /^https:\/\/api\.gauzy\.co\/api/,
            /^https:\/\/apistage\.gauzy\.co\/api/,
            /^https:\/\/apidemo\.gauzy\.co\/api/
        ],
        // The release identifier used when uploading respective source maps.
        release: 'gauzy@' + version,
        // Capture Replay for 10% of all sessions,
        // plus for 100% of sessions with an error
        replaysSessionSampleRate: environment.SENTRY_TRACES_SAMPLE_RATE ? parseInt(environment.SENTRY_TRACES_SAMPLE_RATE) : 0.01,
        replaysOnErrorSampleRate: 1.0,

        // Set tracesSampleRate to 1.0 to capture 100%
        // of transactions for performance monitoring.
        // We recommend adjusting this value in production
        tracesSampleRate: environment.SENTRY_TRACES_SAMPLE_RATE ? parseInt(environment.SENTRY_TRACES_SAMPLE_RATE) : 0.01
    });
}
