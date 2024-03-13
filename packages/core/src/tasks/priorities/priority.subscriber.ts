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
			// Update the fullIconUrl if an icon property is present
			if (entity.icon) {
				const store = new FileStorage().setProvider(FileStorageProviderEnum.LOCAL);
				entity.fullIconUrl = await store.getProviderInstance().url(entity.icon);
			}
		} catch (error) {
			console.error(`TaskPrioritySubscriber: An error occurred during the afterEntityLoad process for entity ID ${entity.id}:`, error);
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
			if ('name' in entity) {
				entity.value = sluggable(entity.name);
			}
		} catch (error) {
			console.error('TaskPrioritySubscriber: An error occurred during the beforeEntityCreate process:', error);
		}
	}
}
