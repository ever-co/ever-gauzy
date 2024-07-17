import { EventSubscriber } from 'typeorm';
import { faker } from '@faker-js/faker';
import { sluggable } from '@gauzy/common';
import { Organization } from './organization.entity';
import { getOrganizationDummyImage } from '../core/utils';
import { BaseEntityEventSubscriber } from '../core/entities/subscribers/base-entity-event.subscriber';

@EventSubscriber()
export class OrganizationSubscriber extends BaseEntityEventSubscriber<Organization> {
	/**
	 * Indicates that this subscriber only listen to Organization events.
	 */
	listenTo() {
		return Organization;
	}

	/**
	 * Called after an Organization entity is loaded from the database. This method updates
	 * the entity's image URL based on the available data.
	 *
	 * @param entity The Organization entity that has been loaded.
	 * @returns {Promise<void>} A promise that resolves when the URL updating process is complete.
	 */
	async afterEntityLoad(entity: Organization): Promise<void> {
		try {
			// Set imageUrl from the image object's fullUrl, if available. Fall back to existing imageUrl if not.
			if ('image' in entity) {
				await this.setImageUrl(entity);
			} else if (!entity.imageUrl && (entity.name || entity.officialName)) {
				// If imageUrl is not set and there's a name or officialName, generate a dummy image URL
				entity.imageUrl = getOrganizationDummyImage(entity.name || entity.officialName);
			}
		} catch (error) {
			console.error('OrganizationSubscriber: An error occurred during the afterEntityLoad process:', error);
		}
	}

	/**
	 * Called before an Organization entity is inserted or created in the database.
	 * This method sets default values for certain properties of the entity.
	 *
	 * @param entity The Organization entity about to be created.
	 * @returns {Promise<void>} A promise that resolves when the pre-creation processing is complete.
	 */
	async beforeEntityCreate(entity: Organization): Promise<void> {
		try {
			if (entity) {
				// Set a profile link based on the organization's name or official name
				if (entity.name || entity.officialName) {
					entity.profile_link = sluggable(`${entity.name || entity.officialName}`);
				}

				// Generate a dummy image URL if an image URL is not already provided
				if (!entity.imageUrl) {
					entity.imageUrl = getOrganizationDummyImage(entity.name || entity.officialName);
				}

				// Assign a random color for brandColor if it's not provided
				if (!entity.brandColor) {
					entity.brandColor = faker.internet.color();
				}
			}
		} catch (error) {
			console.error('OrganizationSubscriber: An error occurred during the beforeEntityCreate process:', error);
		}
	}

	/**
	 * Simulate an asynchronous operation to set the imageUrl.
	 *
	 * @param entity
	 * @returns
	 */
	private setImageUrl(entity: Organization): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			try {
				// Simulate async operation, e.g., fetching fullUrl from a service
				setTimeout(() => {
					entity.imageUrl = entity.image?.fullUrl ?? entity.imageUrl;
					resolve();
				});
			} catch (error) {
				console.error('OrganizationSubscriber: Error during the setImageUrl process:', error);
				reject(null);
			}
		});
	}
}
