import {
	EntitySubscriberInterface,
	EventSubscriber,
	InsertEvent,
	LoadEvent,
} from 'typeorm';
import { faker } from '@ever-co/faker';
import { sluggable } from '@gauzy/common';
import { Status } from './status.entity';

@EventSubscriber()
export class StatusSubscriber implements EntitySubscriberInterface<Status> {
	/**
	 * Indicates that this subscriber only listen to Status events.
	 */
	listenTo() {
		return Status;
	}

	/**
	 * Called after entity is loaded from the database.
	 *
	 * @param entity
	 * @param event
	 */
	afterLoad(
		entity: Status | Partial<Status>,
		event?: LoadEvent<Status>
	): void | Promise<any> {}

	/**
	 * Called before entity is inserted to the database.
	 *
	 * @param event
	 */
	beforeInsert(event: InsertEvent<Status>) {
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
