import { EventSubscriber } from 'typeorm';
import { getUserDummyImage } from '../core/utils';
import { BaseEntityEventSubscriber } from '../core/entities/subscribers/base-entity-event.subscriber';
import { User } from './user.entity';

@EventSubscriber()
export class UserSubscriber extends BaseEntityEventSubscriber<User> {
	/**
	 * Indicates that this subscriber only listen to User events.
	 */
	listenTo() {
		return User;
	}

	/**
	 * Called before a User entity is inserted or created in the database. This method ensures
	 * that a default image URL is set if one is not provided.
	 *
	 * @param entity The User entity about to be created.
	 * @returns {Promise<void>} A promise that resolves when the pre-creation processing is complete.
	 */
	async beforeEntityCreate(entity: User): Promise<void> {
		try {
			// Set a default imageUrl using a dummy image if not already provided
			entity.imageUrl = entity.imageUrl || getUserDummyImage(entity);
		} catch (error) {
			console.error('UserSubscriber: Error during the beforeEntityCreate process:', error);
		}
	}

	/**
	 * Called after the entity is loaded from the database.
	 *
	 * @param entity The User entity that has been loaded.
	 */
	async afterEntityLoad(entity: User): Promise<void> {
		try {
			// Combine first name and last name into a full name, if they exist.
			entity.name = [entity.firstName, entity.lastName].filter(Boolean).join(' ');

			// Set isEmailVerified to true if the emailVerifiedAt property exists and has a truthy value.
			if (Object.prototype.hasOwnProperty.call(entity, 'emailVerifiedAt')) {
				entity.isEmailVerified = !!entity.emailVerifiedAt;
			}

			// Set imageUrl from the image object's fullUrl, if available. Fall back to existing imageUrl if not.
			if (Object.prototype.hasOwnProperty.call(entity, 'image')) {
				await this.setImageUrl(entity);
			}
		} catch (error) {
			// Log any errors encountered during the execution of the function.
			console.error('Error in UserSubscriber afterEntityLoad hook:', error);
		}
	}

	/**
	 * Simulate an asynchronous operation to set the imageUrl.
	 *
	 * @param entity
	 * @returns
	 */
	private setImageUrl(entity: User): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			try {
				// Simulate async operation, e.g., fetching fullUrl from a service
				setTimeout(() => {
					entity.imageUrl = entity.image?.fullUrl ?? entity.imageUrl;
					resolve();
				});
			} catch (error) {
				console.error('UserSubscriber: Error during the setImageUrl process:', error);
				reject(null);
			}
		});
	}
}
