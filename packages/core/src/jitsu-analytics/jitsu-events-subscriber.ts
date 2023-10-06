import { AnalyticsInterface } from '@jitsu/js';
import { Logger } from '@nestjs/common';
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

	// Create an instance of Jitsu Analytics with configuration
	private readonly jitsuAnalytics: AnalyticsInterface = createJitsu({
		host: jitsu.serverHost,
		writeKey: jitsu.serverWriteKey,
		debug: false,
		echoEvents: false
	});

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
				this.logger.log(`Jitsu Tracking Entity Events`, JSON.stringify(properties));
				const tracked = await this.jitsuAnalytics.track(event, properties);
				this.logger.log(`Jitsu Tracked Entity Events`, JSON.stringify(tracked));
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
