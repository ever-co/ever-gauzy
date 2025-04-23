import { Logger } from '@nestjs/common';
import { EventSubscriber } from 'typeorm';
import { faker } from '@faker-js/faker';
import { sluggable } from '@gauzy/common';
import { BaseEntityEventSubscriber } from '../../core/entities/subscribers/base-entity-event.subscriber';
import { TaskVersion } from './version.entity';
import { setFullIconUrl } from '../utils';

@EventSubscriber()
export class TaskVersionSubscriber extends BaseEntityEventSubscriber<TaskVersion> {
	private readonly logger = new Logger(TaskVersionSubscriber.name);

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
			if (Object.hasOwn(entity, 'icon')) {
				await setFullIconUrl([entity]);
			}
		} catch (error) {
			this.logger.error(`An error occurred during the afterEntityLoad process: ${error}`);
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
			entity.color = entity.color || faker.internet.color();

			// Set a sluggable value based on the name, if provided
			if ('name' in entity) {
				entity.value = sluggable(entity.name);
			}
		} catch (error) {
			this.logger.error(`An error occurred during the beforeEntityCreate process: ${error}`);
		}
	}
}
