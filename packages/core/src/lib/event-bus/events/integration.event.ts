import { IIntegrationTenantCreateInput, IIntegrationTenantUpdateInput } from '@gauzy/contracts';
import { RequestContext } from '../../core/context';
import { IntegrationTenant } from '../../core/entities/internal';
import { BaseEntityEvent, BaseEntityEventType } from '../base-entity-event';

type IntegrationInputTypes = IIntegrationTenantCreateInput | IIntegrationTenantUpdateInput;

/**
 * Event class representing an integration events.
 */
export class IntegrationEvent extends BaseEntityEvent<IntegrationTenant, IntegrationInputTypes> {
	/**
	 * Creates an instance of IntegrationEvent.
	 *
	 * @param {RequestContext} ctx - The context object containing information about the request.
	 * @param {IntegrationTenant} entity - The entity associated with the event.
	 * @param {BaseEntityEventType} type - The type of the event.
	 * @param {IntegrationInputTypes} [input] - Optional input data for the event.
	 */
	constructor(
		ctx: RequestContext,
		entity: IntegrationTenant,
		type: BaseEntityEventType,
		input?: IntegrationInputTypes
	) {
		super(entity, type, ctx, input);
	}
}
