import { EventSubscriber } from 'typeorm';
import { isBetterSqlite3, isSqlite } from '@gauzy/config';
import { BaseEntityEventSubscriber } from '../core/entities/subscribers/base-entity-event.subscriber';
import { MultiOrmEntityManager } from '../core/entities/subscribers/entity-event-subscriber.types';
import { ResourceLink } from './resource-link.entity';

@EventSubscriber()
export class ResourceLinkSubscriber extends BaseEntityEventSubscriber<ResourceLink> {
	/**
	 * Indicates that this subscriber only listen to ResourceLink events.
	 */
	listenTo() {
		return ResourceLink;
	}

	/**
	 * Called before an ResourceLink entity is inserted or created in the database.
	 * This method prepares the entity for insertion, particularly by serializing the metaData property to a JSON string
	 * for SQLite databases.
	 *
	 * @param entity The ResourceLink entity that is about to be created.
	 * @returns {Promise<void>} A promise that resolves when the pre-creation processing is complete.
	 */
	async beforeEntityCreate(entity: ResourceLink): Promise<void> {
		try {
			// Check if the database is SQLite and the entity's metaData is a JavaScript object
			if (isSqlite() || isBetterSqlite3()) {
				entity.metaData = JSON.stringify(entity.metaData);
			}
		} catch (error) {
			// In case of error during JSON serialization, reset metaData to an empty object
			entity.metaData = JSON.stringify({});
		}
	}

	/**
	 * Handles the parsing of JSON data after the ResourceLink entity is loaded from the database.
	 * This function ensures that if the database is SQLite, the `metaData` field, stored as a JSON string,
	 * is parsed back into a JavaScript object.
	 *
	 * @param {ResourceLink} entity - The ResourceLink entity that has been loaded from the database.
	 * @param {MultiOrmEntityManager} [em] - The optional EntityManager instance, if provided.
	 * @returns {Promise<void>} A promise that resolves once the after-load processing is complete.
	 */
	async afterEntityLoad(entity: ResourceLink, em?: MultiOrmEntityManager): Promise<void> {
		try {
			// Check if the database is SQLite and if `metaData` is a non-null string
			if ((isSqlite() || isBetterSqlite3()) && entity.metaData && typeof entity.metaData === 'string') {
				entity.metaData = JSON.parse(entity.metaData);
			}
		} catch (error) {
			// Log the error and reset the data to an empty object if JSON parsing fails
			console.error('Error parsing JSON data in afterEntityLoad:', error);
			entity.metaData = {};
		}
	}
}
