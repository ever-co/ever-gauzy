import { EventSubscriber } from 'typeorm';
import { isBetterSqlite3, isSqlite } from '@gauzy/config';
import { BaseEntityEventSubscriber } from '../core/entities/subscribers/base-entity-event.subscriber';
import { EmployeeNotificationSetting } from './employee-notification-setting.entity';

@EventSubscriber()
export class EmployeeNotificationSettingSubscriber extends BaseEntityEventSubscriber<EmployeeNotificationSetting> {
	/**
	 * Indicates that this subscriber only listen to EmployeeNotificationSetting events.
	 */
	listenTo() {
		return EmployeeNotificationSetting;
	}

	/**
	 * Called before an EmployeeNotificationSetting entity is inserted or updated in the database.
	 * This method prepares the entity for insertion or update by serializing the preferences property to a JSON string
	 * for SQLite databases.
	 *
	 * @param entity The EmployeeNotificationSetting entity that is about to be created or updated.
	 * @returns {Promise<void>} A promise that resolves when the pre-creation or pre-update processing is complete.
	 */
	private async serializePreferencesForSQLite(entity: EmployeeNotificationSetting): Promise<void> {
		try {
			// Check if the database is SQLite
			if (isSqlite() || isBetterSqlite3()) {
				// serialize the `preferences` field if it's an object
				if (typeof entity.preferences === 'object') {
					entity.preferences = JSON.stringify(entity.preferences);
				}
			}
		} catch (error) {
			// Log the error and reset the data to an empty object if JSON parsing fails
			console.error(error);
			entity.preferences = '{}';
		}
	}

	/**
	 * Called before an EmployeeNotificationSetting entity is inserted or created in the database.
	 * This method prepares the entity for insertion by serializing the preferences property to a JSON string for SQLite DBs
	 *
	 * @param entity The EmployeeNotificationSetting entity that is about to be created.
	 * @returns {Promise<void>} A promise that resolves when the pre-insertion processing is complete.
	 */
	async beforeEntityCreate(entity: EmployeeNotificationSetting): Promise<void> {
		await this.serializePreferencesForSQLite(entity);
	}

	/**
	 * Called before an EmployeeNotificationSetting entity is updated in the database.
	 * This method prepares the entity for update by serializing the preferences property to a JSON string
	 *
	 * @param entity The EmployeeNotificationSetting entity that is about to be updated.
	 * @returns {Promise<void>} A promise that resolves when the pre-update processing is complete.
	 */
	async beforeEntityUpdate(entity: EmployeeNotificationSetting): Promise<void> {
		await this.serializePreferencesForSQLite(entity);
	}

	/**
	 * Handles the parsing of JSON data after the EmployeeNotificationSetting entity is loaded from the database.
	 * This function ensures that if the database is SQLite, the `preferences` field, stored as a JSON string,
	 * is parsed back into a JavaScript object.
	 *
	 * @param {EmployeeNotificationSetting} entity - The EmployeeNotificationSetting entity that has been loaded from the database.
	 * @returns {Promise<void>} A promise that resolves once the after-load processing is complete.
	 */
	async afterEntityLoad(entity: EmployeeNotificationSetting): Promise<void> {
		try {
			// Check if the database is SQLite
			if (isSqlite() || isBetterSqlite3()) {
				// Parse the `preferences` field if it's a string
				if (entity.preferences && typeof entity.preferences === 'string') {
					entity.preferences = JSON.parse(entity.preferences);
				}
			}
		} catch (error) {
			// Log the error and reset the data to an empty object if JSON parsing fails
			console.error('Error parsing JSON data in afterEntityLoad:', error);
			entity.preferences = {};
		}
	}
}
