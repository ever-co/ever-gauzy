import { RequestContext } from '../core/context';
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
	public readonly ctx: RequestContext;
	public readonly input?: Input;

	/**
	 * Constructor for the BaseEntityEvent class.
	 *
	 * @param entity The entity associated with the event.
	 * @param type The type of event (created, updated, deleted, etc.).
	 * @param ctx The request context associated with the event.
	 * @param input Optional input data associated with the event.
	 */
	protected constructor(entity: Entity, type: BaseEntityEventType, ctx: RequestContext, input?: Input) {
		super();
		this.entity = entity;
		this.type = type;
		this.ctx = ctx;
		this.input = input;
	}
}
