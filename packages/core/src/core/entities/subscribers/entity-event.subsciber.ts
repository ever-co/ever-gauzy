import { EventArgs, EventSubscriber as MikroEntitySubscriberInterface } from '@mikro-orm/core';
import { MultiORM, MultiORMEnum, getORMType } from '../../../core/utils';
import { InsertEvent, LoadEvent, EntitySubscriberInterface as TypeOrmEntitySubscriberInterface, UpdateEvent } from 'typeorm';

// Get the type of the Object-Relational Mapping (ORM) used in the application.
const ormType: MultiORM = getORMType();

/**
 * Implements event handling for entity creation.
 * This class should be extended or integrated into your ORM event subscriber.
 */
export abstract class EntityEventSubscriber<Entity> implements MikroEntitySubscriberInterface<Entity>, TypeOrmEntitySubscriberInterface<Entity> {

    /**
     * Handles the event before an entity is created in MikroORM.
     *
     * @param args The event arguments provided by MikroORM.
     * @returns {Promise<void>} - Can perform asynchronous operations.
     */
    async beforeCreate(args: EventArgs<Entity>): Promise<void> {
        try {
            await this.beforeEntityCreate(args.entity);
        } catch (error) {
            console.error("Error in beforeCreate:", error);
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
            await this.beforeEntityCreate(event.entity);
        } catch (error) {
            console.error("Error in beforeInsert:", error);
        }
    }

    /**
     * Abstract method for pre-creation logic of an entity. Implement in subclasses for custom actions.
     *
     * @param entity The entity that is about to be updated.
     * @returns {Promise<void>}
     */
    protected abstract beforeEntityCreate(entity: Entity): Promise<void>;

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
            switch (ormType) {
                case MultiORMEnum.MikroORM:
                    entity = (event as EventArgs<Entity>).entity;
                    break;
                case MultiORMEnum.TypeORM:
                    entity = (event as UpdateEvent<Entity>).entity as Entity;
                    break;
                default:
                    throw new Error(`Unsupported ORM type: ${ormType}`);
            }
            await this.beforeEntityUpdate(entity);
        } catch (error) {
            console.error("Error in beforeUpdate:", error);
        }
    }

    /**
     * Abstract method for actions before updating an entity. Override in subclasses for specific logic.
     *
     * @param entity The entity that is about to be updated.
     * @returns {Promise<void>}
     */
    protected abstract beforeEntityUpdate(entity: Entity): Promise<void>;

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
     * Abstract method for post-creation actions on an entity. Override in subclasses to define behavior.
     *
     * @param entity The entity that is about to be created.
     * @returns {Promise<void>}
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
     * Abstract method for processing after an entity is loaded. Implement in subclasses for custom behavior.
     *
     * @param entity The entity that has been loaded.
     * @returns {Promise<void>}
     */
    protected abstract afterEntityLoad(entity: Entity): Promise<void>;
}
