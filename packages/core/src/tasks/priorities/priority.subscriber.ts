import {
	EntitySubscriberInterface,
	EventSubscriber,
	InsertEvent,
	LoadEvent,
} from 'typeorm';
import { faker } from '@ever-co/faker';
import { sluggable } from '@gauzy/common';
import { TaskPriority } from './priority.entity';

@EventSubscriber()
export class TaskPrioritySubscriber
	implements EntitySubscriberInterface<TaskPriority>
{
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
	 * @param event
	 */
	afterLoad(
		entity: TaskPriority | Partial<TaskPriority>,
		event?: LoadEvent<TaskPriority>
	): void | Promise<any> {}

	/**
	 * Called before entity is inserted to the database.
	 *
	 * @param event
	 */
	beforeInsert(event: InsertEvent<TaskPriority>) {
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
			console.log(
				'Error while creating task priority : subscriber : ',
				error
			);
		}
	}
}
