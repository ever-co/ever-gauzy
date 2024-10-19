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
	 * @description Serialize Activity Log fields to support SQLite DB before creation
	 * @param {ActivityLog} entity - The ActivityLog entity that is about to be created or updated.
	 * @param {string[]} fields - Array fields to be serialized
	 */
	private serializeFields(entity: ActivityLog, fields: string[]): void {
		fields.forEach((field) => {
			if (Array.isArray(entity[field]) || typeof entity[field] === 'object') {
				entity[field] = JSON.stringify(entity[field]);
			}
		});
	}

	/**
	 * @description de-serialize Activity Log fields to support SQLite DB after load data
	 * @param {ActivityLog} entity - The ActivityLog entity that is about to be loaded or updated.
	 * @param {string[]} fields - Array fields to be de-serialized
	 */
	private deserializeFields(entity: ActivityLog, fields: string[]): void {
		fields.forEach((field) => {
			if (entity[field] && typeof entity[field] === 'string') {
				entity[field] = JSON.parse(entity[field]);
			}
		});
	}

	/**
	 * Called before an ActivityLog entity is inserted or updated in the database.
	 * This method prepares the entity for insertion or update by serializing the data property to a JSON string
	 * for SQLite databases.
	 *
	 * @param entity The ActivityLog entity that is about to be created or updated.
	 * @returns {Promise<void>} A promise that resolves when the pre-creation or pre-update processing is complete.
	 */
	async serializeDataForSQLite(entity: ActivityLog): Promise<void> {
		try {
			// Check if the database is SQLite
			if (isSqlite() || isBetterSqlite3()) {
				// Serialize the `data` field if it's an object
				if (typeof entity.data === 'object') {
					entity.data = JSON.stringify(entity.data);
				}

				// Serialize `updatedValues`, `previousValues`, `updatedEntities`, `previousEntities` if they are arrays or objects
				this.serializeFields(entity, [
					'updatedValues',
					'previousValues',
					'updatedEntities',
					'previousEntities'
				]);
			}
		} catch (error) {
			// Log the error and reset the data to an empty object if JSON parsing fails
			console.error('Error stringify data in serializeDataForSQLite:', error);
			entity.data = '{}';
			['updatedValues', 'previousValues', 'updatedEntities', 'previousEntities'].forEach((field) => {
				entity[field] = '{}';
			});
		}
	}

	/**
	 * Called before an ActivityLog entity is inserted or created in the database.
	 * This method prepares the entity for insertion, particularly by serializing the data property to a JSON string
	 *
	 * @param entity The ActivityLog entity that is about to be created.
	 * @returns {Promise<void>} A promise that resolves when the pre-insertion processing is complete.
	 */
	async beforeEntityCreate(entity: ActivityLog): Promise<void> {
		await this.serializeDataForSQLite(entity);
	}

	/**
	 * Called before an ActivityLog entity is updated in the database.
	 * This method prepares the entity for update, particularly by serializing the data property to a JSON string
	 *
	 * @param entity The ActivityLog entity that is about to be updated.
	 * @returns {Promise<void>} A promise that resolves when the pre-update processing is complete.
	 */
	async beforeEntityUpdate(entity: ActivityLog): Promise<void> {
		await this.serializeDataForSQLite(entity);
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
			// Check if the database is SQLite
			if (isSqlite() || isBetterSqlite3()) {
				// Parse the `data` field if it's a string
				if (entity.data && typeof entity.data === 'string') {
					entity.data = JSON.parse(entity.data);
				}

				// Parse `updatedValues`, `previousValues`, `updatedEntities`, `previousEntities` if they are strings
				this.deserializeFields(entity, [
					'updatedValues',
					'previousValues',
					'updatedEntities',
					'previousEntities'
				]);
			}
		} catch (error) {
			// Log the error and reset the data to an empty object if JSON parsing fails
			console.error('Error parsing JSON data in afterEntityLoad:', error);
			entity.data = {};
			['updatedValues', 'previousValues', 'updatedEntities', 'previousEntities'].forEach((field) => {
				entity[field] = {};
			});
		}
	}
}
