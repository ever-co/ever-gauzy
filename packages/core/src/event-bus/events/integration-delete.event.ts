import { RequestContext } from '../../core/context';
import { IntegrationTenant } from '../../core/entities/internal';
import { BaseEvent } from '../base-event';

/**
 * Event class representing an integration delete event.
 */
export class IntegrationDeleteEvent extends BaseEvent {
	/**
	 * Constructs an IntegrationDeleteEvent.
	 *
	 * @param ctx - The request context associated with the event.
	 * @param integration - The integration tenant that is being deleted.
	 */
	constructor(public readonly ctx: RequestContext, public readonly integration: IntegrationTenant) {
		super();
	}
}
