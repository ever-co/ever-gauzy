import { EventSubscriber } from 'typeorm';
import { isJsObject } from '@gauzy/common';
import { isBetterSqlite3, isSqlite } from '@gauzy/config';
import { BaseEntityEventSubscriber } from '../core/entities/subscribers/base-entity-event.subscriber';
import { ActivityLog } from './activity-log.entity';

@EventSubscriber()
export class ActivityLogSubscriber extends BaseEntityEventSubscriber<ActivityLog> {
	/**
	 * Indicates that this subscriber only listen to ActivityLog events.
	 */
	listenTo() {
		return ActivityLog;
	}

	/**
	 * Called before an ActivityLog entity is inserted or created in the database.
	 * This method prepares the entity for insertion, particularly by serializing the data property to a JSON string
	 * for SQLite databases.
	 *
	 * @param entity The ActivityLog entity that is about to be created.
	 * @returns {Promise<void>} A promise that resolves when the pre-creation processing is complete.
	 */
	async beforeEntityCreate(entity: ActivityLog): Promise<void> {
		try {
			// Check if the database is SQLite and the entity's metaData is a JavaScript object
			if ((isSqlite() || isBetterSqlite3()) && isJsObject(entity.data)) {
				// ToDo: If need convert data to JSON before save
			}
		} catch (error) {
			// In case of error during JSON serialization, reset metaData to an empty object
			console.error('ActivityLogSubscriber: Error during the beforeEntityCreate process:', error);
		}
	}
}
