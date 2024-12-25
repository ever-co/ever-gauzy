import { EventSubscriber } from 'typeorm';
import { isBetterSqlite3, isSqlite } from '@gauzy/config';
import { BaseEntityEventSubscriber } from '../core/entities/subscribers/base-entity-event.subscriber';
import { Dashboard } from './dashboard.entity';

@EventSubscriber()
export class DashboardSubscriber extends BaseEntityEventSubscriber<Dashboard> {
	listenTo() {
		return Dashboard;
	}

	/**
	 * Called before an Dashboard entity is inserted or updated in the database.
	 * This method prepares the entity for insertion or update by serializing the contentHtml property to a JSON string
	 * for SQLite databases.
	 *
	 * @param entity The Dashboard entity that is about to be created or updated.
	 * @returns {Promise<void>} A promise that resolves when the pre-creation or pre-update processing is complete.
	 */
	private async serializeContentForSQLite(entity: Dashboard): Promise<void> {
		try {
			// Check if the database is SQLite
			if (isSqlite() || isBetterSqlite3()) {
				// serialize the `contentHtml` field if it's an object
				if (typeof entity.contentHtml === 'object') {
					entity.contentHtml = JSON.stringify(entity.contentHtml);
				}
			}
		} catch (error) {
			// Log the error and reset the data to an empty object if JSON parsing fails
			console.error(error);
			entity.contentHtml = '{}';
		}
	}

	/**
	 * Called before an Dashboard entity is inserted or created in the database.
	 * This method prepares the entity for insertion by serializing the contentHtml property to a JSON string for SQLite DBs
	 *
	 * @param entity The Dashboard entity that is about to be created.
	 * @returns {Promise<void>} A promise that resolves when the pre-insertion processing is complete.
	 */
	async beforeEntityCreate(entity: Dashboard): Promise<void> {
		await this.serializeContentForSQLite(entity);
	}

	/**
	 * Called before an Dashboard entity is updated in the database.
	 * This method prepares the entity for update by serializing the contentHtml property to a JSON string
	 *
	 * @param entity The Dashboard entity that is about to be updated.
	 * @returns {Promise<void>} A promise that resolves when the pre-update processing is complete.
	 */
	async beforeEntityUpdate(entity: Dashboard): Promise<void> {
		await this.serializeContentForSQLite(entity);
	}

	/**
	 * Handles the parsing of JSON data after the Dashboard entity is loaded from the database.
	 * This function ensures that if the database is SQLite, the `contentHtml` field, stored as a JSON string,
	 * is parsed back into a JavaScript object.
	 *
	 * @param {Dashboard} entity - The Dashboard entity that has been loaded from the database.
	 * @returns {Promise<void>} A promise that resolves once the after-load processing is complete.
	 */
	async afterEntityLoad(entity: Dashboard): Promise<void> {
		try {
			// Check if the database is SQLite
			if (isSqlite() || isBetterSqlite3()) {
				// Parse the `contentHtml` field if it's a string
				if (entity.contentHtml && typeof entity.contentHtml === 'string') {
					entity.contentHtml = JSON.parse(entity.contentHtml);
				}
			}
		} catch (error) {
			// Log the error and reset the data to an empty object if JSON parsing fails
			console.error(error);
			entity.contentHtml = {};
		}
	}
}
