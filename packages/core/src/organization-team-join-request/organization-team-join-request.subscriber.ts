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
	 * Called after entity is loaded from the database.
	 *
	 * @param entity
	 */
	async afterEntityLoad(entity: OrganizationTeamJoinRequest): Promise<void> {
		try {
			if ('expiredAt' in entity) {
				entity.isExpired = entity.expiredAt ? moment(entity.expiredAt).isBefore(moment()) : false;
			}
		} catch (error) {
			console.error('OrganizationTeamJoinRequestSubscriber: An error occurred during the afterEntityLoad process:', error);
		}
	}

	/**
	 * Called before entity is inserted to the database.
	 *
	 * @param entity
	 */
	async beforeEntityCreate(entity: OrganizationTeamJoinRequest): Promise<void> {
		try {
			if (entity) {
				entity.expiredAt = moment(new Date()).add(environment.TEAM_JOIN_REQUEST_EXPIRATION_TIME, 'seconds').toDate();
			}
		} catch (error) {
			console.error('OrganizationTeamJoinRequestSubscriber: An error occurred during the beforeEntityCreate process:', error);
		}
	}
}
