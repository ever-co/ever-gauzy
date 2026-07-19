import { EventSubscriber } from 'typeorm';
import { isObject } from '@gauzy/utils';
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
	 * This method prepares the entity for insertion by (1) guaranteeing `recordedAt` is populated
	 * and (2) serializing the metaData property to a JSON string for SQLite databases.
	 *
	 * @param entity The Activity entity that is about to be created.
	 * @returns {Promise<void>} A promise that resolves when the pre-creation processing is complete.
	 */
	async beforeEntityCreate(entity: Activity): Promise<void> {
		// Guarantee `recordedAt` is always set to a VALID timestamp, regardless of the write path
		// (bulk save, single create, or third-party imports). Reports/statistics filter on
		// `recordedAt`, and a NULL value makes the row invisible to the time-range query. Prefer an
		// explicit value, else derive it from the activity's date + time, else fall back to now.
		if (!entity.recordedAt) {
			const derived = entity.date && entity.time ? new Date(`${entity.date}T${entity.time}`) : null;
			// Guard against malformed date/time producing an `Invalid Date`, which would fail on insert.
			entity.recordedAt = derived && !isNaN(derived.getTime()) ? derived : new Date();
		}

		try {
			// Check if the database is SQLite and the entity's metaData is a JavaScript object
			if ((isSqlite() || isBetterSqlite3()) && isObject(entity.metaData)) {
				entity.metaData = JSON.stringify(entity.metaData);
			}
		} catch (error) {
			// In case of error during JSON serialization, reset metaData to an empty object
			entity.metaData = JSON.stringify({});
			console.error('ActivitySubscriber: Error during the beforeEntityCreate process:', error);
		}
	}
}
