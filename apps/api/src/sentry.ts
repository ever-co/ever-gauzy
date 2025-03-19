import { Logger } from '@nestjs/common';
import { environment } from '@gauzy/config';
import { SentryPlugin, DefaultSentryIntegrations } from '@gauzy/plugin-sentry';
import { version } from '../version';

const logger = new Logger('GZY - Sentry');
/**
 * Initializes and configures the Sentry module for error tracking and performance monitoring.
 *
 * This function checks if a valid DSN is provided in the environment configuration.
 * If the DSN is available, it initializes Sentry with the specified settings.
 * Otherwise, it logs a message indicating that Sentry was not initialized.
 *
 * @returns {typeof SentryPlugin | null} The configured Sentry instance, or null if not initialized.
 */
export function initializeSentry(): typeof SentryPlugin | null {
	if (!environment.sentry.dsn) {
		logger.warn('Sentry not initialized: DSN not provided');
		return null;
	}

	logger.verbose('Initializing Sentry with DSN:', environment.sentry.dsn);

	// Configure Sentry
	return SentryPlugin.init({
		dsn: environment.sentry.dsn,
		debug: process.env.SENTRY_DEBUG === 'true' || !environment.production,
		environment: environment.production ? 'production' : 'development',
		release: `gauzy@${version}`,
		logLevels: ['error'],
		integrations: [...DefaultSentryIntegrations],
		tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.01'),
		profilesSampleRate: parseFloat(process.env.SENTRY_PROFILE_SAMPLE_RATE || '1'),
		close: {
			enabled: true,
			timeout: 3000 // Forcefully quit the application after 3 seconds if needed
		}
	});
}

export const SentryTracing = initializeSentry();
