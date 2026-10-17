import { EventSubscriber } from 'typeorm';
import { faker } from '@faker-js/faker';
import { sluggable } from '@gauzy/utils';
import { localFileUrl } from './../../core/file-storage/file-storage';
import { BaseEntityEventSubscriber } from '../../core/entities/subscribers/base-entity-event.subscriber';
import { IssueType } from './issue-type.entity';
import { imageAssetUrlsReady } from '../../image-asset/image-asset-urls';

@EventSubscriber()
export class IssueTypeSubscriber extends BaseEntityEventSubscriber<IssueType> {
	/**
	 * Indicates that this subscriber only listen to IssueType events.
	 */
	listenTo() {
		return IssueType;
	}

	/**
	 * Called after an IssueType entity is loaded from the database. This method updates
	 * the entity by setting the full icon URL using the FileStorage provider.
	 *
	 * @param entity The IssueType entity that has been loaded.
	 * @returns {Promise<void>} A promise that resolves when the URL updating process is complete.
	 */
	async afterEntityLoad(entity: IssueType): Promise<void> {
		try {
			// Update the fullIconUrl if an icon is present
			if (Object.prototype.hasOwnProperty.call(entity, 'image')) {
				// Use the fullUrl from the image property if available
				await this.setImageUrl(entity);
			} else if (Object.prototype.hasOwnProperty.call(entity, 'icon')) {
				// Otherwise, generate the full URL for the icon
				await this.setFullIconUrl(entity);
			}
		} catch (error) {
			console.error('IssueTypeSubscriber: An error occurred during the afterEntityLoad process:', error);
		}
	}

	/**
	 * Called before an IssueType entity is inserted into the database. This method sets default
	 * values and prepares the entity for creation.
	 *
	 * @param entity The IssueType entity that is about to be created.
	 * @returns {Promise<void>} A promise that resolves when the pre-creation processing is complete.
	 */
	async beforeEntityCreate(entity: IssueType): Promise<void> {
		try {
			// Set a default color using faker if not provided
			entity.color ??= faker.color.rgb();

			// Generate a slug from the name, if the name property exists
			if (typeof entity.name === 'string') {
				entity.value = sluggable(entity.name);
			}
		} catch (error) {
			console.error('IssueTypeSubscriber: An error occurred during the beforeEntityCreate process:', error);
		}
	}

	/**
	 * Sets the full icon URL, as served by the LOCAL file storage provider.
	 *
	 * @param entity
	 * @returns
	 */
	private async setFullIconUrl(entity: IssueType): Promise<void> {
		try {
			entity.fullIconUrl = await localFileUrl(entity.icon);
		} catch (error) {
			console.error('IssueTypeSubscriber: Error during the setFullIconUrl process:', error);
			throw error;
		}
	}

	/**
	 * Sets `fullIconUrl` from the image's `fullUrl`, falling back to the existing `fullIconUrl`. Waits only for the
	 * image's own URL resolution, and not at all when there is no image (see `imageAssetUrlsReady`).
	 *
	 * @param entity
	 * @returns
	 */
	private async setImageUrl(entity: IssueType): Promise<void> {
		try {
			const ready = imageAssetUrlsReady(entity.image);
			if (ready) {
				await ready;
			}
			entity.fullIconUrl = entity.image?.fullUrl ?? entity.fullIconUrl;
		} catch (error) {
			console.error('IssueTypeSubscriber: Error during the setImageUrl process:', error);
			throw error;
		}
	}
}
