import { Injectable, Logger } from '@nestjs/common';
import { JitsuAnalyticsService } from 'jitsu-analytics/jitsu-analytics.service';
import {
	DataSource,
	InsertEvent,
	RemoveEvent,
	EntitySubscriberInterface,
	UpdateEvent,
} from 'typeorm';

/* Global Entity Subscriber - Listens to all entity
inserts updates and removal then sends to Jitsu*/
@Injectable()
export class JitsuEventsSubscriber implements EntitySubscriberInterface {
	private logger = new Logger(JitsuEventsSubscriber.name);

	constructor(
		dataSource: DataSource,
		private jitsuAnalyticsService: JitsuAnalyticsService
	) {
		dataSource.subscribers.push(this);
	}

	/**
	 * Called after entity insertion.
	 */
	async afterInsert(event: InsertEvent<any>) {
		this.logger.log(`AFTER ENTITY INSERTED: `, event.entity);
		await this.jitsuAnalyticsService.track('afterInsert', {
			data: { ...event.entity },
		});
	}

	/**
	 * Called after entity update.
	 */
	async afterUpdate(event: UpdateEvent<any>) {
		this.logger.log(`AFTER ENTITY UPDATED: `, event.entity);
		await this.jitsuAnalyticsService.track('afterUpdate', {
			data: { ...event.entity },
		});
	}

	/**
	 * Called after entity removal.
	 */
	async afterRemove(event: RemoveEvent<any>) {
		this.logger.log(`AFTER ENTITY REMOVED: `, event.entity);
		await this.jitsuAnalyticsService.track('afterRemove', {
			data: { ...event.entity },
		});
	}
}
