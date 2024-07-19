import { EventSubscriber } from 'typeorm';
import { BaseEntityEventSubscriber } from '../core/entities/subscribers/base-entity-event.subscriber';
import { Role } from './role.entity';

@EventSubscriber()
export class RoleSubscriber extends BaseEntityEventSubscriber<Role> {
	/**
	 * Indicates that this subscriber only listen to Role events.
	 */
	listenTo() {
		return Role;
	}
}
