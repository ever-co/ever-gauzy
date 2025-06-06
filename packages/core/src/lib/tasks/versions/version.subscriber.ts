import { EventSubscriber } from 'typeorm';
import { faker } from '@faker-js/faker';
import { sluggable } from '@gauzy/utils';
import { FileStorageProviderEnum } from '@gauzy/contracts';
import { FileStorage } from '../../core/file-storage';
import { BaseEntityEventSubscriber } from '../../core/entities/subscribers/base-entity-event.subscriber';
import { TaskVersion } from './version.entity';

@EventSubscriber()
export class TaskVersionSubscriber extends BaseEntityEventSubscriber<TaskVersion> {
	/**
	 * Indicates that this subscriber only listen to TaskVersion events.
	 */
	listenTo() {
		return TaskVersion;
	}

	/**
	 * Called after a TaskVersion entity is loaded from the database. This method updates
	 * the entity by setting the full icon URL using a specified file storage provider.
	 *
	 * @param entity The TaskVersion entity that has been loaded.
	 * @returns {Promise<void>} A promise that resolves when the URL updating process is complete.
	 */
	async afterEntityLoad(entity: TaskVersion): Promise<void> {
		try {
			// Generate and set the full icon URL if an icon property exists
			if (Object.prototype.hasOwnProperty.call(entity, 'icon')) {
				await this.setFullIconUrl(entity);
			}
		} catch (error) {
			console.error('TaskVersionSubscriber: An error occurred during the afterEntityLoad process:', error);
		}
	}

	/**
	 * Called before a TaskVersion entity is inserted or created in the database. This method ensures
	 * default values for color and value properties are set.
	 *
	 * @param entity The TaskVersion entity about to be created.
	 * @returns {Promise<void>} A promise that resolves when the pre-creation processing is complete.
	 */
	async beforeEntityCreate(entity: TaskVersion): Promise<void> {
		try {
			// Set a default color using faker if not provided
			entity.color ??= faker.color.rgb();

			// Set a sluggable value based on the name, if provided
			if ('name' in entity) {
				entity.value = sluggable(entity.name);
			}
		} catch (error) {
			console.error('TaskVersionSubscriber: An error occurred during the beforeEntityCreate process:', error);
		}
	}

	/**
	 * Simulate an asynchronous operation to set the full icon URL.
	 *
	 * @param entity
	 * @returns
	 */
	private async setFullIconUrl(entity: TaskVersion): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			try {
				// Simulate async operation, e.g., fetching fullUrl from a service
				setTimeout(async () => {
					const store = new FileStorage().setProvider(FileStorageProviderEnum.LOCAL);
					entity.fullIconUrl = await store.getProviderInstance().url(entity.icon);
					resolve();
				});
			} catch (error) {
				console.error('TaskStatusSubscriber: Error during the setImageUrl process:', error);
				reject(null);
			}
		});
	}
}
