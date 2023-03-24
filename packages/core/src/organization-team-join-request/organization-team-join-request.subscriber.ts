import { EntitySubscriberInterface, EventSubscriber, InsertEvent, LoadEvent } from 'typeorm';
import * as moment from 'moment';
import { environment } from '@gauzy/config';
import { OrganizationTeamJoinRequest } from './organization-team-join-request.entity';

@EventSubscriber()
export class OrganizationTeamJoinRequestSubscriber implements EntitySubscriberInterface<OrganizationTeamJoinRequest> {
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
	 * @param event
	 */
	afterLoad(
		entity: OrganizationTeamJoinRequest,
		event?: LoadEvent<OrganizationTeamJoinRequest>
	): void | Promise<any> {
		try {
			if ('expiredAt' in entity) {
				entity.isExpired = entity.expiredAt ? moment(entity.expiredAt).isBefore(moment()) : false;
			}
		} catch (error) {
			console.log(error);
		}
	}

	/**
	 * Called before entity is inserted to the database.
	 *
	 * @param event
	 */
	beforeInsert(event: InsertEvent<OrganizationTeamJoinRequest>): void | Promise<any> {
		try {
			if (event.entity) {
				const entity = event.entity;
				entity.expiredAt = moment(new Date()).add(environment.TEAM_JOIN_REQUEST_EXPIRATION_TIME, 'seconds').toDate();
			}
		} catch (error) {
			console.log(error);
		}
	}
}
