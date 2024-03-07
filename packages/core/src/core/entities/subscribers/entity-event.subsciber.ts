import { EventArgs, EventSubscriber as MikroEntitySubscriberInterface } from '@mikro-orm/core';
import { InsertEvent, LoadEvent, EntitySubscriberInterface as TypeOrmEntitySubscriberInterface } from 'typeorm';

/**
 * Implements event handling for entity creation.
 * This class should be extended or integrated into your ORM event subscriber.
 */
export abstract class EntityEventSubscriber<Entity> implements MikroEntitySubscriberInterface<Entity>, TypeOrmEntitySubscriberInterface<Entity> {

    /**
     * Handles the event after an entity has been created in MikroORM.
     *
     * @param args - The event arguments provided by MikroORM.
     * @returns {Promise<void>} - Can perform asynchronous operations.
     */
    async afterCreate(args: EventArgs<Entity>): Promise<void> {
        try {
            await this.afterEntityCreate(args.entity);
        } catch (error) {
            console.error("Error in afterCreate:", error);
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
            await this.afterEntityCreate(event.entity);
        } catch (error) {
            console.error("Error in afterInsert:", error);
        }
    }

    /**
     * Common method invoked after an entity is created or inserted.
     * Extend this method to implement specific logic after entity creation.
     * This method should handle any asynchronous operations and errors.
     */
    protected abstract afterEntityCreate(entity: Entity): Promise<void>;

    /**
      * Invoked when an entity is loaded in TypeORM.
      *
      * @param entity The loaded entity.
      * @param event The load event details, if available.
      * @returns {void | Promise<any>} Can perform asynchronous operations.
      */
    async afterLoad(entity: Entity, event?: LoadEvent<Entity>): Promise<void> {
        try {
            await this.afterEntityLoad(entity);
        } catch (error) {
            console.error("Error in afterLoad:", error);
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
            await this.afterEntityLoad(args.entity);
        } catch (error) {
            console.error("Error in onLoad:", error);
        }
    }

    /**
     * Common method to handle logic after an entity is loaded.
     * This method should be implemented in subclasses to define specific
     * operations to be performed when an entity is loaded.
     *
     * @param entity The entity that has been loaded.
     * @returns {Promise<void>} Can perform asynchronous operations.
     */
    protected abstract afterEntityLoad(entity: Entity): Promise<void>;
}
