import { EventSubscriber } from 'typeorm';
import { sluggable } from '@gauzy/common';
import { RequestContext } from '../core/context';
import { getDummyImage } from '../core/utils';
import { BaseEntityEventSubscriber } from '../core/entities/subscribers/base-entity-event.subscriber';
import { OrganizationTeam } from './organization-team.entity';

@EventSubscriber()
export class OrganizationTeamSubscriber extends BaseEntityEventSubscriber<OrganizationTeam> {
	/**
	 * Indicates that this subscriber only listen to OrganizationTeam events.
	 */
	listenTo() {
		return OrganizationTeam;
	}

	/**
	 * Called after an OrganizationTeam entity is loaded from the database. This method updates
	 * the entity by setting the prefix and updating the logo URL if an image is available.
	 *
	 * @param entity The OrganizationTeam entity that has been loaded.
	 * @returns {Promise<void>} A promise that resolves when the post-load processing is complete.
	 */
	async afterEntityLoad(entity: OrganizationTeam): Promise<void> {
		try {
			// Set or update the prefix
			entity.prefix = entity.prefix ? entity.prefix.toUpperCase() : entity.name?.substring(0, 3).toUpperCase();

			// Update the logo URL if an image is available
			if (entity.image && entity.image.fullUrl) {
				entity.logo = entity.image.fullUrl;
			}
		} catch (error) {
			console.error('OrganizationTeamSubscriber: An error occurred during the afterEntityLoad process:', error);
		}
	}

	/**
	 * Called before entity is inserted to the database.
	 *
	 * @param entity
	 */
	async beforeEntityCreate(entity: OrganizationTeam): Promise<void> {
		try {
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
		} catch (error) {
			console.error('OrganizationTeamSubscriber: An error occurred during the beforeEntityCreate process:', error);
		}
	}

	/**
	 * Called before entity is updated to the database.
	 *
	 * @param entity
	 */
	async beforeEntityUpdate(entity: OrganizationTeam): Promise<void> {
		try {
			if (entity) {
				// organization team slug based on name
				if (entity.name) {
					entity.profile_link = sluggable(`${entity.name}`);
				}
			}
		} catch (error) {
			console.error('OrganizationTeamSubscriber: An error occurred during the beforeEntityUpdate process:', error);
		}
	}
}
