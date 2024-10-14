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
			// Check if the database is SQLite and ensure that requestHeaders, requestBody, and responseBody are strings
			if (isSqlite() || isBetterSqlite3()) {
				['requestHeaders', 'requestBody', 'responseBody'].forEach((field) => {
					try {
						if (typeof entity[field] === 'object') {
							entity[field] = JSON.stringify(entity[field]); // Convert to JSON string
						}
					} catch (error) {
						console.error(`Failed to stringify ${field}:`, error);
						entity[field] = '{}'; // Set to an empty JSON object string in case of an error
					}
				});
			}
		} catch (error) {
			// In case of error during JSON serialization, reset metaData to an empty object
			this.logger.error('Error parsing JSON data in beforeEntityCreate:', error);
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
			// Check if the database is SQLite and attempt to parse JSON fields
			if (isSqlite() || isBetterSqlite3()) {
				['requestHeaders', 'requestBody', 'responseBody'].forEach((field) => {
					if (entity[field] && typeof entity[field] === 'string') {
						try {
							entity[field] = JSON.parse(entity[field]);
						} catch (error) {
							console.error(`Failed to parse ${field}:`, error);
							entity[field] = {}; // Set to an empty object in case of a parsing error
						}
					}
				});
			}
		} catch (error) {
			// Log the error and reset the data to an empty object if JSON parsing fails
			this.logger.error('Error parsing JSON data in afterEntityLoad:', error);
		}
	}
}
