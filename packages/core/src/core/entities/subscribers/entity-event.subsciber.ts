import { EventArgs, EventSubscriber as MikroEntitySubscriberInterface } from '@mikro-orm/core';
import {
	InsertEvent,
	LoadEvent,
	RemoveEvent,
	EntitySubscriberInterface as TypeOrmEntitySubscriberInterface,
	UpdateEvent
} from 'typeorm';
import { MultiORM, MultiORMEnum, getORMType } from '../../../core/utils';
import { MultiOrmEntityManager } from './entity-event-subscriber.types';

// Get the type of the Object-Relational Mapping (ORM) used in the application.
const ormType: MultiORM = getORMType();

/**
 * Implements event handling for entity creation.
 * This class should be extended or integrated into your ORM event subscriber.
 */
export abstract class EntityEventSubscriber<Entity>
	implements MikroEntitySubscriberInterface<Entity>, TypeOrmEntitySubscriberInterface<Entity>
{
	/**
	 * Invoked when an entity is loaded in TypeORM.
	 *
	 * @param entity The loaded entity.
	 * @param event The load event details, if available.
	 * @returns {void | Promise<any>} Can perform asynchronous operations.
	 */
	async afterLoad(entity: Entity, event?: LoadEvent<Entity>): Promise<void> {
		try {
			if (entity) {
				await this.afterEntityLoad(entity, event.manager);
			}
		} catch (error) {
			console.error('EntityEventSubscriber: Error in afterLoad:', error);
		}
	}

	/**
	 * Invoked when an entity is loaded in MikroORM.
	 *
	 * @param args The event arguments provided by MikroORM.
	 * @returns {void | Promise<void>} Can perform asynchronous operations.
	 */
	async onLoad(args: EventArgs<Entity>): Promise<void> {
		try {
			if (args.entity) {
				await this.afterEntityLoad(args.entity, args.em);
			}
		} catch (error) {
			console.error('EntityEventSubscriber: Error in onLoad:', error);
		}
	}

	/**
	 * Abstract method for processing after an entity is loaded. Implement in subclasses for custom behavior.
	 *
	 * @param entity The entity that has been loaded.
	 * @param em The EntityManager, which can be either from TypeORM or MikroORM.
	 * @returns {Promise<void>}
	 */
	protected abstract afterEntityLoad(entity: Entity, em?: MultiOrmEntityManager): Promise<void>;

	/**
	 * Handles the event before an entity is created in MikroORM.
	 *
	 * @param args The event arguments provided by MikroORM.
	 * @returns {Promise<void>} - Can perform asynchronous operations.
	 */
	async beforeCreate(args: EventArgs<Entity>): Promise<void> {
		try {
			if (args.entity) {
				await this.beforeEntityCreate(args.entity, args.em);
			}
		} catch (error) {
			console.error('EntityEventSubscriber: Error in beforeCreate:', error);
		}
	}

	/**
	 * Handles the event before an entity is inserted in TypeORM.
	 *
	 * @param event The insert event provided by TypeORM.
	 * @returns {Promise<void>} - Can perform asynchronous operations.
	 */
	async beforeInsert(event: InsertEvent<Entity>): Promise<void> {
		try {
			if (event.entity) {
				await this.beforeEntityCreate(event.entity, event.manager);
			}
		} catch (error) {
			console.error('EntityEventSubscriber: Error in beforeInsert:', error);
		}
	}

	/**
	 * Abstract method for pre-creation logic of an entity. Implement in subclasses for custom actions.
	 *
	 * @param entity The entity that is about to be updated.
	 * @param em The EntityManager, which can be either from TypeORM or MikroORM.
	 * @returns {Promise<void>}
	 */
	protected abstract beforeEntityCreate(entity: Entity, em?: MultiOrmEntityManager): Promise<void>;

	/**
	 * Handles the event after an entity has been created in MikroORM.
	 *
	 * @param args - The event arguments provided by MikroORM.
	 * @returns {Promise<void>} - Can perform asynchronous operations.
	 */
	async afterCreate(args: EventArgs<Entity>): Promise<void> {
		try {
			if (args.entity) {
				await this.afterEntityCreate(args.entity, args.em);
			}
		} catch (error) {
			console.error('EntityEventSubscriber: Error in afterCreate:', error);
		}
	}

	/**
	 * Handles the event after an entity has been inserted in TypeORM.
	 *
	 * @param event - The insert event provided by TypeORM.
	 * @returns {Promise<void>} - Can perform asynchronous operations.
	 */
	async afterInsert(event: InsertEvent<Entity>): Promise<void> {
		try {
			if (event.entity) {
				await this.afterEntityCreate(event.entity, event.manager);
			}
		} catch (error) {
			console.error('EntityEventSubscriber: Error in afterInsert:', error);
		}
	}

	/**
	 * Abstract method for post-creation actions on an entity. Override in subclasses to define behavior.
	 *
	 * @param entity The entity that is about to be created.
	 * @param em The EntityManager, which can be either from TypeORM or MikroORM.
	 * @returns {Promise<void>}
	 */
	protected abstract afterEntityCreate(entity: Entity, em?: MultiOrmEntityManager): Promise<void>;

	/**
	 * Handles the 'before update' event for both MikroORM and TypeORM entities. It determines the
	 * type of ORM being used and appropriately casts the event to either EventArgs<Entity> or UpdateEvent<Entity>.
	 *
	 * @param event The event object which can be either EventArgs<Entity> from MikroORM or UpdateEvent<Entity> from TypeORM.
	 * @returns {Promise<void>} A promise that resolves when the pre-update process is complete. Any errors during processing are caught and logged.
	 */
	async beforeUpdate(event: EventArgs<Entity> | UpdateEvent<Entity>): Promise<void> {
		try {
			let entity: Entity;
			let entityManager: MultiOrmEntityManager;

			switch (ormType) {
				case MultiORMEnum.MikroORM:
					entity = (event as EventArgs<Entity>).entity;
					entityManager = (event as EventArgs<Entity>).em;
					break;
				case MultiORMEnum.TypeORM:
					entity = (event as UpdateEvent<Entity>).entity as Entity;
					entityManager = (event as UpdateEvent<Entity>).manager;
					break;
				default:
					throw new Error(`Unsupported ORM type: ${ormType}`);
			}

			if (entity) {
				await this.beforeEntityUpdate(entity, entityManager);
			}
		} catch (error) {
			console.error('EntityEventSubscriber: Error in beforeUpdate:', error);
		}
	}

	/**
	 * Abstract method for actions before updating an entity. Override in subclasses for specific logic.
	 *
	 * @param entity The entity that is about to be updated.
	 * @param em The EntityManager, which can be either from TypeORM or MikroORM.
	 * @returns {Promise<void>}
	 */
	protected abstract beforeEntityUpdate(entity: Entity, em?: MultiOrmEntityManager): Promise<void>;

	/**
	 * Handles the 'after update' event for both MikroORM and TypeORM entities. It determines the
	 * type of ORM being used and appropriately casts the event to either EventArgs<Entity> or UpdateEvent<Entity>.
	 *
	 * @param event
	 * @returns {Promise<void>} A promise that resolves when the post-update process is complete. Any errors during processing are caught and logged.
	 */
	async afterUpdate(event: EventArgs<Entity> | UpdateEvent<Entity>): Promise<void> {
		try {
			let entity: Entity;
			let entityManager: MultiOrmEntityManager;

			switch (ormType) {
				case MultiORMEnum.MikroORM:
					entity = (event as EventArgs<Entity>).entity;
					entityManager = (event as EventArgs<Entity>).em;
					break;
				case MultiORMEnum.TypeORM:
					entity = (event as UpdateEvent<Entity>).entity as Entity;
					entityManager = (event as UpdateEvent<Entity>).manager;
					break;
				default:
					throw new Error(`Unsupported ORM type: ${ormType}`);
			}

			if (entity) {
				await this.afterEntityUpdate(entity, entityManager);
			}
		} catch (error) {
			console.error('EntityEventSubscriber: Error in afterUpdate:', error);
		}
	}

	/**
	 * Abstract method for actions after updating an entity. Override in subclasses for specific logic.
	 *
	 * @param entity The entity that is about to be updated.
	 * @param em The EntityManager, which can be either from TypeORM or MikroORM.
	 * @returns {Promise<void>}
	 */
	protected abstract afterEntityUpdate(entity: Entity, em?: MultiOrmEntityManager): Promise<void>;

	/**
	 * Invoked when an entity is deleted in MikroORM.
	 *
	 * @param args The details of the delete event, including the deleted entity.
	 * @returns {void | Promise<any>} Can perform asynchronous operations.
	 */
	async afterDelete(event: EventArgs<Entity>): Promise<void> {
		try {
			if (event.entity) {
				await this.afterEntityDelete(event.entity, event.em);
			}
		} catch (error) {
			console.error('EntityEventSubscriber: Error in afterDelete:', error);
		}
	}

	/**
	 * Invoked when an entity is removed in TypeORM.
	 *
	 * @param event The remove event details, including the removed entity.
	 * @returns {Promise<void>} Can perform asynchronous operations.
	 */
	async afterRemove(event: RemoveEvent<Entity>): Promise<void> {
		try {
			if (event.entity && event.entityId) {
				event.entity['id'] = event.entityId;
				await this.afterEntityDelete(event.entity, event.manager);
			}
		} catch (error) {
			console.error('EntityEventSubscriber: Error in afterRemove:', error);
		}
	}

	/**
	 * Abstract method for processing after an entity is deleted. Implement in subclasses for custom behavior.
	 *
	 * @param entity The entity that has been deleted.
	 * @param em The EntityManager, which can be either from TypeORM or MikroORM.
	 * @returns {Promise<void>}
	 */
	protected abstract afterEntityDelete(entity: Entity, em?: MultiOrmEntityManager): Promise<void>;

	/**
	 * Called after entity is soft removed from the database.
	 *
	 * @param event The remove event details, including the removed entity.
	 * @returns {Promise<void>} Can perform asynchronous operations.
	 */
	async afterSoftRemove(event: RemoveEvent<Entity>): Promise<void> {
		try {
			if (event.entity && event.entityId) {
				await this.afterEntitySoftRemove(event.entity, event.manager);
			}
		} catch (error) {
			console.error('EntityEventSubscriber: Error in afterSoftRemove:', error);
		}
	}

	/**
	 * Abstract method for processing after an entity is soft removed. Implement in subclasses for custom behavior.
	 *
	 * @param entity The entity that has been soft removed.
	 * @param em The EntityManager, which can be either from TypeORM or MikroORM.
	 *
	 */
	protected abstract afterEntitySoftRemove(entity: Entity, em?: MultiOrmEntityManager): Promise<void>;
}
