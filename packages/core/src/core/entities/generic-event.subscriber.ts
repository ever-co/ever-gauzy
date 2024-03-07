import { ConstructorType } from '@gauzy/common';
import { EntityName, EventSubscriber as MikroEntitySubscriberInterface } from '@mikro-orm/core';
import { LoadEvent, EntitySubscriberInterface as TypeOrmEntitySubscriberInterface } from 'typeorm';

/**
 *
 * @param Entity
 * @returns
 */
export function GenericEventSubscriber<T>(Entity: EntityName<T> | ConstructorType) {
    abstract class UniversalEventSubscriber implements MikroEntitySubscriberInterface<T>, TypeOrmEntitySubscriberInterface<T> {

        /**
         * Returns the array of entities this subscriber is subscribed to.
         */
        getSubscribedEntities(): EntityName<T>[] {
            return [Entity];
        }

        /**
         *
         * @param entity
         * @param event
         */
        afterLoad(entity: T, event?: LoadEvent<T>): void | Promise<any> {
            console.log('afterLoad UniversalSubscriber');
        }
    }

    return UniversalEventSubscriber;
}
