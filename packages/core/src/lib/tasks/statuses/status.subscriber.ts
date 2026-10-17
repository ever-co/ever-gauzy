import { EventSubscriber } from 'typeorm';
import { faker } from '@faker-js/faker';
import { sluggable } from '@gauzy/utils';
import { localFileUrl } from '../../core/file-storage/file-storage';
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
			entity.color ??= faker.color.rgb();

			// Set a sluggable value based on the name, if provided
			if ('name' in entity) {
				entity.value = sluggable(entity.name);
			}
		} catch (error) {
			console.error('TaskStatusSubscriber: An error occurred during the beforeEntityCreate process:', error);
		}
	}

	/**
	 * Sets the full icon URL for a `TaskStatus` entity, as served by the LOCAL file storage provider.
	 *
	 * @param entity - The `TaskStatus` entity whose `fullIconUrl` needs to be set.
	 * @returns A promise that resolves when the `fullIconUrl` is successfully set.
	 */
	private async setFullIconUrl(entity: TaskStatus): Promise<void> {
		try {
			entity.fullIconUrl = await localFileUrl(entity.icon);
		} catch (error) {
			console.error('Error fetching the icon URL:', error);
			throw error;
		}
	}
}
