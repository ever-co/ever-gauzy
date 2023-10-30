import { AnalyticsInterface } from '@jitsu/js';
import { Logger } from '@nestjs/common';
import * as chalk from 'chalk';
import {
	InsertEvent,
	RemoveEvent,
	EntitySubscriberInterface,
	UpdateEvent,
	EventSubscriber,
} from 'typeorm';
import { environment } from '@gauzy/config';
import { createJitsu } from './jitsu-helper';

// Extract configuration values from environment
const { jitsu } = environment;

/* Global Entity Subscriber - Listens to all entity
inserts updates and removal then sends to Jitsu */
@EventSubscriber()
export class JitsuEventsSubscriber implements EntitySubscriberInterface {
	private readonly logger = new Logger(JitsuEventsSubscriber.name);
	private readonly jitsuAnalytics: AnalyticsInterface;

	// We disable by default additional logging for each event to avoid cluttering the logs
	private logEnabled = false;

	constructor() {
		try {
			// Check if the required host and writeKey configuration properties are present
			if (jitsu.serverHost && jitsu.serverWriteKey) {
				const jitsuConfig = {
					host: jitsu.serverHost,
					writeKey: jitsu.serverWriteKey,
					debug: jitsu.debug,
					echoEvents: jitsu.echoEvents,
				};
				this.logger.log(
					`JITSU Configuration`,
					chalk.magenta(JSON.stringify(jitsuConfig))
				);
				// Create an instance of Jitsu Analytics with configuration
				this.jitsuAnalytics = createJitsu(jitsuConfig);
			} else {
				console.error(
					chalk.yellow(
						`Jitsu Analytics initialization failed: Missing host or writeKey.`
					)
				);
			}
		} catch (error) {
			console.error(
				chalk.red(
					`Jitsu Analytics initialization failed: ${error.message}`
				)
			);
		}
	}

	/**
	 * Called after entity insertion.
	 */
	async afterInsert(event: InsertEvent<any>) {
		if (this.logEnabled)
			this.logger.log(
				`AFTER ENTITY INSERTED: `,
				JSON.stringify(event.entity)
			);

		// Track an event with Jitsu Analytics
		await this.analyticsTrack('afterInsert', {
			data: { ...event.entity },
		});
	}

	/**
	 * Called after entity update.
	 */
	async afterUpdate(event: UpdateEvent<any>) {
		if (this.logEnabled)
			this.logger.log(
				`AFTER ENTITY UPDATED: `,
				JSON.stringify(event.entity)
			);

		// Track an event with Jitsu Analytics
		await this.analyticsTrack('afterUpdate', {
			data: { ...event.entity },
		});
	}

	/**
	 * Called after entity removal.
	 */
	async afterRemove(event: RemoveEvent<any>) {
		if (this.logEnabled)
			this.logger.log(
				`AFTER ENTITY REMOVED: `,
				JSON.stringify(event.entity)
			);

		// Track an event with Jitsu Analytics
		await this.analyticsTrack('afterRemove', {
			data: { ...event.entity },
		});
	}

	/**
	 * Track an analytics event using Jitsu Analytics.
	 * @param event The name of the event to track.
	 * @param properties Additional event properties (optional).
	 * @returns A promise that resolves when the event is tracked.
	 */
	async analyticsTrack(
		event: string,
		properties?: Record<string, any> | null
	): Promise<void> {
		// Check if this.jitsu is defined and both host and writeKey are defined
		if (this.jitsuAnalytics) {
			try {
				if (this.logEnabled)
					this.logger.log(
						`Before Jitsu Tracking Entity Events: ${event}`,
						chalk.magenta(JSON.stringify(properties))
					);

				const tracked = await this.trackEvent(event, properties);

				if (this.logEnabled)
					this.logger.log(
						`After Jitsu Tracked Entity Events`,
						chalk.blue(JSON.stringify(tracked))
					);
			} catch (error) {
				this.logger.error(
					`Error while Jitsu tracking event. Unable to track event: ${error.message}`
				);
			}
		}
	}

	/**
	 * Track an event with optional properties.
	 * @param event The name of the event to track.
	 * @param properties Additional data or properties associated with the event.
	 * @returns A Promise that resolves when the event is tracked.
	 */
	async trackEvent(
		event: string,
		properties?: Record<string, any> | null
	): Promise<any> {
		return await this.jitsuAnalytics.track(event, properties);
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
		return await this.jitsuAnalytics.identify(id, traits);
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
		return await this.jitsuAnalytics.group(id, traits);
	}
}
