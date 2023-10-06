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
	async track(
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
}
