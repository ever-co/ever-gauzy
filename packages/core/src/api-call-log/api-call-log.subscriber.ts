import { EventSubscriber } from 'typeorm';
import { BaseEntityEventSubscriber } from '../core/entities/subscribers/base-entity-event.subscriber';
import { MultiOrmEntityManager } from '../core/entities/subscribers/entity-event-subscriber.types';
import { ApiCallLog } from './api-call-log.entity';

@EventSubscriber()
export class ApiCallLogSubscriber extends BaseEntityEventSubscriber<ApiCallLog> {
	/**
	 * Indicates that this subscriber only listen to ApiCallLog events.
	 */
	listenTo() {
		return ApiCallLog;
	}

	/**
	 * Called before an ApiCallLog entity is inserted or created in the database.
	 * This method prepares the entity for insertion, particularly by serializing the data property to a JSON string
	 * for SQLite databases.
	 *
	 * @param entity The ApiCallLog entity that is about to be created.
	 * @returns {Promise<void>} A promise that resolves when the pre-creation processing is complete.
	 */
	async beforeEntityCreate(entity: ApiCallLog): Promise<void> {}

	/**
	 * Handles the parsing of JSON data after the ApiCallLog entity is loaded from the database.
	 * This function ensures that if the database is SQLite, the `data` field, stored as a JSON string,
	 * is parsed back into a JavaScript object.
	 *
	 * @param {ApiCallLog} entity - The ApiCallLog entity that has been loaded from the database.
	 * @param {MultiOrmEntityManager} [em] - The optional EntityManager instance, if provided.
	 * @returns {Promise<void>} A promise that resolves once the after-load processing is complete.
	 */
	async afterEntityLoad(entity: ApiCallLog, em?: MultiOrmEntityManager): Promise<void> {}
}
