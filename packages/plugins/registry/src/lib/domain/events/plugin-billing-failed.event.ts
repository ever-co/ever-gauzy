import { IEvent } from '@nestjs/cqrs';
import { IPluginBilling } from '../../shared/models/plugin-billing.model';

/**
 * Domain event for when a billing payment fails
 */
export class PluginBillingFailedEvent implements IEvent {
	constructor(
		public readonly billing: IPluginBilling,
		public readonly reason: string
	) {}
}
