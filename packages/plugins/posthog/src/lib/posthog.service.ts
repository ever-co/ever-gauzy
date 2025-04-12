import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { PosthogModuleOptions } from './posthog.interfaces';
import { POSTHOG_MODULE_OPTIONS } from './posthog.constants';
import { PostHog } from 'posthog-node';

@Injectable()
export class PosthogService implements OnModuleDestroy {
	private readonly logger = new Logger(PosthogService.name);
	private client: PostHog | null = null;
	private static instance: PosthogService;

	constructor(
		@Inject(POSTHOG_MODULE_OPTIONS)
		private readonly options: PosthogModuleOptions
	) {
		this.initClient();
		PosthogService.instance = this;
	}

	/**
	 * Gets the singleton instance of the PosthogService.
	 * @returns {PosthogService} The singleton instance.
	 */
	public static PosthogServiceInstance(): PosthogService {
		return PosthogService.instance;
	}

	/**
	 * Gets the PostHog client instance.
	 * @returns {PostHog | null} The PostHog client instance or null if not initialized.
	 */
	public instance(): PostHog | null {
		return this.client;
	}

	/**
	 * Initializes the PostHog client with the provided configuration.
	 */
	private initClient() {
		if (!this.options.apiKey) {
			this.logger.warn('PostHog API key is missing. Analytics will be disabled.');
			return;
		}

		this.client = new PostHog(this.options.apiKey, {
			host: this.options.apiHost || 'https://app.posthog.com',
			enableExceptionAutocapture: this.options.enableErrorTracking,
			flushAt: this.options.flushAt || 20,
			flushInterval: this.options.flushInterval || 10000,
			personalApiKey: this.options.personalApiKey
		});

		this.logger.log('PostHog client initialized');
	}

	/**
	 * Tracks a custom event for a specific user.
	 * @param {string} event - The event to track.
	 * @param {string} distinctId - The user's ID.
	 * @param {Record<string, any>} properties - Additional properties.
	 */
	public track(event: string, distinctId: string, properties?: Record<string, any>) {
		if (!this.client) return;
		this.client.capture({
			event,
			distinctId,
			properties
		});
	}

	/**
	 * Identifies a user with additional traits.
	 * @param {string} distinctId - The user's ID.
	 * @param {Record<string, any>} properties - Additional properties.
	 */
	public identify(distinctId: string, properties?: Record<string, any>) {
		if (!this.client) return;
		this.client.identify({
			distinctId,
			properties
		});
	}

	/**
	 * Tracks a page view for a specific user.
	 * @param {string} distinctId - The user's ID.
	 * @param {string} pageName - The name of the page.
	 * @param {Record<string, any>} properties - Additional properties.
	 */
	public pageView(distinctId: string, pageName: string, properties?: Record<string, any>) {
		if (!this.client) return;
		this.track('$pageview', distinctId, {
			$current_url: pageName,
			...properties
		});
	}

	/**
	 * Updates feature flags in memory.
	 */
	public reloadFeatureFlags() {
		if (!this.client) return;
		this.client.reloadFeatureFlags();
	}

	/**
	 * Checks if a feature flag is enabled for a user.
	 * @param {string} key - The feature flag key.
	 * @param {string} distinctId - The user's ID.
	 * @param {Record<string, any>} options - Additional options.
	 * @returns {boolean} Whether the feature flag is enabled.
	 */
	public isFeatureEnabled(key: string, distinctId: string, options?: Record<string, any>): boolean {
		if (!this.client) return false;
		// If PostHog's isFeatureEnabled returns a Promise, use a default value
		const result = this.client.isFeatureEnabled(key, distinctId, options);
		// If result is a Promise, return false as default
		return typeof result === 'boolean' ? result : false;
	}

	/**
	 * Gets the value of a feature flag for a user.
	 * @param {string} key - The feature flag key.
	 * @param {string} distinctId - The user's ID.
	 * @param {Record<string, any>} options - Additional options.
	 * @returns {string | boolean | number | Record<string, any> | null} The feature flag value.
	 */
	public getFeatureFlag(
		key: string,
		distinctId: string,
		options?: Record<string, any>
	): string | boolean | number | Record<string, any> | null {
		if (!this.client) return null;
		const result = this.client.getFeatureFlag(key, distinctId, options);
		// If result is a Promise, return null as default
		return result instanceof Promise ? null : result;
	}

	/**
	 * Gets all feature flags for a user.
	 * @param {string} distinctId - The user's ID.
	 * @returns {Record<string, string | boolean | number | Record<string, any>>} All feature flags.
	 */
	public getAllFlags(distinctId: string): Record<string, string | boolean | number | Record<string, any>> {
		if (!this.client) return {};
		const result = this.client.getAllFlags(distinctId);
		// If result is a Promise, return an empty object as default
		return result instanceof Promise ? {} : result;
	}

	/**
	 * Gracefully shuts down the PostHog client.
	 */
	public async shutdown(): Promise<void> {
		if (!this.client) return;
		await this.client.shutdown();
		this.logger.log('PostHog client shutdown complete');
	}

	/**
	 * Called when the module is being destroyed.
	 */
	async onModuleDestroy() {
		await this.shutdown();
	}
}
