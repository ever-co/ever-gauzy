import { EventSubscriber } from 'typeorm';
import { faker } from '@faker-js/faker';
import { sluggable } from '@gauzy/common';
import { FileStorageProviderEnum } from '@gauzy/contracts';
import { FileStorage } from './../../core/file-storage';
import { BaseEntityEventSubscriber } from '../../core/entities/subscribers/base-entity-event.subscriber';
import { IssueType } from './issue-type.entity';

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
			// Set a default color if not provided
			if (!entity.color) {
				entity.color = faker.internet.color();
			}

			// Generate a slug from the name, if the name property exists
			if (typeof entity.name === 'string') {
				entity.value = sluggable(entity.name);
			}
		} catch (error) {
			console.error('IssueTypeSubscriber: An error occurred during the beforeEntityCreate process:', error);
		}
	}

	/**
	 * Simulate an asynchronous operation to set the full icon URL.
	 *
	 * @param entity
	 * @returns
	 */
	private async setFullIconUrl(entity: IssueType): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			try {
				// Simulate async operation, e.g., fetching fullUrl from a service
				setTimeout(async () => {
					// Otherwise, generate the full URL for the icon
					const store = new FileStorage().setProvider(FileStorageProviderEnum.LOCAL);
					entity.fullIconUrl = await store.getProviderInstance().url(entity.icon);
					resolve();
				});
			} catch (error) {
				console.error('TaskPrioritySubscriber: Error during the setFullIconUrl process:', error);
				reject(null);
			}
		});
	}

	/**
	 * Simulate an asynchronous operation to set the image URL.
	 *
	 * @param entity
	 * @returns
	 */
	private setImageUrl(entity: IssueType): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			try {
				// Simulate async operation, e.g., fetching fullUrl from a service
				setTimeout(() => {
					entity.fullIconUrl = entity.image?.fullUrl ?? entity.fullIconUrl;
					resolve();
				});
			} catch (error) {
				console.error('TaskPrioritySubscriber: Error during the setImageUrl process:', error);
				reject(null);
			}
		});
	}
}
