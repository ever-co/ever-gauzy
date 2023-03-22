import { EntitySubscriberInterface, EventSubscriber, InsertEvent, LoadEvent } from 'typeorm';
import { sluggable } from '@gauzy/common';
import { RequestContext } from './../core/context';
import { getDummyImage } from './../core/utils';
import { OrganizationTeam } from './organization-team.entity';

@EventSubscriber()
export class OrganizationTeamSubscriber implements EntitySubscriberInterface<OrganizationTeam> {
	/**
	 * Indicates that this subscriber only listen to OrganizationTeam events.
	 */
	listenTo() {
		return OrganizationTeam;
	}

	/**
	 * Called after entity is loaded from the database.
	 *
	 * @param entity
	 * @param event
	 */
	afterLoad(entity: OrganizationTeam, event?: LoadEvent<OrganizationTeam>): void | Promise<any> {
		try {
			if (entity) {
				if (entity.prefix) {
					entity.prefix = entity.prefix.toUpperCase();
				} else if (!entity.prefix) {
					const prefix = entity.name;
					if (prefix) {
						entity.prefix = prefix.substring(0, 3).toUpperCase();
					}
				}
				if (!!entity['image']) {
					entity.logo = entity.image.fullUrl || entity.logo;
				}
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
	beforeInsert(event: InsertEvent<OrganizationTeam>): void | Promise<any> {
		try {
			if (event) {
				const { entity } = event;
				if (entity) {
					entity.createdById = RequestContext.currentUserId();

					// organization team slug based on name or profile link
					if (entity.profile_link || entity.name) {
						entity.profile_link = sluggable(`${entity.profile_link || entity.name}`);
					}

					if (!entity.logo) {
						entity.logo = getDummyImage(330, 300, entity.name.charAt(0).toUpperCase());
					}
				}
			}
		} catch (error) {
			console.log('Error before insert organization team entity', error);
		}
	}
}
