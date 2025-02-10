import { EventSubscriber } from 'typeorm';
import { faker } from '@faker-js/faker';
import { sluggable } from '@gauzy/utils';
import { FileStorageProviderEnum } from '@gauzy/contracts';
import { FileStorage } from './../../core/file-storage';
import { BaseEntityEventSubscriber } from '../../core/entities/subscribers/base-entity-event.subscriber';
import { TaskSize } from './size.entity';

@EventSubscriber()
export class TaskSizeSubscriber extends BaseEntityEventSubscriber<TaskSize> {
	/**
	 * Indicates that this subscriber only listen to TaskSize events.
	 */
	listenTo() {
		return TaskSize;
	}

	/**
	 * Called after a TaskSize entity is loaded from the database. This method updates
	 * the entity by setting the full icon URL using the FileStorage provider.
	 *
	 * @param entity The TaskSize entity that has been loaded.
	 * @returns {Promise<void>} A promise that resolves when the URL updating process is complete.
	 */
	async afterEntityLoad(entity: TaskSize): Promise<void> {
		try {
			// Update the fullIconUrl if an icon property is present
			if (Object.prototype.hasOwnProperty.call(entity, 'icon')) {
				await this.setFullIconUrl(entity);
			}
		} catch (error) {
			console.error(
				`TaskSizeSubscriber: An error occurred during the afterEntityLoad process for entity ID ${entity.id}:`,
				error
			);
		}
	}

	/**
	 * Called before a TaskSize entity is inserted into the database. This method sets default
	 * values for certain properties of the entity.
	 *
	 * @param entity The TaskSize entity about to be created.
	 * @returns {Promise<void>} A promise that resolves when the pre-creation processing is complete.
	 */
	async beforeEntityCreate(entity: TaskSize): Promise<void> {
		try {
			// Set a default color using faker if not provided
			entity.color = entity.color || faker.internet.color();

			// Set a sluggable value based on the name, if provided
			if ('name' in entity) {
				entity.value = sluggable(entity.name);
			}
		} catch (error) {
			console.error('TaskSizeSubscriber: An error occurred during the beforeEntityCreate process:', error);
		}
	}

	/**
	 * Sets the full icon URL for a `TaskSize` entity using a file storage provider.
	 *
	 * @param entity - The `TaskSize` entity whose `fullIconUrl` needs to be set.
	 * @returns A promise that resolves when the `fullIconUrl` is successfully set.
	 */
	private async setFullIconUrl(entity: TaskSize): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			try {
				// Simulate async operation with a delay
				setTimeout(async () => {
					// Initialize the file storage provider
					const provider = new FileStorage().setProvider(FileStorageProviderEnum.LOCAL);
					// Fetch and set the full URL for the icon
					entity.fullIconUrl = await provider.getProviderInstance().url(entity.icon);
					// Resolve the promise once the URL is set
					resolve();
				});
			} catch (error) {
				console.error('TaskSizeSubscriber: Error during the setImageUrl process:', error);
				reject(null);
			}
		});
	}
}
