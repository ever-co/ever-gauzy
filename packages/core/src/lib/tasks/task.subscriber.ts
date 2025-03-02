import { EventSubscriber } from 'typeorm';
import { RequestContext } from './../core/context';
import { BaseEntityEventSubscriber } from '../core/entities/subscribers/base-entity-event.subscriber';
import { Task } from './task.entity';

@EventSubscriber()
export class TaskSubscriber extends BaseEntityEventSubscriber<Task> {
	/**
	 * Indicates that this subscriber only listen to Task events.
	 */
	listenTo() {
		return Task;
	}

	/**
	 * Called after a Task entity is loaded from the database. This method constructs a formatted
	 * task number based on the prefix and the task's number.
	 *
	 * @param entity The Task entity that has been loaded.
	 * @returns {Promise<void>} A promise that resolves when the task number generation is complete.
	 */
	async afterEntityLoad(entity: Task): Promise<void> {
		try {
			if (entity) {
				// Determine the prefix
				let prefix = entity.prefix?.toUpperCase() || entity.project?.name?.substring(0, 3).toUpperCase() || '';

				// Construct the task number parts
				const list = [prefix, entity.number || 0];

				// Set the taskNumber property if 'number' exists in the entity
				if ('number' in entity) {
					entity.taskNumber = list.filter(Boolean).join('-');
				}
			}
		} catch (error) {
			console.error('TaskSubscriber: An error occurred during the afterEntityLoad process:', error);
		}
	}

	/**
	 * Called before a Task entity is inserted into the database. This method sets the created by user ID
	 * of the task based on the current user context.
	 *
	 * @param entity The Task entity about to be created.
	 * @returns {Promise<void>} A promise that resolves when the pre-creation processing is complete.
	 */
	async beforeEntityCreate(entity: Task): Promise<void> {
		try {
			// Retrieve the current user's ID from RequestContext and assign it as the created by user
			if (entity) {
				entity.createdByUserId = RequestContext.currentUserId();
			}
		} catch (error) {
			console.error('TaskSubscriber: An error occurred during the beforeEntityCreate process:', error);
		}
	}
}
