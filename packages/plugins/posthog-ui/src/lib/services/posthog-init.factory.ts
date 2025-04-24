import { PostHogServiceManager } from './posthog-manager.service';
import { PostHogModuleConfig } from '../interfaces/posthog.interface';

/**
 * Factory function for initializing PostHog during app startup
 * This ensures that PostHog is initialized before the application is fully loaded
 *
 * @param posthogManager - The PostHog service manager to initialize
 * @param config - The PostHog configuration
 * @returns A function that completes when PostHog is initialized
 */
export function initializePostHogFactory(posthogManager: PostHogServiceManager, config: PostHogModuleConfig) {
	return () => {
		// Return a promise that resolves when PostHog is fully initialized
		return new Promise<void>((resolve) => {
			if (!config.apiKey) {
				console.warn('[PostHog] No API key provided, PostHog will not be initialized');
				resolve();
				return;
			}

			try {
				// Initialize PostHog with provided configuration
				posthogManager.initialize(config);

				// Set up a custom callback to know when PostHog is fully loaded
				const originalLoaded = config.options?.loaded;
				if (originalLoaded) {
					const enhancedLoadedCallback = (posthog: any) => {
						originalLoaded(posthog);
						resolve();
					};

					// Override the loaded callback to include our resolution
					if (config.options) {
						config.options.loaded = enhancedLoadedCallback;
					}
				} else {
					// If no loaded callback was provided, resolve immediately
					resolve();
				}
			} catch (err) {
				console.error('[PostHog] Failed to initialize:', err);
				// Resolve anyway to prevent app from being blocked
				resolve();
			}
		});
	};
}
