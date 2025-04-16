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

	// Configure PostHog
	return PosthogPlugin.init({
		apiKey: environment.posthog.posthogKey,
		apiHost: environment.posthog.posthogHost || 'https://app.posthog.com',
		enableErrorTracking: true,
		flushInterval: environment.posthog.posthogFlushInterval || 10000,
		flushAt: 20,
		autocapture: true,
		mock: false
	});
}

export const PosthogAnalytics = initializePosthog();
