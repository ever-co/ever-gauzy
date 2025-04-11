import { Inject, Injectable, Logger } from '@nestjs/common';
import { PosthogModuleOptions } from './posthog.interfaces';
import { POSTHOG_MODULE_OPTIONS } from './posthog.constants';
import { PostHog } from 'posthog-node';

@Injectable()
export class PosthogService {
	private readonly logger = new Logger(PosthogService.name);
	private client: PostHog | null = null;

	constructor(
		@Inject(POSTHOG_MODULE_OPTIONS)
		private readonly options: PosthogModuleOptions
	) {
		this.initClient();
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
			captureMode: 'form'
		});

		this.logger.log('PostHog client initialized');
	}

	/**
	 * Tracks a custom event for a specific user.
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
	 */
	public identify(distinctId: string, properties?: Record<string, any>) {
		if (!this.client) return;
		this.client.identify({
			distinctId,
			properties
		});
	}

	/**
	 * Gracefully shuts down the PostHog client.
	 */
	public async shutdown(): Promise<void> {
		if (!this.client) return;
		await this.client.shutdownAsync();
		this.logger.log('PostHog client shutdown complete');
	}
}
