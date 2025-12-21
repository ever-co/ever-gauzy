import { IEvent } from '@nestjs/cqrs';
import { IPluginBilling } from '../../shared/models/plugin-billing.model';

/**
 * Domain event for when a billing becomes overdue
 */
export class PluginBillingOverdueEvent implements IEvent {
	constructor(public readonly billing: IPluginBilling) {}
}
