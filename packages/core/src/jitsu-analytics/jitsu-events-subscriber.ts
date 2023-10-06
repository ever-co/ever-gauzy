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
	private jitsuAnalytics: AnalyticsInterface;

	constructor() {
		try {
			// Check if the required host and writeKey configuration properties are present
			if (jitsu.serverHost && jitsu.serverWriteKey) {
				const jitsuConfig = {
					host: jitsu.serverHost,
					writeKey: jitsu.serverWriteKey,
					debug: jitsu.debug,
					echoEvents: jitsu.echoEvents
				};
				this.logger.log(`JITSU Configuration`, chalk.magenta(JSON.stringify(jitsuConfig)));
				// Create an instance of Jitsu Analytics with configuration
				this.jitsuAnalytics = createJitsu(jitsuConfig);
			} else {
				console.error(chalk.yellow(`Jitsu Analytics initialization failed: Missing host or writeKey.`));
			}
		} catch (error) {
			console.error(chalk.red(`Jitsu Analytics initialization failed: ${error.message}`));
		}
	}


	/**
	 * Called after entity insertion.
	 */
	async afterInsert(event: InsertEvent<any>) {
		this.logger.log(`AFTER ENTITY INSERTED: `, JSON.stringify(event.entity));

		// Track an event with Jitsu Analytics
		await this.analyticsTrack('afterInsert', {
			data: { ...event.entity },
		});
	}

	/**
	 * Called after entity update.
	 */
	async afterUpdate(event: UpdateEvent<any>) {
		this.logger.log(`AFTER ENTITY UPDATED: `, JSON.stringify(event.entity));

		// Track an event with Jitsu Analytics
		await this.analyticsTrack('afterUpdate', {
			data: { ...event.entity },
		});
	}

	/**
	 * Called after entity removal.
	 */
	async afterRemove(event: RemoveEvent<any>) {
		this.logger.log(`AFTER ENTITY REMOVED: `, JSON.stringify(event.entity));

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
	): Promise<any> {
		// Check if this.jitsu is defined and both host and writeKey are defined
		if (this.jitsuAnalytics) {
			try {
				console.log('------------------Jitsu Tracking Start------------------');
				this.logger.log(`Before Jitsu Tracking Entity Events`, chalk.magenta(JSON.stringify(properties)));
				const tracked = await this.jitsuAnalytics.track(event, properties);
				this.logger.log(`After Jitsu Tracked Entity Events`, chalk.blue(JSON.stringify(tracked)));
				console.log('------------------Jitsu Tracking Finished------------------');
			} catch (error) {
				this.logger.error(`Error while Jitsu tracking event. Unable to track event: ${error.message}`);
			}
		} else {
			// Handle it as needed (e.g., log or return a default result)
			this.logger.warn(`Jitsu tracking is not available. Unable to track event: ${event}`);
			return null; // or handle it differently based on your requirements
		}
	}
}
