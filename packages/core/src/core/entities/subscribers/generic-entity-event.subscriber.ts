import { EntityName } from '@mikro-orm/core';
import { EntityEventSubscriber } from './entity-event.subsciber';
import { IEntityEventSubscriber } from './entity-event-subscriber.types';

/**
 * An abstract class that implements MikroEntitySubscriberInterface and
 * TypeOrmEntitySubscriberInterface for generic event subscription.
 */
export abstract class GenericEntityEventSubscriber<Entity> extends EntityEventSubscriber<Entity> implements IEntityEventSubscriber<Entity>   {

    /**
     * An abstract method that should be implemented by subclasses.
     * It should return either a constructor function (a class) or a string
     * representing the name of the entity to which this subscriber will listen.
     *
     * @returns {Function | string} The entity class or its name.
     */
    abstract listenTo(): Function | string;

    /**
     * Returns the array of entities this subscriber is subscribed to.
     * If listenTo is not defined, it returns an empty array.
     *
     * @returns {EntityName<Entity>[]} An array containing the entities to which this subscriber listens.
     */
    getSubscribedEntities(): EntityName<Entity>[] {
        if (this.listenTo) {
            return [this.listenTo()];
        }
        return [];
    }

    /**
     * Default implementation of the after entity creation event.
     * Subclasses can override this method.
     *
     * @param entity The entity that was created.
     * @returns {Promise<void>}
     */
    async afterEntityCreate(entity: Entity): Promise<void> {
        // Default empty implementation
    }

    /**
     * Default implementation of the after entity load event.
     * Subclasses can override this method.
     *
     * @param entity The entity that was loaded.
     * @returns {Promise<void>}
     */
    async afterEntityLoad(entity: Entity): Promise<void> {
        // Default empty implementation
    }
}
