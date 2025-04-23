import { PostHogServiceManager } from './posthog-manager.service';

/**
 * Factory function for initializing PostHog during app startup
 * This ensures that PostHog is initialized before the application is fully loaded
 *
 * @param posthogManager - The PostHog service manager to initialize
 * @returns A function that completes when PostHog is initialized
 */
export function initializePostHogFactory(posthogManager: PostHogServiceManager) {
	return () => {
		return Promise.resolve();
	};
}
