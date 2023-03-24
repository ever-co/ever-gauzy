import {
	EntitySubscriberInterface,
	EventSubscriber,
	InsertEvent,
	LoadEvent,
} from 'typeorm';
import { faker } from '@faker-js/faker';
import { sluggable } from '@gauzy/common';
import { FileStorageProviderEnum } from '@gauzy/contracts';
import { FileStorage } from './../../core/file-storage';
import { TaskStatus } from './status.entity';

@EventSubscriber()
export class TaskStatusSubscriber implements EntitySubscriberInterface<TaskStatus> {
	/**
	 * Indicates that this subscriber only listen to TaskStatus events.
	 */
	listenTo() {
		return TaskStatus;
	}

	/**
	 * Called after entity is loaded from the database.
	 *
	 * @param entity
	 * @param event
	 */
	afterLoad(
		entity: TaskStatus | Partial<TaskStatus>,
		event?: LoadEvent<TaskStatus>
	): void | Promise<any> {
		try {
			if (entity.icon) {
				const store = new FileStorage().setProvider(FileStorageProviderEnum.LOCAL);
				entity.fullIconUrl = store.getProviderInstance().url(entity.icon);
			}
		} catch (error) {
			console.log(error);
		}
	}

	/**
	 * Called before entity is inserted to the database.
	 *
	 * @param event
	 */
	beforeInsert(event: InsertEvent<TaskStatus>) {
		try {
			if (event) {
				const { entity } = event;
				if (!entity.color) {
					entity.color = faker.internet.color();
				}
				if ('name' in entity) {
					entity.value = sluggable(entity.name);
				}
			}
		} catch (error) {
			console.log(error);
		}
	}
}
