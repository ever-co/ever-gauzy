import { EventSubscriber } from 'typeorm';
import { isBetterSqlite3, isSqlite } from '@gauzy/config';
import { BaseEntityEventSubscriber } from '../core/entities/subscribers/base-entity-event.subscriber';
import { MultiOrmEntityManager } from '../core/entities/subscribers/entity-event-subscriber.types';
import { Broadcast } from './broadcast.entity';

@EventSubscriber()
export class BroadcastSubscriber extends BaseEntityEventSubscriber<Broadcast> {
	/**
	 * Indicates that this subscriber only listen to Broadcast events.
	 */
	listenTo() {
		return Broadcast;
	}

	/**
	 * Serializes the content and audienceRules properties to a JSON string for SQLite databases.
	 *
	 * @param entity The Broadcast entity that is about to be serialized.
	 * @returns {Promise<void>} A promise that resolves when the serialization is complete.
	 */
	private async serializeJsonFieldsForSQLite(entity: Broadcast): Promise<void> {
		try {
			// Check if the database is SQLite
			if (isSqlite() || isBetterSqlite3()) {
				// Serialize the `content` field if it's an object
				if (entity.content && typeof entity.content === 'object') {
					entity.content = JSON.stringify(entity.content);
				}

				// Serialize the `audienceRules` field if it's an object
				if (entity.audienceRules && typeof entity.audienceRules === 'object') {
					entity.audienceRules = JSON.stringify(entity.audienceRules) as any;
				}
			}
		} catch (error) {
			console.error('BroadcastSubscriber: Error serializing JSON fields:', error);
			entity.content = '{}';
			entity.audienceRules = null;
		}
	}

	/**
	 * Called before a Broadcast entity is inserted or created in the database.
	 *
	 * @param entity The Broadcast entity that is about to be created.
	 * @returns {Promise<void>} A promise that resolves when the pre-creation processing is complete.
	 */
	async beforeEntityCreate(entity: Broadcast): Promise<void> {
		await this.serializeJsonFieldsForSQLite(entity);
	}

	/**
	 * Called before a Broadcast entity is updated in the database.
	 *
	 * @param entity The Broadcast entity that is about to be updated.
	 * @returns {Promise<void>} A promise that resolves when the pre-update processing is complete.
	 */
	async beforeEntityUpdate(entity: Broadcast, em?: MultiOrmEntityManager): Promise<void> {
		await this.serializeJsonFieldsForSQLite(entity);
	}

	/**
	 * Handles the parsing of JSON data after the Broadcast entity is loaded from the database.
	 *
	 * @param entity The Broadcast entity that has been loaded from the database.
	 * @param em The optional EntityManager instance, if provided.
	 * @returns {Promise<void>} A promise that resolves once the after-load processing is complete.
	 */
	async afterEntityLoad(entity: Broadcast, em?: MultiOrmEntityManager): Promise<void> {
		try {
			// Check if the database is SQLite
			if (isSqlite() || isBetterSqlite3()) {
				// Parse the `content` field if it's a string
				if (entity.content && typeof entity.content === 'string') {
					entity.content = JSON.parse(entity.content);
				}

				// Parse the `audienceRules` field if it's a string
				if (entity.audienceRules && typeof entity.audienceRules === 'string') {
					entity.audienceRules = JSON.parse(entity.audienceRules);
				}
			}
		} catch (error) {
			console.error('BroadcastSubscriber: Error parsing JSON fields:', error);
			entity.content = {};
			entity.audienceRules = null;
		}
	}
}
