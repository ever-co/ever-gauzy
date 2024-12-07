import { EventSubscriber } from 'typeorm';
import * as moment from 'moment';
import { environment } from '@gauzy/config';
import { BaseEntityEventSubscriber } from '../core/entities/subscribers/base-entity-event.subscriber';
import { OrganizationTeamJoinRequest } from './organization-team-join-request.entity';

@EventSubscriber()
export class OrganizationTeamJoinRequestSubscriber extends BaseEntityEventSubscriber<OrganizationTeamJoinRequest> {
	/**
	 * Indicates that this subscriber only listen to OrganizationTeamJoinRequest events.
	 */
	listenTo() {
		return OrganizationTeamJoinRequest;
	}

	/**
	 * Called after an OrganizationTeamJoinRequest entity is loaded from the database. This method checks
	 * if the join request is expired based on the 'expiredAt' property and sets the 'isExpired' flag accordingly.
	 *
	 * @param entity The OrganizationTeamJoinRequest entity that has been loaded.
	 * @returns {Promise<void>} A promise that resolves when the post-load processing is complete.
	 */
	async afterEntityLoad(entity: OrganizationTeamJoinRequest): Promise<void> {
		try {
			// Check if the entity has an 'expiredAt' date and set the 'isExpired' flag
			entity.isExpired = entity.expiredAt ? moment(entity.expiredAt).isBefore(moment()) : false;
		} catch (error) {
			console.error(
				'OrganizationTeamJoinRequestSubscriber: An error occurred during the afterEntityLoad process:',
				error
			);
		}
	}

	/**
	 * Called before an OrganizationTeamJoinRequest entity is inserted into the database. This method sets
	 * the expiration date for the join request based on a predefined interval.
	 *
	 * @param entity The OrganizationTeamJoinRequest entity about to be created.
	 * @returns {Promise<void>} A promise that resolves when the pre-creation processing is complete.
	 */
	async beforeEntityCreate(entity: OrganizationTeamJoinRequest): Promise<void> {
		try {
			// Set the expiredAt date by adding the predefined expiration time to the current date
			entity.expiredAt = moment().add(environment.TEAM_JOIN_REQUEST_EXPIRATION_TIME, 'seconds').toDate();
		} catch (error) {
			console.error(
				'OrganizationTeamJoinRequestSubscriber: An error occurred during the beforeEntityCreate process:',
				error
			);
		}
	}
}
