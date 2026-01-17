import { EventSubscriber } from 'typeorm';
import { isBetterSqlite3, isSqlite } from '@gauzy/config';
import { BaseEntityEventSubscriber } from '../core/entities/subscribers/base-entity-event.subscriber';
import { MultiOrmEntityManager } from '../core/entities/subscribers/entity-event-subscriber.types';
import { OrganizationStrategicInitiative } from './organization-strategic-initiative.entity';

@EventSubscriber()
export class OrganizationStrategicInitiativeSubscriber extends BaseEntityEventSubscriber<OrganizationStrategicInitiative> {
	/**
	 * Indicates that this subscriber only listens to OrganizationStrategicInitiative events.
	 */
	listenTo() {
		return OrganizationStrategicInitiative;
	}

	/**
	 * Serializes the signals property to a JSON string for SQLite databases.
	 *
	 * @param entity The OrganizationStrategicInitiative entity that is about to be serialized.
	 * @returns {Promise<void>} A promise that resolves when the serialization is complete.
	 */
	private async serializeJsonFieldsForSQLite(entity: OrganizationStrategicInitiative): Promise<void> {
		// Check if the database is SQLite
		if (isSqlite() || isBetterSqlite3()) {
			// Serialize the `signals` field if it's an object
			if (entity.signals && typeof entity.signals === 'object') {
				try {
					entity.signals = JSON.stringify(entity.signals);
				} catch (error) {
					console.error(
						'OrganizationStrategicInitiativeSubscriber: Error serializing signals:',
						error.message
					);
					// Set to null if serialization fails
					entity.signals = null;
				}
			}
		}
	}

	/**
	 * Called before an OrganizationStrategicInitiative entity is inserted or created in the database.
	 *
	 * @param entity The OrganizationStrategicInitiative entity that is about to be created.
	 * @returns {Promise<void>} A promise that resolves when the pre-creation processing is complete.
	 */
	async beforeEntityCreate(entity: OrganizationStrategicInitiative): Promise<void> {
		await this.serializeJsonFieldsForSQLite(entity);
	}

	/**
	 * Called before an OrganizationStrategicInitiative entity is updated in the database.
	 *
	 * @param entity The OrganizationStrategicInitiative entity that is about to be updated.
	 * @returns {Promise<void>} A promise that resolves when the pre-update processing is complete.
	 */
	async beforeEntityUpdate(entity: OrganizationStrategicInitiative, em?: MultiOrmEntityManager): Promise<void> {
		await this.serializeJsonFieldsForSQLite(entity);
	}

	/**
	 * Handles the parsing of JSON data after the OrganizationStrategicInitiative entity is loaded from the database.
	 *
	 * @param entity The OrganizationStrategicInitiative entity that has been loaded from the database.
	 * @param em The optional EntityManager instance, if provided.
	 * @returns {Promise<void>} A promise that resolves once the after-load processing is complete.
	 */
	async afterEntityLoad(entity: OrganizationStrategicInitiative, em?: MultiOrmEntityManager): Promise<void> {
		// Check if the database is SQLite
		if (isSqlite() || isBetterSqlite3()) {
			// Parse the `signals` field if it's a string
			if (entity.signals && typeof entity.signals === 'string') {
				try {
					entity.signals = JSON.parse(entity.signals);
				} catch (error) {
					// If parsing fails, set to null as signals should be a valid object or null
					console.error(
						'OrganizationStrategicInitiativeSubscriber: Error parsing signals JSON:',
						error.message
					);
					entity.signals = null;
				}
			}
		}
	}
}
