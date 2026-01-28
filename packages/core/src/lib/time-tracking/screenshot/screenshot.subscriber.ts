import { EventSubscriber } from 'typeorm';
import { IDBConnectionOptions } from '@gauzy/common';
import { getConfig } from '@gauzy/config';
import { isObject } from '@gauzy/utils';
import { BaseEntityEventSubscriber } from '../../core/entities/subscribers/base-entity-event.subscriber';
import { Screenshot } from './screenshot.entity';
import { FileStorage } from './../../core/file-storage';
import { getORMType, isSqliteDB, MultiORM, MultiORMEnum } from './../../core/utils';
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
	 * Gets database connection options based on the entity manager type.
	 *
	 * @param em The entity manager (TypeORM or MikroORM)
	 * @returns The database connection options
	 */
	private getDbOptions(em?: MultiOrmEntityManager): Partial<IDBConnectionOptions> {
		if (em instanceof TypeOrmEntityManager) {
			return em.connection?.options || getConfig().dbConnectionOptions;
		}
		return getConfig().dbMikroOrmConnectionOptions;
	}

	/**
	 * Validates the entity manager matches the expected ORM type.
	 *
	 * @param em The entity manager to validate
	 * @param ormType The expected ORM type
	 * @returns True if the entity manager matches the expected ORM type
	 */
	private isValidEntityManager(em: MultiOrmEntityManager | undefined, ormType: MultiORM): boolean {
		if (!em) return false;

		switch (ormType) {
			case MultiORMEnum.TypeORM:
				return em instanceof TypeOrmEntityManager;
			case MultiORMEnum.MikroORM:
				return em instanceof MikroOrmEntityManager;
			default:
				return false;
		}
	}

	/**
	 * Converts the apps property to a JSON string for SQLite databases.
	 *
	 * @param entity The Screenshot entity
	 * @param options The database connection options
	 */
	private stringifyAppsForSqlite(entity: Screenshot, options: Partial<IDBConnectionOptions>): void {
		if (isSqliteDB(options) && isObject(entity.apps)) {
			try {
				entity.apps = JSON.stringify(entity.apps);
			} catch (error) {
				// Handle the error appropriately, set a default value
				entity.apps = JSON.stringify([]);
			}
		}
	}

	/**
	 * Parses the apps property from a JSON string for SQLite databases.
	 *
	 * @param entity The Screenshot entity
	 * @param options The database connection options
	 */
	private parseAppsForSqlite(entity: Screenshot, options: Partial<IDBConnectionOptions>): void {
		if (isSqliteDB(options) && typeof entity.apps === 'string') {
			try {
				entity.apps = JSON.parse(entity.apps);
			} catch (error) {
				console.error('ScreenshotSubscriber: JSON parse error while parsing apps:', error);
				entity.apps = [];
			}
		}
	}

	/**
	 * Populates the fullUrl and thumbUrl properties from storage.
	 *
	 * @param entity The Screenshot entity
	 */
	private async populateFileUrls(entity: Screenshot): Promise<void> {
		const { storageProvider, file, thumb } = entity;
		const instance = new FileStorage().setProvider(storageProvider).getProviderInstance();

		// Retrieve URLs concurrently
		const [fullUrl, thumbUrl] = await Promise.all([instance.url(file), instance.url(thumb)]);
		entity.fullUrl = fullUrl;
		entity.thumbUrl = thumbUrl;
	}

	/**
	 * Called before a Screenshot entity is created in the database.
	 * This method prepares the entity for creation, including handling database-specific logic such as converting certain properties to JSON
	 * strings for SQLite databases.
	 *
	 * @param entity The Screenshot entity about to be created.
	 * @param em An optional entity manager which can be either from TypeORM or MikroORM.
	 * @returns {Promise<void>} A promise that resolves when the pre-creation processing is complete.
	 */
	async beforeEntityCreate(entity: Screenshot, em?: MultiOrmEntityManager): Promise<void> {
		try {
			if (!(entity instanceof Screenshot)) {
				return; // Early exit if the entity is not a Screenshot
			}

			// Get ORM type dynamically at runtime to ensure correct environment selection
			const ormType = getORMType();

			// Validate entity manager matches the ORM type
			if (!this.isValidEntityManager(em, ormType)) {
				return;
			}

			// Get database options and stringify apps for SQLite
			const options = this.getDbOptions(em);
			this.stringifyAppsForSqlite(entity, options);
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
	 * @param em An optional entity manager which can be either from TypeORM or MikroORM.
	 * @returns {Promise<void>} A promise that resolves when the pre-update processing is complete.
	 */
	async beforeEntityUpdate(entity: Screenshot, em?: MultiOrmEntityManager): Promise<void> {
		try {
			if (!(entity instanceof Screenshot)) {
				return; // Early exit if the entity is not a Screenshot
			}

			// Get ORM type dynamically at runtime to ensure correct environment selection
			const ormType = getORMType();

			// Validate entity manager matches the ORM type
			if (!this.isValidEntityManager(em, ormType)) {
				return;
			}

			// Get database options and stringify apps for SQLite
			const options = this.getDbOptions(em);
			this.stringifyAppsForSqlite(entity, options);
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
	 * @param em An optional entity manager which can be either from TypeORM or MikroORM.
	 * @returns {Promise<void>} A promise that resolves when the additional processing is complete.
	 */
	async afterEntityLoad(entity: Screenshot, em?: MultiOrmEntityManager): Promise<void> {
		try {
			if (!(entity instanceof Screenshot)) {
				return; // Early exit if the entity is not a Screenshot
			}

			// Get ORM type dynamically at runtime to ensure correct environment selection
			const ormType = getORMType();

			// Validate entity manager matches the ORM type
			if (!this.isValidEntityManager(em, ormType)) {
				return;
			}

			// Populate file URLs from storage
			await this.populateFileUrls(entity);

			// Get database options and parse apps for SQLite
			const options = this.getDbOptions(em);
			this.parseAppsForSqlite(entity, options);
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
