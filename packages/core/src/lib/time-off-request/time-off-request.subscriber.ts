import { EventSubscriber } from 'typeorm';
import { RequestContext } from '../core/context';
import { BaseEntityEventSubscriber } from '../core/entities/subscribers/base-entity-event.subscriber';
import { TimeOffRequest } from './time-off-request.entity';

@EventSubscriber()
export class TimeOffRequestSubscriber extends BaseEntityEventSubscriber<TimeOffRequest> {
	/**
	 * Indicates that this subscriber only listen to TimeOffRequest events.
	 */
	listenTo() {
		return TimeOffRequest;
	}

	/**
	 * Called after a TimeOffRequest entity is loaded from the database. This method updates
	 * the entity's document URL if an associated document with a full URL is present.
	 *
	 * @param entity The TimeOffRequest entity that has been loaded.
	 * @returns {Promise<void>} A promise that resolves when the URL updating process is complete.
	 */
	async afterEntityLoad(entity: TimeOffRequest): Promise<void> {
		try {
			// Check if the entity has an associated document with a full URL and update the document URL
			if (entity.document && entity.document.fullUrl) {
				entity.documentUrl = entity.document.fullUrl;
			}
		} catch (error) {
			console.error('TimeOffRequestSubscriber: An error occurred during the afterEntityLoad process:', error);
		}
	}

	/**
	 * Called before an TimeOffRequest entity is inserted into the database. This method sets the
	 * creator ID, generates a slug for the profile link, and assigns a default logo if necessary.
	 *
	 * @param entity The TimeOffRequest entity about to be created.
	 * @returns {Promise<void>} A promise that resolves when the pre-insertion processing is complete.
	 */
	async beforeEntityCreate(entity: TimeOffRequest): Promise<void> {
		try {
			// Assign the current user's ID as the creator
			entity.createdByUserId = RequestContext.currentUserId();
		} catch (error) {
			console.error('TimeOffRequestSubscriber: An error occurred during the beforeEntityCreate process:', error);
		}
	}
}
