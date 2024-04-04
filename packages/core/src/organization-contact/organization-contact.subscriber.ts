import { EventSubscriber } from 'typeorm';
import { OrganizationContact } from './organization-contact.entity';
import { getDummyImage } from './../core/utils';
import { BaseEntityEventSubscriber } from '../core/entities/subscribers/base-entity-event.subscriber';

@EventSubscriber()
export class OrganizationContactSubscriber extends BaseEntityEventSubscriber<OrganizationContact> {
	/**
	 * Indicates that this subscriber only listen to OrganizationContact events.
	 */
	listenTo() {
		return OrganizationContact;
	}

	/**
	 * Called after an OrganizationContact entity is loaded from the database. This method updates
	 * the entity's image URL, setting it to the existing image's URL, or generating a dummy
	 * image if no image URL is present.
	 *
	 * @param entity The OrganizationContact entity that has been loaded.
	 * @returns {Promise<void>} A promise that resolves when the URL updating process is complete.
	 */
	async afterEntityLoad(entity: OrganizationContact): Promise<void> {
		try {
			if (entity.image && entity.image.fullUrl) {
				// Use the full URL from the image property if available
				entity.imageUrl = entity.image.fullUrl;
			} else if (!entity.imageUrl && entity.name) {
				// Otherwise, generate a dummy image URL based on the first character of the name
				console.log('OrganizationContactSubscriber: generate dummy image for entity.name', entity.name);
				entity.imageUrl = getDummyImage(330, 300, entity.name.charAt(0).toUpperCase());
			}
		} catch (error) {
			console.error(
				'OrganizationContactSubscriber: An error occurred during the afterEntityLoad process:',
				error
			);
		}
	}

	/**
	 * Called before an OrganizationContact entity is inserted or created in the database. This method sets a
	 * default image URL based on the first character of the entity's name if an image URL is not already provided.
	 *
	 * @param entity The OrganizationContact entity that is about to be created.
	 * @returns {Promise<void>} A promise that resolves when the pre-creation processing is complete.
	 */
	async beforeEntityCreate(entity: OrganizationContact): Promise<void> {
		try {
			// Generate a dummy image URL based on the first character of the name, if imageUrl is not provided
			if (!entity.imageUrl && entity.name) {
				entity.imageUrl = getDummyImage(330, 300, entity.name.charAt(0).toUpperCase());
			}
		} catch (error) {
			console.error(
				'OrganizationContactSubscriber: An error occurred during the beforeEntityCreate process:',
				error
			);
		}
	}
}
