import { EventSubscriber } from 'typeorm';
import { IDBConnectionOptions } from '@gauzy/common';
import { getConfig } from '@gauzy/config';
import { isObject } from '@gauzy/utils';
import { BaseEntityEventSubscriber } from '../../core/entities/subscribers/base-entity-event.subscriber';
import { Screenshot } from './screenshot.entity';
import { FileStorage } from './../../core/file-storage';
import { isSqliteDB } from './../../core/utils';
import {
	MikroOrmEntityManager,
	MultiOrmEntityManager,
	TypeOrmEntityManager
} from '../../core/entities/subscribers/entity-event-subscriber.types';

@EventSubscriber()
export class ScreenshotSubscriber extends BaseEntityEventSubscriber<Screenshot> {
	/**
	 * Indicates that this subscriber only listen to Screenshot events.
	 */
	listenTo() {
		return Screenshot;
	}

	/**
	 * Called before a Screenshot entity is created in the database.
	 * This method prepares the entity for creation, including handling database-specific logic such as converting certain properties to JSON
	 * strings for SQLite databases when using TypeORM.
	 *
	 * @param entity The Screenshot entity about to be created.
	 * @param em An optional entity manager which can be either from TypeORM or MikroORM. Used for additional database operations if necessary.
	 * @returns {Promise<void>} A promise that resolves when the pre-creation processing is complete.
	 */
	async beforeEntityCreate(entity: Screenshot, em?: MultiOrmEntityManager): Promise<void> {
		try {
			if (!(entity instanceof Screenshot)) {
				return; // Early exit if the entity is not a Screenshot
			}
			// Handle TypeORM specific logic
			if (em instanceof TypeOrmEntityManager) {
				const options: Partial<IDBConnectionOptions> = em.connection.options || getConfig().dbConnectionOptions;

				// If the database is SQLite and the entity has an 'apps' property, convert it to a JSON string
				if (isSqliteDB(options) && isObject(entity.apps)) {
					try {
						entity.apps = JSON.stringify(entity.apps);
					} catch (error) {
						// Handle the error appropriately, set a default value or take another action.
						entity.apps = JSON.stringify([]);
					}
				}
			}
			// Handle MikroORM specific logic
			else if (em instanceof MikroOrmEntityManager) {
				// Placeholder for any MikroORM-specific logic, if needed
				console.log(em.getConnection());
			}
		} catch (error) {
			console.error(
				'ScreenshotSubscriber: An error occurred during the beforeEntityCreate process:',
				error.message
			);
		}
	}

	/**
	 * Called before a Screenshot entity is updated in the database.
	 * This method prepares the entity for update, including converting certain properties to JSON strings for specific database types.
	 *
	 * @param entity The Screenshot entity about to be updated.
	 * @param em An optional entity manager which can be either from TypeORM or MikroORM. Used for additional database operations if necessary.
	 * @returns {Promise<void>} A promise that resolves when the pre-update processing is complete.
	 */
	async beforeEntityUpdate(entity: Screenshot, em?: MultiOrmEntityManager): Promise<void> {
		try {
			if (!(entity instanceof Screenshot)) {
				return; // Early exit if the entity is not a Screenshot
			}
			// Handle TypeORM specific logic
			if (em instanceof TypeOrmEntityManager) {
				const options: Partial<IDBConnectionOptions> = em.connection.options || getConfig().dbConnectionOptions;

				// If the database is SQLite and the entity has an 'apps' property, convert it to a JSON string
				if (isSqliteDB(options) && isObject(entity.apps)) {
					try {
						entity.apps = JSON.stringify(entity.apps);
					} catch (error) {
						// Handle the error appropriately, set a default value or take another action.
						entity.apps = JSON.stringify([]);
					}
				}
			}
			// Handle MikroORM specific logic
			else if (em instanceof MikroOrmEntityManager) {
				// Placeholder for any MikroORM-specific logic, if needed
				console.log(em.getConnection());
			}
		} catch (error) {
			console.error(
				'ScreenshotSubscriber: An error occurred during the beforeEntityUpdate process:',
				error.message
			);
		}
	}

