import { EntityName } from '@mikro-orm/core';
import { EntityEventSubscriber } from './entity-event.subsciber';
import { IEntityEventSubscriber } from './entity-event-subscriber.types';

/**
 * An abstract class that provides a base implementation for IEntityEventSubscriber.
 * This class can be extended to create specific event subscribers for different entities.
 */
export abstract class BaseEntityEventSubscriber<Entity> extends EntityEventSubscriber<Entity> implements IEntityEventSubscriber<Entity>   {

    /**
     * An optional method that can be implemented by subclasses.
     * It should return either a constructor function (a class) or a string
     * representing the name of the entity to which this subscriber will listen.
     * The default implementation returns undefined.
     *
     * @returns {Function | string | undefined} The entity class or its name, or undefined.
     */
    listenTo(): Function | string | undefined {
        return;
    }

    /**
     * Returns the array of entities this subscriber is subscribed to.
     * If listenTo is not defined, it returns an empty array.
     *
     * @returns {EntityName<Entity>[]} An array containing the entities to which this subscriber listens.
     */
    getSubscribedEntities(): EntityName<Entity>[] {
        if (this.listenTo()) {
            return [this.listenTo()];
        }
        return [];
    }

    /**
     * Called before a new entity is persisted. Override in subclasses to define custom pre-creation logic.
     *
     * @param entity The entity about to be created.
     * @returns {Promise<void>}
     */
    async beforeEntityCreate(entity: Entity): Promise<void> {
        // Default empty implementation
    }

    /**
     * Invoked before an entity update. Use in subclasses for specific update preparation.
     *
     * @param entity The entity being updated.
     * @returns {Promise<void>}
     */
    async beforeEntityUpdate(entity: Entity): Promise<void> {
        // Default empty implementation
    }

    /**
     * Executed after an entity is created. Subclasses can override for post-creation actions.
     *
     * @param entity The newly created entity.
     * @returns {Promise<void>}
     */
    async afterEntityCreate(entity: Entity): Promise<void> {
        // Default empty implementation
    }

    /**
     * Called following the loading of an entity. Ideal for post-load processing in subclasses.
     *
     * @param entity The entity that was loaded.
     * @returns {Promise<void>}
     */
    async afterEntityLoad(entity: Entity): Promise<void> {
        // Default empty implementation
    }
}
