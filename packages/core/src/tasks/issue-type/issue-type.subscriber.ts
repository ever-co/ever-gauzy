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
import { IssueType } from './issue-type.entity';

@EventSubscriber()
export class IssueTypeSubscriber implements EntitySubscriberInterface<IssueType> {
	/**
	 * Indicates that this subscriber only listen to IssueType events.
	 */
	listenTo() {
		return IssueType;
	}

	/**
	 * Called after entity is loaded from the database.
	 *
	 * @param entity
	 * @param event
	 */
	afterLoad(
		entity: IssueType | Partial<IssueType>,
		event?: LoadEvent<IssueType>
	): void | Promise<any> {
		try {
			if (!!entity['image']) {
				entity.fullIconUrl = entity.image.fullUrl || entity.icon;
			}
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
	beforeInsert(event: InsertEvent<IssueType>) {
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
			console.log('Error while creating issue type : subscriber : ', error);
		}
	}
}
