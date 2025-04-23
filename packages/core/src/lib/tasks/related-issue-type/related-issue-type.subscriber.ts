import { Logger } from '@nestjs/common';
import { EventSubscriber } from 'typeorm';
import { faker } from '@faker-js/faker';
import { sluggable } from '@gauzy/common';
import { TaskRelatedIssueType } from './related-issue-type.entity';
import { BaseEntityEventSubscriber } from '../../core/entities/subscribers/base-entity-event.subscriber';
import { setFullIconUrl } from '../utils';

@EventSubscriber()
export class TaskRelatedIssueTypeSubscriber extends BaseEntityEventSubscriber<TaskRelatedIssueType> {
	private readonly logger = new Logger(TaskRelatedIssueTypeSubscriber.name);

	/**
	 * Indicates that this subscriber only listen to TaskRelatedIssueType events.
	 */
	listenTo() {
		return TaskRelatedIssueType;
	}

	/**
	 * Called after a TaskRelatedIssueType entity is loaded from the database. This method updates
	 * the entity by setting the full icon URL if an icon is associated with the issue type.
	 *
	 * @param entity The TaskRelatedIssueType entity that has been loaded.
	 * @returns {Promise<void>} A promise that resolves when the URL updating process is complete.
	 */
	async afterEntityLoad(entity: TaskRelatedIssueType): Promise<void> {
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
	 * Called before a TaskRelatedIssueType entity is inserted into the database. This method ensures
	 * that default values for color and value properties are set.
	 *
	 * @param entity The TaskRelatedIssueType entity about to be created.
	 * @returns {Promise<void>} A promise that resolves when the pre-creation processing is complete.
	 */
	async beforeEntityCreate(entity: TaskRelatedIssueType): Promise<void> {
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
