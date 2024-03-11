import { EventSubscriber } from 'typeorm';
import { faker } from '@faker-js/faker';
import { sluggable } from '@gauzy/common';
import { FileStorageProviderEnum } from '@gauzy/contracts';
import { FileStorage } from '../../core/file-storage';
import { BaseEntityEventSubscriber } from '../../core/entities/subscribers/base-entity-event.subscriber';
import { TaskPriority } from './priority.entity';

@EventSubscriber()
export class TaskPrioritySubscriber extends BaseEntityEventSubscriber<TaskPriority> {
	/**
	 * Indicates that this subscriber only listen to TaskPriority events.
	 */
	listenTo() {
		return TaskPriority;
	}

	/**
	 * Called after entity is loaded from the database.
	 *
	 * @param entity
	 */
	async afterEntityLoad(entity: TaskPriority): Promise<void> {
		try {
			if (entity.icon) {
				const store = new FileStorage().setProvider(FileStorageProviderEnum.LOCAL);
				entity.fullIconUrl = await store.getProviderInstance().url(entity.icon);
			}
		} catch (error) {
			console.error('TaskPrioritySubscriber: An error occurred during the afterEntityLoad process:', error);
		}
	}

	/**
	 * Called before entity is inserted to the database.
	 *
	 * @param entity
	 */
	async beforeEntityCreate(entity: TaskPriority): Promise<void> {
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
