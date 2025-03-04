import { EventSubscriber } from 'typeorm';
import { BaseEntityEventSubscriber } from './base-entity-event.subscriber';
import { MultiOrmEntityManager } from './entity-event-subscriber.types';
import { RequestContext } from '../../context/request-context';

@EventSubscriber()
export class BaseEntitySubscriber extends BaseEntityEventSubscriber {
	/**
	 * A hook executed before creating an entity. This function can be used to perform
	 * custom operations or transformations on the entity prior to its persistence.
	 *
	 * @param entity - The entity object that is about to be created.
	 * @param em - Optional MultiOrmEntityManager for performing additional operations.
	 * @returns A promise that resolves when all pre-create operations are complete.
	 */
	async beforeEntityCreate(entity: any, em?: MultiOrmEntityManager): Promise<void> {
		// Further pre-creation logic can be inserted here as needed.
		if (entity && 'createdByUserId' in entity) {
			entity.createdByUserId = RequestContext.currentUserId(); // Assign the current user's ID to the createdByUserId property
		}
	}

	/**
	 * A hook executed before updating an entity. This function can be used to perform
	 * custom operations or transformations on the entity prior to its persistence update.
	 *
	 * @param entity - The entity object that is about to be updated.
	 * @param em - Optional MultiOrmEntityManager for additional operations or validations.
	 * @returns A promise that resolves when all pre-update operations are complete.
	 */
	async beforeEntityUpdate(entity: any, em?: MultiOrmEntityManager): Promise<void> {
		// Additional pre-update logic can be added here as needed.
		if (entity && 'updatedByUserId' in entity) {
			entity.updatedByUserId = RequestContext.currentUserId(); // Assign the current user's ID to the updatedByUserId property
		}
	}

	/**
	 * Hook executed after an entity is soft removed (i.e., marked as deleted without being physically removed).
	 *
	 * @param entity - The entity that was soft removed.
	 * @param em - Optional MultiOrmEntityManager for executing additional operations.
	 * @returns A promise that resolves when post-soft removal tasks are complete.
	 */
	async afterEntitySoftRemove(entity: any, em?: MultiOrmEntityManager): Promise<void> {
		// Additional post-soft removal logic can be added here.
		if (entity && 'deletedByUserId' in entity) {
			entity.deletedByUserId = RequestContext.currentUserId(); // Assign the current user's ID to the deletedByUserId property
		}
	}
}
