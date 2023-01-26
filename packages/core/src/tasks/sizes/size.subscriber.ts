import {
	EntitySubscriberInterface,
	EventSubscriber,
	InsertEvent,
	LoadEvent,
} from 'typeorm';
import { faker } from '@ever-co/faker';
import { sluggable } from '@gauzy/common';
import { TaskSize } from './size.entity';

@EventSubscriber()
export class TaskSizeSubscriber implements EntitySubscriberInterface<TaskSize> {
	/**
	 * Indicates that this subscriber only listen to TaskSize events.
	 */
	listenTo() {
		return TaskSize;
	}

	/**
	 * Called after entity is loaded from the database.
	 *
	 * @param entity
	 * @param event
	 */
	afterLoad(
		entity: TaskSize | Partial<TaskSize>,
		event?: LoadEvent<TaskSize>
	): void | Promise<any> {}

	/**
	 * Called before entity is inserted to the database.
	 *
	 * @param event
	 */
	beforeInsert(event: InsertEvent<TaskSize>) {
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
			console.log('Error while creating task size : subscriber : ', error);
		}
	}
}
