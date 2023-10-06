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
		await this.jitsuAnalytics.track('afterInsert', {
			data: { ...event.entity },
		});
	}

	/**
	 * Called after entity update.
	 */
	async afterUpdate(event: UpdateEvent<any>) {
		this.logger.log(`AFTER ENTITY UPDATED: `, JSON.stringify(event.entity));

		// Track an event with Jitsu Analytics
		await this.jitsuAnalytics.track('afterUpdate', {
			data: { ...event.entity },
		});
	}

	/**
	 * Called after entity removal.
	 */
	async afterRemove(event: RemoveEvent<any>) {
		this.logger.log(`AFTER ENTITY REMOVED: `, JSON.stringify(event.entity));

		// Track an event with Jitsu Analytics
		await this.jitsuAnalytics.track('afterRemove', {
			data: { ...event.entity },
		});
	}
}
