import { EventSubscriber } from 'typeorm';
import { faker } from '@faker-js/faker';
import { sluggable } from '@gauzy/common';
import { FileStorageProviderEnum } from '@gauzy/contracts';
import { FileStorage } from '../../core/file-storage';
import { BaseEntityEventSubscriber } from '../../core/entities/subscribers/base-entity-event.subscriber';
import { TaskPriority } from './priority.entity';

@EventSubscriber()
export class TaskPrioritySubscriber extends BaseEntityEventSubscriber<TaskPriority> {
	/**
	 * Indicates that this subscriber only listen to TaskPriority events.
	 */
	listenTo() {
		return TaskPriority;
	}

	/**
	 * Called after a TaskPriority entity is loaded from the database. This method updates
	 * the entity by setting the full icon URL if an icon is associated with the priority level.
	 *
	 * @param entity The TaskPriority entity that has been loaded.
	 * @returns {Promise<void>} A promise that resolves when the URL updating process is complete.
	 */
	async afterEntityLoad(entity: TaskPriority): Promise<void> {
		try {
			// Update the fullIconUrl if an icon is present
			if (Object.prototype.hasOwnProperty.call(entity, 'icon')) {
				await this.setFullIconUrl(entity);
			}
		} catch (error) {
			console.error(
				`TaskPrioritySubscriber: An error occurred during the afterEntityLoad process for entity ID ${entity.id}:`,
				error
			);
		}
	}

	/**
	 * Called before a TaskPriority entity is inserted into the database. This method ensures
	 * that default values for color and value properties are set if they're not provided.
	 *
	 * @param entity The TaskPriority entity about to be created.
	 * @returns {Promise<void>} A promise that resolves when the pre-creation processing is complete.
	 */
	async beforeEntityCreate(entity: TaskPriority): Promise<void> {
		try {
			// Set a default color using faker if not provided
			entity.color = entity.color || faker.internet.color();

			// Set a sluggable value based on the name, if provided
			if (Object.prototype.hasOwnProperty.call(entity, 'name')) {
				entity.value = sluggable(entity.name);
			}
		} catch (error) {
			console.error('TaskPrioritySubscriber: An error occurred during the beforeEntityCreate process:', error);
		}
	}

	/**
	 * Sets the full icon URL for a `TaskPriority` entity using a file storage provider.
	 *
	 * @param entity - The `TaskPriority` entity whose `fullIconUrl` needs to be set.
	 * @returns A promise that resolves once the `fullIconUrl` is successfully set.
	 */
	private async setFullIconUrl(entity: TaskPriority): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			try {
				// Simulate async operation, e.g., fetching fullUrl from a service
				setTimeout(async () => {
					// Initialize the file storage provider
					const provider = new FileStorage().setProvider(FileStorageProviderEnum.LOCAL);
					// Fetch and set the full URL for the icon
					entity.fullIconUrl = await provider.getProviderInstance().url(entity.icon);
					// Resolve the promise once the URL is set
					resolve();
				});
			} catch (error) {
				console.error('TaskPrioritySubscriber: Error during the setFullIconUrl process:', error);
				reject(null);
			}
		});
	}
}
