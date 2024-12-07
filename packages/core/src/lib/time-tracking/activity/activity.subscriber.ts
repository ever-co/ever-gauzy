import { EventSubscriber } from 'typeorm';
import { isJsObject } from '@gauzy/common';
import { isBetterSqlite3, isSqlite } from '@gauzy/config';
import { BaseEntityEventSubscriber } from '../../core/entities/subscribers/base-entity-event.subscriber';
import { Activity } from './activity.entity';

@EventSubscriber()
export class ActivitySubscriber extends BaseEntityEventSubscriber<Activity> {
	/**
	 * Indicates that this subscriber only listen to Activity events.
	 */
	listenTo() {
		return Activity;
	}

	/**
	 * Called before an Activity entity is inserted or created in the database.
	 * This method prepares the entity for insertion, particularly by serializing the metaData property to a JSON string
	 * for SQLite databases.
	 *
	 * @param entity The Activity entity that is about to be created.
	 * @returns {Promise<void>} A promise that resolves when the pre-creation processing is complete.
	 */
	async beforeEntityCreate(entity: Activity): Promise<void> {
		try {
			// Check if the database is SQLite and the entity's metaData is a JavaScript object
			if ((isSqlite() || isBetterSqlite3()) && isJsObject(entity.metaData)) {
				entity.metaData = JSON.stringify(entity.metaData);
			}
		} catch (error) {
			// In case of error during JSON serialization, reset metaData to an empty object
			entity.metaData = JSON.stringify({});
			console.error('ActivitySubscriber: Error during the beforeEntityCreate process:', error);
		}
	}
}
