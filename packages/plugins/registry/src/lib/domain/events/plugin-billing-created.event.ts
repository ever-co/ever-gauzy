import { IEvent } from '@nestjs/cqrs';
import { IPluginBilling } from '../../shared/models/plugin-billing.model';

/**
 * Domain event for when a billing record is created
 */
export class PluginBillingCreatedEvent implements IEvent {
	constructor(public readonly billing: IPluginBilling) {}
}
