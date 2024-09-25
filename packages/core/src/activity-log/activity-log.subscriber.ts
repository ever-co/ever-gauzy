import { EventSubscriber } from 'typeorm';
import { isBetterSqlite3, isSqlite } from '@gauzy/config';
import { BaseEntityEventSubscriber } from '../core/entities/subscribers/base-entity-event.subscriber';
import { MultiOrmEntityManager } from '../core/entities/subscribers/entity-event-subscriber.types';
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
			if (isSqlite() || isBetterSqlite3()) {
				// ToDo: If need convert data to JSON before save
				entity.data = JSON.stringify(entity.data);
			}
		} catch (error) {
			// In case of error during JSON serialization, reset metaData to an empty object
			entity.data = JSON.stringify({});
		}
	}

	/**
	 * Handles the parsing of JSON data after the ActivityLog entity is loaded from the database.
	 * This function ensures that if the database is SQLite, the `data` field, stored as a JSON string,
	 * is parsed back into a JavaScript object.
	 *
	 * @param {ActivityLog} entity - The ActivityLog entity that has been loaded from the database.
	 * @param {MultiOrmEntityManager} [em] - The optional EntityManager instance, if provided.
	 * @returns {Promise<void>} A promise that resolves once the after-load processing is complete.
	 */
	async afterEntityLoad(entity: ActivityLog, em?: MultiOrmEntityManager): Promise<void> {
		try {
			// Check if the database is SQLite and if `data` is a non-null string
			if ((isSqlite() || isBetterSqlite3()) && entity.data && typeof entity.data === 'string') {
				entity.data = JSON.parse(entity.data);
			}
		} catch (error) {
			// Log the error and reset the data to an empty object if JSON parsing fails
			console.error('Error parsing JSON data in afterEntityLoad:', error);
			entity.data = {};
		}
	}
}