	/**
	 * Called after a Screenshot entity is loaded from the database. This method performs additional
	 * processing such as retrieving file URLs from a storage provider and handling specific data formats based on the database type.
	 *
	 * @param entity The loaded Screenshot entity.
	 * @param em An optional entity manager which can be either from TypeORM or MikroORM. Used for additional database operations if necessary.
	 * @returns {Promise<void>} A promise that resolves when the additional processing is complete.
	 */
	async afterEntityLoad(entity: Screenshot, em?: MultiOrmEntityManager): Promise<void> {
		try {
			if (!(entity instanceof Screenshot)) {
				return; // Early exit if the entity is not a Screenshot
			}

			// Handle TypeORM specific logic
			if (em instanceof TypeOrmEntityManager) {
				const { storageProvider, file, thumb, apps } = entity;
				const instance = new FileStorage().setProvider(storageProvider).getProviderInstance();

				// Retrieve URLs concurrently
				const [fullUrl, thumbUrl] = await Promise.all([instance.url(file), instance.url(thumb)]);
				entity.fullUrl = fullUrl;
				entity.thumbUrl = thumbUrl;

				// Additional logic for specific database types
				const options: Partial<IDBConnectionOptions> = em.connection.options || getConfig().dbConnectionOptions;

				// If the database is SQLite and the entity has an 'apps' property, convert it to a JSON string
				if (isSqliteDB(options) && typeof apps === 'string') {
					try {
						entity.apps = JSON.parse(apps);
					} catch (error) {
						console.error(
							'ScreenshotSubscriber: JSON parse error during the afterEntityLoad process:',
							error
						);
						entity.apps = [];
					}
				}
			}
			// Handle MikroORM specific logic
			else if (em instanceof MikroOrmEntityManager) {
				// Placeholder for any MikroORM-specific logic, if needed
			}
		} catch (error) {
			console.error('ScreenshotSubscriber: An error occurred during the afterEntityLoad process:', error.message);
		}
	}

	/**
	 * Called after a Screenshot entity is deleted from the database.
	 * This method handles the deletion of associated files (both the main file and its thumbnail) from the storage system.
	 *
	 * @param entity The Screenshot entity that was deleted.
	 * @returns {Promise<void>} A promise that resolves when the file deletion operations are complete.
	 */
	async afterEntityDelete(entity: Screenshot): Promise<void> {
		try {
			if (!(entity instanceof Screenshot)) {
				return; // Early exit if the entity is not a Screenshot
			}
			const { id: entityId, storageProvider, file, thumb } = entity;
			console.log(`AFTER SCREENSHOT ENTITY WITH ID ${entityId} REMOVED`);
			console.log('ScreenshotSubscriber: Deleting files...', file, thumb);

			// Initialize the file storage instance with the provided storage provider.
			const instance = new FileStorage().setProvider(storageProvider).getProviderInstance();
			console.log('ScreenshotSubscriber: Instance initialized', instance);

			// Deleting both the main file and the thumbnail, if they exist.
			await Promise.all([file && instance.deleteFile(file), thumb && instance.deleteFile(thumb)]);
		} catch (error) {
			console.error(`ScreenshotSubscriber: Error deleting files for entity ID ${entity?.id}:`, error.message);
		}
	}

	/**
	 * Called after entity is soft removed from the database.
	 * This method handles the removal of associated files (both the main file and its thumbnail) from the storage system.
	 *
	 * @param entity The entity that was soft removed.
	 * @returns {Promise<void>} A promise that resolves when the file soft removal operations are complete.
	 */
	async afterEntitySoftRemove(entity: Screenshot): Promise<void> {
		try {
			if (!(entity instanceof Screenshot)) {
				return; // Early exit if the entity is not a Screenshot
			}
			const { id: entityId, file, thumb } = entity;
			console.log(`AFTER SCREENSHOT ENTITY WITH ID ${entityId} SOFT REMOVED`);
			console.log('ScreenshotSubscriber: Soft removing files...', file, thumb);
		} catch (error) {
			console.error(`ScreenshotSubscriber: Error soft removing entity ID ${entity?.id}:`, error.message);
		}
	}
}
