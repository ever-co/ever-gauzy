import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { PostHog } from 'posthog-node';
import { RequestContext } from '@gauzy/core';
import { PosthogModuleOptions } from './posthog.interfaces';
import { POSTHOG_MODULE_OPTIONS } from './posthog.constants';

/**
 * Service that provides an interface to the PostHog analytics platform.
 * Supports multi-tenant configuration via tenant settings from RequestContext.
 * Follows the same pattern as S3Provider for reading tenant settings.
 * Implements OnModuleDestroy for proper cleanup when the module is destroyed.
 */
@Injectable()
export class PosthogService implements OnModuleDestroy {
	private readonly logger = new Logger(PosthogService.name);
	/** Default client initialized from startup options (env vars) */
	private defaultClient: PostHog | null = null;
	/** Cache of tenant-specific clients, keyed by apiKey */
	private clientCache: Map<string, PostHog> = new Map();
	private static instance: PosthogService;

	/**
	 * Creates a new PosthogService instance.
	 * Initializes the default client from startup options (environment variables).
	 *
	 * @param options - Default configuration options for the PostHog client (from env)
	 */
	constructor(
		@Inject(POSTHOG_MODULE_OPTIONS)
		private readonly options: PosthogModuleOptions
	) {
		if (!PosthogService.instance) {
			PosthogService.instance = this;
			this.initDefaultClient();
		}
	}

	/**
	 * Gets the singleton instance of the PosthogService.
	 *
	 * @returns The singleton instance of PosthogService
	 */
	public static PosthogServiceInstance(): PosthogService {
		if (!PosthogService.instance) {
			throw new Error('PosthogService instance not initialized');
		}
		return PosthogService.instance;
	}

	/**
	 * Gets the PostHog client for the current request context.
	 * Returns tenant-specific client if tenant has custom settings, otherwise the default client.
	 *
	 * @returns The PostHog client instance or null if not initialized
	 */
	public instance(): PostHog | null {
		return this.getClientForCurrentRequest();
	}

	/**
	 * Initializes the default PostHog client with startup configuration (from env).
	 */
	private initDefaultClient(): void {
		if (!this.options.apiKey) {
			this.logger.warn('PostHog API key is missing. Analytics will be disabled by default.');
			return;
		}

		this.defaultClient = this.createClient(this.options);
		this.logger.log('PostHog default client initialized');
	}

	/**
	 * Creates a PostHog client with the given options.
	 */
	private createClient(options: PosthogModuleOptions): PostHog {
		return new PostHog(options.apiKey, {
			host: options.apiHost || 'https://app.posthog.com',
			enableExceptionAutocapture: options.enableErrorTracking,
			flushAt: options.flushAt || 20,
			flushInterval: options.flushInterval || 10000,
			personalApiKey: options.personalApiKey
		});
	}

	/**
	 * Gets the current PostHog configuration by merging default options with resolved settings.
	 */
	private getCurrentConfig(): PosthogModuleOptions {
		let config: PosthogModuleOptions = { ...this.options };

		try {
			const request = RequestContext.currentRequest();

			if (request) {
				const settings = request['resolvedSettings'];

				if (settings) {
					if (settings.posthogKey) {
						config = { ...config, apiKey: settings.posthogKey };
					}
					if (settings.posthogHost) {
						config = { ...config, apiHost: settings.posthogHost };
					}
					if (settings.posthogEnabled !== undefined) {
						const enabled = settings.posthogEnabled === 'true' || settings.posthogEnabled === true;
						if (!enabled) {
							config = { ...config, apiKey: '' };
						}
					}
					if (settings.posthogFlushInterval) {
						const interval = parseInt(settings.posthogFlushInterval, 10);
						if (!isNaN(interval)) {
							config = { ...config, flushInterval: interval };
						}
					}
					if (settings.posthogFlushAt) {
						const flushAt = parseInt(settings.posthogFlushAt, 10);
						if (!isNaN(flushAt)) {
							config = { ...config, flushAt };
						}
					}
					if (settings.posthogEnableErrorTracking !== undefined) {
						config = { ...config, enableErrorTracking: settings.posthogEnableErrorTracking === 'true' };
					}
				}
			}
		} catch (error) {
			this.logger.debug('Error reading tenant settings, using default config');
		}

		return config;
	}

	/**
	 * Gets or creates a client for the current request based on tenant settings.
	 */
	private getClientForCurrentRequest(): PostHog | null {
		const config = this.getCurrentConfig();

		if (!config.apiKey) {
			return null;
		}

		// Generate cache key from all config properties that affect client behavior
		const cacheKey = `${config.apiKey}:${config.apiHost}:${config.flushInterval}:${config.flushAt}:${config.enableErrorTracking}`;
		const defaultCacheKey = `${this.options.apiKey}:${this.options.apiHost}:${this.options.flushInterval}:${this.options.flushAt}:${this.options.enableErrorTracking}`;

		// Return default client if config unchanged
		if (cacheKey === defaultCacheKey) {
			return this.defaultClient;
		}

		if (this.clientCache.has(cacheKey)) {
			return this.clientCache.get(cacheKey)!;
		}

		const client = this.createClient(config);
		this.clientCache.set(cacheKey, client);

		return client;
	}

	/**
	 * Tracks a custom event for a specific user.
	 *
	 * @param event - The name of the event to track
	 * @param distinctId - The unique identifier for the user
	 * @param properties - Optional additional properties to associate with the event
	 */
	public track(event: string, distinctId: string, properties?: Record<string, any>): void {
		const client = this.getClientForCurrentRequest();
		if (!client) return;
		client.capture({
			event,
			distinctId,
			properties
		});
	}

	/**
	 * Captures an exception or error event for a specific user.
	 * Uses PostHog's captureException method to track errors.
	 *
	 * @param exception - The error or exception to capture
	 * @param distinctId - The unique identifier for the user
	 * @param properties - Optional additional properties describing the error
	 */
	public captureException(exception: any, distinctId: string, properties?: Record<string, any>): void {
		const client = this.getClientForCurrentRequest();
		if (!client) return;
		client.captureException({
			exception,
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
	public identify(distinctId: string, properties?: Record<string, any>): void {
		const client = this.getClientForCurrentRequest();
		if (!client) return;
		client.identify({
			distinctId,
			properties
		});
	}

	/**
	 * Gracefully shuts down all PostHog clients, ensuring all queued events are sent.
	 *
	 * @returns Promise that resolves when shutdown is complete
	 */
	public async shutdown(): Promise<void> {
		// Shutdown default client
		if (this.defaultClient) {
			await this.defaultClient.shutdown();
		}

		// Shutdown all cached tenant clients
		for (const client of this.clientCache.values()) {
			await client.shutdown();
		}
		this.clientCache.clear();

		this.logger.log('PostHog clients shutdown complete');
	}

	/**
	 * Lifecycle hook called when the NestJS module is being destroyed.
	 * Automatically calls the shutdown method to ensure proper cleanup.
	 *
	 * @returns Promise that resolves when shutdown is complete
	 */
	async onModuleDestroy(): Promise<void> {
		await this.shutdown();
	}
}
