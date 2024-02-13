import { BaseEvent } from './base-event';

/**
 * Type representing the possible types of BaseEntity events.
 */
export type BaseEntityEventType = 'created' | 'updated' | 'deleted';

/**
 * Enum representing the possible types of BaseEntity events.
 */
export enum BaseEntityEventTypeEnum {
    CREATED = 'created',
    UPDATED = 'updated',
    DELETED = 'deleted'
}

/**
 * Abstract class representing a base event for entities with generic types for the entity and input data.
 */
export abstract class BaseEntityEvent<Entity, Input = any> extends BaseEvent {
    public readonly entity: Entity;
    public readonly type: BaseEntityEventType;
    public readonly input?: Input;

    /**
     * Constructor for BaseEntityEvent.
     * @param entity - The entity associated with the event.
     * @param type - The type of the event ('created', 'updated', 'deleted').
     * @param input - Optional input data associated with the event.
     */
    protected constructor(
        entity: Entity,
        type: BaseEntityEventType,
        input?: Input,
    ) {
        super();
        this.entity = entity;
        this.type = type;
        this.input = input;
    }
}
