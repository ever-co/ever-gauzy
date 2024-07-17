import { EventSubscriber } from 'typeorm';
import { faker } from '@faker-js/faker';
import { sluggable } from '@gauzy/common';
import { FileStorageProviderEnum } from '@gauzy/contracts';
import { FileStorage } from '../../core/file-storage';
import { TaskRelatedIssueType } from './related-issue-type.entity';
import { BaseEntityEventSubscriber } from '../../core/entities/subscribers/base-entity-event.subscriber';

@EventSubscriber()
export class TaskRelatedIssueTypeSubscriber extends BaseEntityEventSubscriber<TaskRelatedIssueType> {
	/**
	 * Indicates that this subscriber only listen to TaskRelatedIssueType events.
	 */
	listenTo() {
		return TaskRelatedIssueType;
	}

	/**
	 * Called after a TaskRelatedIssueType entity is loaded from the database. This method updates
	 * the entity by setting the full icon URL if an icon is associated with the issue type.
	 *
	 * @param entity The TaskRelatedIssueType entity that has been loaded.
	 * @returns {Promise<void>} A promise that resolves when the URL updating process is complete.
	 */
	async afterEntityLoad(entity: TaskRelatedIssueType): Promise<void> {
		try {
			// Update the fullIconUrl if an icon is present
			if (Object.prototype.hasOwnProperty.call(entity, 'icon')) {
				await this.setFullIconUrl(entity);
			}
		} catch (error) {
			console.error(
				`TaskRelatedIssueTypeSubscriber: An error occurred during the afterEntityLoad process for entity ID ${entity.id}:`,
				error
			);
		}
	}

	/**
	 * Called before a TaskRelatedIssueType entity is inserted into the database. This method ensures
	 * that default values for color and value properties are set.
	 *
	 * @param entity The TaskRelatedIssueType entity about to be created.
	 * @returns {Promise<void>} A promise that resolves when the pre-creation processing is complete.
	 */
	async beforeEntityCreate(entity: TaskRelatedIssueType): Promise<void> {
		try {
			// Set a default color using faker if not provided
			entity.color = entity.color || faker.internet.color();

			// Set a sluggable value based on the name, if provided
			if ('name' in entity) {
				entity.value = sluggable(entity.name);
			}
		} catch (error) {
			console.error(
				'TaskRelatedIssueTypeSubscriber: An error occurred during the beforeEntityCreate process:',
				error
			);
		}
	}

	/**
	 * Simulate an asynchronous operation to set the full icon URL.
	 *
	 * @param entity
	 * @returns
	 */
	private async setFullIconUrl(entity: TaskRelatedIssueType): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			try {
				// Simulate async operation, e.g., fetching fullUrl from a service
				setTimeout(async () => {
					const provider = new FileStorage().setProvider(FileStorageProviderEnum.LOCAL);
					entity.fullIconUrl = await provider.getProviderInstance().url(entity.icon);
					resolve();
				});
			} catch (error) {
				console.error('TaskRelatedIssueTypeSubscriber: Error during the setImageUrl process:', error);
				reject(null);
			}
		});
	}
}
