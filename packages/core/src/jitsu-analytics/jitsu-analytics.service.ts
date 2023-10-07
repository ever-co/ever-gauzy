import { Inject, Injectable, Logger } from '@nestjs/common';
import { AnalyticsInterface, JitsuOptions } from '@jitsu/js';
import * as chalk from 'chalk';
import { JITSU_MODULE_PROVIDER_CONFIG } from './jitsu.types';
import { createJitsu } from './jitsu-helper';

@Injectable()
export class JitsuAnalyticsService {

	private readonly logger = new Logger(JitsuAnalyticsService.name);
	private readonly jitsu: AnalyticsInterface;

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
				console.error(chalk.yellow(`Jitsu Analytics initialization failed: Missing host or writeKey.`));
			}
		} catch (error) {
			console.error(chalk.red(`Jitsu Analytics initialization failed: ${error.message}`));
		}
	}

	/**
	 * Track an analytics event using Jitsu Analytics.
	 * @param event The name of the event to track.
	 * @param properties Additional event properties (optional).
	 * @returns A promise that resolves when the event is tracked.
	 */
	async trackEvent(
		event: string,
		properties?: Record<string, any> | null
	): Promise<any> {
		// Check if this.jitsu is defined and both host and writeKey are defined
		if (this.jitsu && this.config.host && this.config.writeKey) {
			this.logger.log(`Jitsu Tracking Entity Events`, JSON.stringify(properties));
			return await this.jitsu.track(event, properties);
		} else {
			// Handle it as needed (e.g., log or return a default result)
			this.logger.warn(`Jitsu tracking is not available. Unable to track event: ${event}`);
			return null; // or handle it differently based on your requirements
		}
	}

	/**
	 * Identify a user with optional user traits.
	 * @param id The user identifier, such as a user ID or an object representing user information.
	 * @param traits User traits or properties to associate with the user.
	 * @returns A Promise that resolves when the user is identified.
	 */
	async identify(
		id: string | object,
		traits?: Record<string, any> | null
	): Promise<any> {
		// Check if this.jitsu is defined and both host and writeKey are defined
		if (this.jitsu && this.config.host && this.config.writeKey) {
			return await this.jitsu.identify(id, traits);
		}
	}

	/**
	 * Group users into a specific segment or organization.
	 * @param id The identifier for the group, such as a group ID or an object representing group information.
	 * @param traits Additional data or traits associated with the group.
	 * @returns A Promise that resolves when the users are grouped.
	 */
	async group(
		id: string | object,
		traits?: Record<string, any> | null
	): Promise<any> {
		// Check if this.jitsu is defined and both host and writeKey are defined
		if (this.jitsu && this.config.host && this.config.writeKey) {
			return await this.jitsu.group(id, traits);
		}
	}
}
