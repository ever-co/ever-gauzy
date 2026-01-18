import { Inject, Injectable, Logger } from '@nestjs/common';
import { AnalyticsInterface, JitsuOptions } from '@jitsu/js';
import { RequestContext } from '@gauzy/core';
import { JITSU_MODULE_PROVIDER_CONFIG } from './jitsu.types';
import { createJitsu } from './jitsu-helper';

@Injectable()
export class JitsuAnalyticsService {
	private readonly logger = new Logger(JitsuAnalyticsService.name);
	private readonly jitsu: AnalyticsInterface;
	private readonly clientCache = new Map<string, AnalyticsInterface>();

	constructor(
		@Inject(JITSU_MODULE_PROVIDER_CONFIG)
		private readonly config: JitsuOptions
	) {
		try {
			// Check if the required host and writeKey configuration properties are present
			if (this.config.host && this.config.writeKey) {
				// Initialize the Jitsu Analytics instance
				this.jitsu = createJitsu(this.config);
			} else {
				this.logger.warn(
					`Jitsu Analytics initialization failed at JitsuAnalyticsService: Missing host or writeKey.`
				);
			}
		} catch (error) {
			this.logger.error(`Jitsu Analytics initialization failed: ${error.message}`);
		}
	}

	/**
	 * Get Jitsu client for current request based on resolvedSettings.
	 */
	private getClient(): AnalyticsInterface | null {
		let host = this.config.host;
		let writeKey = this.config.writeKey;
		let debug = this.config.debug;

		try {
			const settings = RequestContext.currentRequest()?.['resolvedSettings'];
			if (settings) {
				// Check if disabled
				if (settings.jitsuEnabled !== undefined) {
					const enabled = settings.jitsuEnabled === 'true' || settings.jitsuEnabled === true;
					if (!enabled) return null;
				}
				// Override with tenant settings
				if (settings.jitsuHost) host = settings.jitsuHost;
				if (settings.jitsuWriteKey) writeKey = settings.jitsuWriteKey;
				if (settings.jitsuDebug !== undefined) {
					debug = settings.jitsuDebug === 'true' || settings.jitsuDebug === true;
				}
			}
		} catch {
			// No request context, use defaults
		}

		// Check if this.jitsu is defined and both host and writeKey are defined
		if (!host || !writeKey) return null;

		// Return default client if config unchanged (including debug)
		if (host === this.config.host && writeKey === this.config.writeKey && debug === this.config.debug) {
			return this.jitsu;
		}

		// Get or create cached client for tenant config (include debug in cache key)
		const cacheKey = `${host}:${writeKey}:${debug}`;
		let client = this.clientCache.get(cacheKey);
		if (!client) {
			client = createJitsu({ ...this.config, host, writeKey, debug });
			this.clientCache.set(cacheKey, client);
		}
		return client;
	}

	/**
	 * Track an analytics event using Jitsu Analytics.
	 * @param event The name of the event to track.
	 * @param properties Additional event properties (optional).
	 * @returns A promise that resolves when the event is tracked.
	 */
	async trackEvent(event: string, properties?: Record<string, any> | null): Promise<any> {
		return this.getClient()?.track(event, properties) ?? null;
	}

	/**
	 * Identify a user with optional user traits.
	 * @param id The user identifier, such as a user ID or an object representing user information.
	 * @param traits User traits or properties to associate with the user.
	 * @returns A Promise that resolves when the user is identified.
	 */
	async identify(id: string | object, traits?: Record<string, any> | null): Promise<any> {
		return this.getClient()?.identify(id, traits) ?? null;
	}

	/**
	 * Group users into a specific segment or organization.
	 * @param id The identifier for the group, such as a group ID or an object representing group information.
	 * @param traits Additional data or traits associated with the group.
	 * @returns A Promise that resolves when the users are grouped.
	 */
	async group(id: string | object, traits?: Record<string, any> | null): Promise<any> {
		return this.getClient()?.group(id, traits) ?? null;
	}
}
