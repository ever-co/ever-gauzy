import { IEvent } from '@nestjs/cqrs';
import { IPluginBilling } from '../../shared/models/plugin-billing.model';

/**
 * Domain event for when a billing payment is successful
 */
export class PluginBillingPaidEvent implements IEvent {
	constructor(public readonly billing: IPluginBilling, public readonly paymentReference?: string) {}
}
