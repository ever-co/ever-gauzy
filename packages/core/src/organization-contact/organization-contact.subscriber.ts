import { EntitySubscriberInterface, EventSubscriber, InsertEvent, LoadEvent, UpdateEvent } from 'typeorm';
import { OrganizationContact } from './organization-contact.entity';
import { getDummyImage } from './../core/utils';

@EventSubscriber()
export class OrganizationContactSubscriber implements EntitySubscriberInterface<OrganizationContact> {
	/**
	 * Indicates that this subscriber only listen to OrganizationContact events.
	 */
	listenTo() {
		return OrganizationContact;
	}

	/**
	 * Called after entity is loaded from the database.
	 *
	 * @param entity
	 * @param event
	 */
	afterLoad(entity: OrganizationContact, event?: LoadEvent<OrganizationContact>): void | Promise<any> {
		try {
			if (!!entity['image']) {
				entity.imageUrl = entity.image.fullUrl || entity.imageUrl;
			}
			if (!entity.imageUrl && entity.name) {
				entity.imageUrl = getDummyImage(330, 300, entity.name.charAt(0).toUpperCase());
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
	beforeInsert(event: InsertEvent<OrganizationContact>): void | Promise<any> {
		try {
			if (event.entity && !event.entity.imageUrl && event.entity.name) {
				event.entity.imageUrl = getDummyImage(330, 300, event.entity.name.charAt(0).toUpperCase());
			}
		} catch (error) {
			console.log(error);
		}
	}

	/**
	 * Called before entity is updated in the database.
	 *
	 * @param event
	 */
	beforeUpdate(event: UpdateEvent<OrganizationContact>): void | Promise<any> {}
}
