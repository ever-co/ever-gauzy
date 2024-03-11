import { EventSubscriber } from 'typeorm';
import { faker } from '@faker-js/faker';
import { sluggable } from '@gauzy/common';
import { FileStorageProviderEnum } from '@gauzy/contracts';
import { FileStorage } from '../../core/file-storage';
import { BaseEntityEventSubscriber } from '../../core/entities/subscribers/base-entity-event.subscriber';
import { TaskVersion } from './version.entity';

@EventSubscriber()
export class TaskVersionSubscriber extends BaseEntityEventSubscriber<TaskVersion> {
	/**
	 * Indicates that this subscriber only listen to TaskVersion events.
	 */
	listenTo() {
		return TaskVersion;
	}

	/**
	 * Called after entity is loaded from the database.
	 *
	 * @param entity
	 */
	async afterEntityLoad(entity: TaskVersion): Promise<void> {
		try {
			if (entity.icon) {
				const store = new FileStorage().setProvider(FileStorageProviderEnum.LOCAL);
				entity.fullIconUrl = await store.getProviderInstance().url(entity.icon);
			}
		} catch (error) {
			console.error('TaskVersionSubscriber: An error occurred during the afterEntityLoad process:', error);
		}
	}

	/**
	 * Called before entity is inserted/created to the database.
	 *
	 * @param entity
	 */
	async beforeEntityCreate(entity: TaskVersion): Promise<void> {
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
			console.error('TaskVersionSubscriber: An error occurred during the beforeEntityCreate process:', error);
		}
	}
}
