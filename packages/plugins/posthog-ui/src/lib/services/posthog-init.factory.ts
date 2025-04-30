import { PostHogServiceManager } from './posthog-manager.service';
import { PostHogModuleConfig } from '../interfaces/posthog.interface';

/**
 * Factory function for initializing PostHog during app startup
 */
export function initializePostHogFactory(posthogManager: PostHogServiceManager, config: PostHogModuleConfig) {
	return () => {
		// Return quickly if no API key provided
		if (!config?.apiKey) {
			return Promise.resolve();
		}

		return new Promise<void>((resolve) => {
			try {
				// Initialize PostHog with provided configuration
				posthogManager.initialize(config);

				// If options.loaded exists, it will be called by the PostHog SDK
				// We can resolve immediately
				resolve();
			} catch (err) {
				console.error('[PostHog] Failed to initialize:', err);
				// Resolve anyway to prevent app from being blocked
				resolve();
			}
		});
	};
}
