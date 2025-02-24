import { EventSubscriber } from 'typeorm';
import { ScreeningTask } from './screening-task.entity';
import { RequestContext } from '../../core/context';
import { BaseEntityEventSubscriber } from '../../core/entities/subscribers/base-entity-event.subscriber';

@EventSubscriber()
export class ScreeningTaskSubscriber extends BaseEntityEventSubscriber<ScreeningTask> {
	/**
	 * Indicates that this subscriber only listen to Task events.
	 */
	listenTo() {
		return ScreeningTask;
	}

	/**
	 * Called before a Task entity is inserted into the database. This method sets the creator ID
	 * of the task based on the current user context.
	 *
	 * @param {ScreeningTask} entity - The `ScreeningTask` entity that is about to be created.
	 * @returns {Promise<void>} - A promise that resolves when the operation is complete.
	 */
	async beforeEntityCreate(entity: ScreeningTask): Promise<void> {
		try {
			// Retrieve the current user's ID from RequestContext and assign it as the creator
			if (entity) {
				entity.createdByUserId = RequestContext.currentUserId();
			}
		} catch (error) {
			console.error('ScreeningTaskSubscriber: An error occurred during the beforeEntityCreate process:', error);
		}
	}
}
