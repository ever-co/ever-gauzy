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
	 * This method prepares the entity for insertion by (1) guaranteeing `recordedAt` holds a valid
	 * timestamp and (2) serializing the metaData property to a JSON string for SQLite databases.
	 *
	 * @param entity The Activity entity that is about to be created.
	 * @returns {Promise<void>} A promise that resolves when the pre-creation processing is complete.
	 */
	async beforeEntityCreate(entity: Activity): Promise<void> {
		this.ensureRecordedAt(entity);

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

	/**
	 * Called before an Activity entity is updated. Guarantees `recordedAt` here too, since a bulk
	 * `save` of an entity that carries an existing id follows the update path (which does not fire
	 * `beforeEntityCreate`).
	 *
	 * @param entity The Activity entity that is about to be updated.
	 */
	async beforeEntityUpdate(entity: Activity): Promise<void> {
		this.ensureRecordedAt(entity);
	}

	/**
	 * Guarantees `entity.recordedAt` is a VALID timestamp regardless of the write path (bulk save,
	 * single create, imports) or source. Reports/statistics filter on `recordedAt`, and a NULL or
	 * `Invalid Date` value makes the row invisible to the time-range query (or fails on persist).
	 * Prefer a valid explicit value, else derive it from the activity's date + time, else fall back
	 * to the current time.
	 *
	 * @param entity The Activity entity being persisted.
	 */
	private ensureRecordedAt(entity: Activity): void {
		const isValidDate = (value: unknown): boolean => value != null && !isNaN(new Date(value as any).getTime());

		// Keep a valid explicitly-supplied value as-is.
		if (isValidDate(entity.recordedAt)) {
			return;
		}

		// Otherwise derive from date + time, guarding against a malformed `Invalid Date`.
		const derived = entity.date && entity.time ? new Date(`${entity.date}T${entity.time}`) : null;
		entity.recordedAt = isValidDate(derived) ? (derived as Date) : new Date();
	}
}
