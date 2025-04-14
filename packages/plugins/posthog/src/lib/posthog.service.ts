import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { PosthogModuleOptions } from './posthog.interfaces';
import { POSTHOG_MODULE_OPTIONS } from './posthog.constants';
import { PostHog } from 'posthog-node';

/**
 * Service that provides an interface to the PostHog analytics platform.
 * Follows the singleton pattern to ensure only one instance exists.
 * Implements OnModuleDestroy for proper cleanup when the module is destroyed.
 */
@Injectable()
export class PosthogService implements OnModuleDestroy {
	private readonly logger = new Logger(PosthogService.name);
	private client: PostHog | null = null;
	private static instance: PosthogService;

	/**
	 * Creates a new PosthogService instance.
	 * Initializes the singleton instance if it doesn't already exist.
	 *
	 * @param options - Configuration options for the PostHog client
	 */
	constructor(
		@Inject(POSTHOG_MODULE_OPTIONS)
		private readonly options: PosthogModuleOptions
	) {
		// Initialize the static instance if it doesn't exist
		if (!PosthogService.instance) {
			PosthogService.instance = this;
			this.initClient();
		}
	}

	/**
	 * Gets the singleton instance of the PosthogService.
	 *
	 * @returns The singleton instance of PosthogService
	 */
	public static PosthogServiceInstance(): PosthogService {
		return PosthogService.instance;
	}

	/**
	 * Gets the underlying PostHog client instance.
	 *
	 * @returns The PostHog client instance or null if not initialized
	 */
	public instance(): PostHog | null {
		return this.client;
	}

	/**
	 * Initializes the PostHog client with the provided configuration.
	 * If the API key is missing, analytics will be disabled.
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
	 *
	 * @param event - The name of the event to track
	 * @param distinctId - The unique identifier for the user
	 * @param properties - Optional additional properties to associate with the event
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
	 * Captures an exception or error event for a specific user.
	 * Uses PostHog's captureException method to track errors.
	 *
	 * @param event - The name of the error event
	 * @param distinctId - The unique identifier for the user
	 * @param properties - Optional additional properties describing the error
	 */
	public captureException(event: string, distinctId: string, properties?: Record<string, any>) {
		if (!this.client) return;
		this.client.captureException({
			event,
			distinctId,
			properties
		});
	}

	/**
	 * Identifies a user with additional traits or properties.
	 *
	 * @param distinctId - The unique identifier for the user
	 * @param properties - Optional user traits or properties to associate with this user
	 */
	public identify(distinctId: string, properties?: Record<string, any>) {
		if (!this.client) return;
		this.client.identify({
			distinctId,
			properties
		});
	}

	/**
	 * Updates feature flags in memory by fetching the latest values from PostHog.
	 */
	public reloadFeatureFlags() {
		if (!this.client) return;
		this.client.reloadFeatureFlags();
	}

	/**
	 * Checks if a feature flag is enabled for a specific user.
	 *
	 * @param key - The feature flag key to check
	 * @param distinctId - The unique identifier for the user
	 * @param options - Optional additional options for the feature flag
	 * @returns Whether the feature flag is enabled (defaults to false if client isn't initialized)
	 */
	public isFeatureEnabled(key: string, distinctId: string, options?: Record<string, any>): boolean {
		if (!this.client) return false;
		// If PostHog's isFeatureEnabled returns a Promise, use a default value
		const result = this.client.isFeatureEnabled(key, distinctId, options);
		// If result is a Promise, return false as default
		return typeof result === 'boolean' ? result : false;
	}

	/**
	 * Gets the value of a feature flag for a specific user.
	 *
	 * @param key - The feature flag key to retrieve
	 * @param distinctId - The unique identifier for the user
	 * @param options - Optional additional options for the feature flag
	 * @returns The feature flag value, or null if not found or client isn't initialized
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
	 * Gets all feature flags for a specific user.
	 *
	 * @param distinctId - The unique identifier for the user
	 * @returns Object containing all feature flags and their values
	 */
	public getAllFlags(distinctId: string): Record<string, string | boolean | number | Record<string, any>> {
		if (!this.client) return {};
		const result = this.client.getAllFlags(distinctId);
		// If result is a Promise, return an empty object as default
		return result instanceof Promise ? {} : result;
	}

	/**
	 * Gracefully shuts down the PostHog client, ensuring all queued events are sent.
	 *
	 * @returns Promise that resolves when shutdown is complete
	 */
	public async shutdown(): Promise<void> {
		if (!this.client) return;
		await this.client.shutdown();
		this.logger.log('PostHog client shutdown complete');
	}

	/**
	 * Lifecycle hook called when the NestJS module is being destroyed.
	 * Automatically calls the shutdown method to ensure proper cleanup.
	 *
	 * @returns Promise that resolves when shutdown is complete
	 */
	async onModuleDestroy() {
		await this.shutdown();
	}
}
