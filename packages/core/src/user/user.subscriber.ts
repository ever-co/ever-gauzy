import { EntitySubscriberInterface, EventSubscriber, InsertEvent, LoadEvent } from 'typeorm';
import { getUserDummyImage } from './../core/utils';
import { User } from './user.entity';

@EventSubscriber()
export class UserSubscriber implements EntitySubscriberInterface<User> {
	/**
	 * Indicates that this subscriber only listen to User events.
	 */
	listenTo() {
		return User;
	}

	/**
	 * Called before entity is inserted to the database.
	 *
	 * @param event
	 */
	beforeInsert(event: InsertEvent<User>): void | Promise<any> {
		try {
			const entity = event.entity;
			if (!entity.imageUrl) {
				entity.imageUrl = getUserDummyImage(entity);
			}
		} catch (error) {
			console.log(error);
		}
	}

	/**
	 * Called after entity is loaded from the database.
	 *
	 * @param entity
	 * @param event
	 */
	afterLoad(entity: User, event?: LoadEvent<User>): void | Promise<any> {
		try {
			entity.name = [entity.firstName, entity.lastName].filter(Boolean).join(' ');
			entity.employeeId = entity.employee ? entity.employee.id : null;

			if ('emailVerifiedAt' in entity) {
				entity.isEmailVerified = !!entity.emailVerifiedAt;
			}
			if (!!entity['image']) {
				entity.imageUrl = entity.image.fullUrl || entity.imageUrl;
			}
		} catch (error) {
			console.log('Error while retrieve user subscriber', error);
		}
	}
}
