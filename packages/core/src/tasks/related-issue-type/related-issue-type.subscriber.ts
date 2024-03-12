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
	 * Called after entity is loaded from the database.
	 *
	 * @param entity
	 */
	async afterEntityLoad(entity: TaskRelatedIssueType): Promise<void> {
		try {
			if (entity.icon) {
				const store = new FileStorage().setProvider(FileStorageProviderEnum.LOCAL);
				entity.fullIconUrl = await store.getProviderInstance().url(entity.icon);
			}
		} catch (error) {
			console.error('TaskRelatedIssueTypeSubscriber: An error occurred during the afterEntityLoad process:', error);
		}
	}

	/**
	 * Called before entity is inserted to the database.
	 *
	 * @param entity
	 */
	async beforeEntityCreate(entity: TaskRelatedIssueType): Promise<void> {
		try {
			if (entity) {
				if (!entity.color) {
					entity.color = faker.internet.color();
				}
				if ('name' in entity) {
					entity.value = sluggable(entity.name);
				}
			}
		} catch (error) {
			console.error('TaskRelatedIssueTypeSubscriber: An error occurred during the beforeEntityCreate process:', error);
		}
	}
}
