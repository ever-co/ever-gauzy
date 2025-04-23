import { PostHogService } from './posthog.service';

/**
 * Factory function to ensure PostHog service is initialized when the app starts
 */
export function initializePostHogFactory(postHogService: PostHogService) {
	return () => {
		return Promise.resolve();
	};
}
