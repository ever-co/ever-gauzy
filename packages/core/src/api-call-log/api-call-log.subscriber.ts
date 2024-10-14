import { Logger } from '@nestjs/common';
import { EventSubscriber } from 'typeorm';
import { isBetterSqlite3, isSqlite } from '@gauzy/config';
import { BaseEntityEventSubscriber } from '../core/entities/subscribers/base-entity-event.subscriber';
import { MultiOrmEntityManager } from '../core/entities/subscribers/entity-event-subscriber.types';
import { ApiCallLog } from './api-call-log.entity';

@EventSubscriber()
export class ApiCallLogSubscriber extends BaseEntityEventSubscriber<ApiCallLog> {
	private readonly logger = new Logger(ApiCallLogSubscriber.name);

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
	async beforeEntityCreate(entity: ApiCallLog): Promise<void> {
		try {
			// Check if the database is SQLite and the entity's metaData is a JavaScript object
			if (isSqlite() || isBetterSqlite3()) {
				entity.requestHeaders = JSON.stringify(entity.requestHeaders);
				entity.requestBody = JSON.stringify(entity.requestBody);
				entity.responseBody = JSON.stringify(entity.responseBody);
			}
		} catch (error) {
			// In case of error during JSON serialization, reset metaData to an empty object
			this.logger.log('Error parsing JSON data in beforeEntityCreate:', error);
		}
	}

	/**
	 * Handles the parsing of JSON data after the ApiCallLog entity is loaded from the database.
	 * This function ensures that if the database is SQLite, the `data` field, stored as a JSON string,
	 * is parsed back into a JavaScript object.
	 *
	 * @param {ApiCallLog} entity - The ApiCallLog entity that has been loaded from the database.
	 * @param {MultiOrmEntityManager} [em] - The optional EntityManager instance, if provided.
	 * @returns {Promise<void>} A promise that resolves once the after-load processing is complete.
	 */
	async afterEntityLoad(entity: ApiCallLog, em?: MultiOrmEntityManager): Promise<void> {
		try {
			console.log('Parsing JSON data in afterEntityLoad: %s', entity);
			// Check if the database is SQLite and attempt to parse JSON fields
			if (isSqlite() || isBetterSqlite3()) {
				if (entity.requestHeaders && typeof entity.requestHeaders === 'string') {
					entity.requestHeaders = JSON.parse(entity.requestHeaders);
				}
				if (entity.requestBody && typeof entity.requestBody === 'string') {
					entity.requestBody = JSON.parse(entity.requestBody);
				}
				if (entity.responseBody && typeof entity.responseBody === 'string') {
					entity.responseBody = JSON.parse(entity.responseBody);
				}
			}
		} catch (error) {
			// Log the error and reset the data to an empty object if JSON parsing fails
			this.logger.log('Error parsing JSON data in afterEntityLoad:', error);
		}
	}
}
