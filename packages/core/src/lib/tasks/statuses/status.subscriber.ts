import { Logger } from '@nestjs/common';
import { EventSubscriber } from 'typeorm';
import { faker } from '@faker-js/faker';
import { sluggable } from '@gauzy/common';
import { BaseEntityEventSubscriber } from '../../core/entities/subscribers/base-entity-event.subscriber';
import { TaskStatus } from './status.entity';
import { setFullIconUrl } from '../utils';

@EventSubscriber()
export class TaskStatusSubscriber extends BaseEntityEventSubscriber<TaskStatus> {
	private readonly logger = new Logger(TaskStatusSubscriber.name);

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
			if (Object.hasOwn(entity, 'icon')) {
				await setFullIconUrl([entity]);
			}
		} catch (error) {
			this.logger.error(`An error occurred during the afterEntityLoad process: ${error}`);
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
			if (Object.hasOwn(entity, 'name')) {
				entity.value = sluggable(entity.name);
			}
		} catch (error) {
			this.logger.error(`An error occurred during the beforeEntityCreate process: ${error}`);
		}
	}
}
