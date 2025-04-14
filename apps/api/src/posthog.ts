import { environment } from '@gauzy/config';
import { PosthogPlugin } from '@gauzy/plugin-posthog';

/**
 * Initializes and configures the PostHog plugin for analytics and performance tracking.
 *
 * This function checks if PostHog tracking is enabled in the environment configuration.
 * If enabled, it initializes the PostHog plugin with the specified settings.
 * Otherwise, it logs a message indicating that PostHog was not initialized.
 *
 * @returns {typeof PosthogPlugin | null} The configured PostHog instance, or null if not initialized.
 */
export function initializePosthog(): typeof PosthogPlugin | null {
	if (!environment.posthog?.posthogEnabled || !environment.posthog?.posthogKey) {
		console.log('PostHog not initialized: Tracking is disabled or API key is missing');
		return null;
	}

	console.log(
		'\x1b[36m%s\x1b[0m', // Cyan color
		'=================================================================='
	);
	console.log(
		'\x1b[33m%s\x1b[0m', // Yellow color
		'🚀 Initializing PostHog Analytics',
		`\nKey: ${environment.posthog.posthogKey.substring(0, 5)}...${environment.posthog.posthogKey.substring(-3)}`,
		`\nHost: ${environment.posthog.posthogHost || 'https://app.posthog.com'}`
	);
	console.log(
		'\x1b[36m%s\x1b[0m', // Cyan color
		'=================================================================='
	);

	// Configure PostHog
	return PosthogPlugin.init({
		apiKey: environment.posthog.posthogKey,
		apiHost: environment.posthog.posthogHost || 'https://app.posthog.com',
		enableErrorTracking: true,
		flushInterval: parseInt(process.env.POSTHOG_FLUSH_INTERVAL || '10000', 10),
		flushAt: 20,
		autocapture: true,
		mock: false
	});
}

export const PosthogAnalytics = initializePosthog();
