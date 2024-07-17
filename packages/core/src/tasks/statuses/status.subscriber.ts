import { EventSubscriber } from 'typeorm';
import { faker } from '@faker-js/faker';
import { sluggable } from '@gauzy/common';
import { FileStorageProviderEnum } from '@gauzy/contracts';
import { FileStorage } from '../../core/file-storage';
import { BaseEntityEventSubscriber } from '../../core/entities/subscribers/base-entity-event.subscriber';
import { TaskStatus } from './status.entity';

@EventSubscriber()
export class TaskStatusSubscriber extends BaseEntityEventSubscriber<TaskStatus> {
	/**
	 * Indicates that this subscriber only listen to TaskStatus events.
	 */
	listenTo() {
		return TaskStatus;
	}

	/**
	 * Called after a TaskStatus entity is loaded from the database. This method updates
	 * the entity by setting the full icon URL using the FileStorage provider.
	 *
	 * @param entity The TaskStatus entity that has been loaded.
	 * @returns {Promise<void>} A promise that resolves when the URL updating process is complete.
	 */
	async afterEntityLoad(entity: TaskStatus): Promise<void> {
		try {
			// Update the fullIconUrl if an icon is present
			if (Object.prototype.hasOwnProperty.call(entity, 'icon')) {
				await this.setFullIconUrl(entity);
			}
		} catch (error) {
			console.error('TaskStatusSubscriber: An error occurred during the afterEntityLoad process:', error);
		}
	}

	/**
	 * Called before a TaskStatus entity is inserted into the database. This method ensures
	 * default values for color and value properties are set.
	 *
	 * @param entity The TaskStatus entity about to be created.
	 * @returns {Promise<void>} A promise that resolves when the pre-creation processing is complete.
	 */
	async beforeEntityCreate(entity: TaskStatus): Promise<void> {
		try {
			// Set a default color using faker if not provided
			entity.color = entity.color || faker.internet.color();

			// Set a sluggable value based on the name, if provided
			if ('name' in entity) {
				entity.value = sluggable(entity.name);
			}
		} catch (error) {
			console.error('TaskStatusSubscriber: An error occurred during the beforeEntityCreate process:', error);
		}
	}

	/**
	 * Simulate an asynchronous operation to set the full icon URL.
	 *
	 * @param entity
	 * @returns
	 */
	private async setFullIconUrl(entity: TaskStatus): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			try {
				// Simulate async operation, e.g., fetching fullUrl from a service
				setTimeout(async () => {
					const provider = new FileStorage().setProvider(FileStorageProviderEnum.LOCAL);
					entity.fullIconUrl = await provider.getProviderInstance().url(entity.icon);
					resolve();
				});
			} catch (error) {
				console.error('TaskStatusSubscriber: Error during the setImageUrl process:', error);
				reject(null);
			}
		});
	}
}
