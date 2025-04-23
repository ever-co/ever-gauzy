import { Logger } from '@nestjs/common';
import { EventSubscriber } from 'typeorm';
import { faker } from '@faker-js/faker';
import { sluggable } from '@gauzy/common';
import { BaseEntityEventSubscriber } from '../../core/entities/subscribers/base-entity-event.subscriber';
import { TaskPriority } from './priority.entity';
import { setFullIconUrl } from '../utils';

@EventSubscriber()
export class TaskPrioritySubscriber extends BaseEntityEventSubscriber<TaskPriority> {
	private readonly logger = new Logger(TaskPrioritySubscriber.name);

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
			if (Object.hasOwn(entity, 'icon')) {
				await setFullIconUrl([entity]);
			}
		} catch (error) {
			this.logger.error(
				`An error occurred during the afterEntityLoad process for entity ID ${entity.id}: ${error}`
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
			if (Object.hasOwn(entity, 'name')) {
				entity.value = sluggable(entity.name);
			}
		} catch (error) {
			this.logger.error(`An error occurred during the beforeEntityCreate process: ${error}`);
		}
	}
}
