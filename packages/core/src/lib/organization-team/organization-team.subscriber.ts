import { EventSubscriber } from 'typeorm';
import { sluggable } from '@gauzy/utils';
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

			// Set logo from the image object's fullUrl, if available. Fall back to existing logo if not.
			if (Object.prototype.hasOwnProperty.call(entity, 'image')) {
				await this.setImageUrl(entity);
			}
		} catch (error) {
			console.error('OrganizationTeamSubscriber: An error occurred during the afterEntityLoad process:', error);
		}
	}

	/**
	 * Called before an OrganizationTeam entity is inserted into the database. This method sets the
	 * creator ID, generates a slug for the profile link, and assigns a default logo if necessary.
	 *
	 * @param entity The OrganizationTeam entity about to be created.
	 * @returns {Promise<void>} A promise that resolves when the pre-insertion processing is complete.
	 */
	async beforeEntityCreate(entity: OrganizationTeam): Promise<void> {
		try {
			// Assign the current user's ID as the creator
			entity.createdById = RequestContext.currentUserId();

			// Generate a slug for the profile link
			if (entity.profile_link || entity.name) {
				entity.profile_link = sluggable(`${entity.profile_link || entity.name}`);
			}

			// Set a default logo if not provided
			if (!entity.logo && entity.name) {
				entity.logo = getDummyImage(330, 300, entity.name.charAt(0).toUpperCase());
			}
		} catch (error) {
			console.error(
				'OrganizationTeamSubscriber: An error occurred during the beforeEntityCreate process:',
				error
			);
		}
	}

	/**
	 * Called before an OrganizationTeam entity is updated in the database. This method updates
	 * the slug for the profile link based on the team's name.
	 *
	 * @param entity The OrganizationTeam entity that is about to be updated.
	 * @returns {Promise<void>} A promise that resolves when the pre-update processing is complete.
	 */
	async beforeEntityUpdate(entity: OrganizationTeam): Promise<void> {
		try {
			// Update the profile link slug if the name is provided
			if (entity.name) {
				entity.profile_link = sluggable(entity.name);
			}
		} catch (error) {
			console.error(
				'OrganizationTeamSubscriber: An error occurred during the beforeEntityUpdate process:',
				error
			);
		}
	}

	/**
	 * 	Simulate an asynchronous operation to set the logo.
	 * @param entity - The OrganizationTeam entity for which the logo is to be updated.
	 * @returns {Promise<void>} A promise that resolves when the logo update is complete.
	 */
	private setImageUrl(entity: OrganizationTeam): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			try {
				// Simulate async operation, e.g., fetching fullUrl from a service
				setTimeout(() => {
					entity.logo = entity.image?.fullUrl ?? entity.logo;
					resolve();
				});
			} catch (error) {
				console.error('OrganizationTeamSubscriber: Error during the setImageUrl process:', error);
				reject(null);
			}
		});
	}
}
