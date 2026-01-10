import { ICommand } from '@nestjs/cqrs';

/**
 * Command for processing payment for a plugin billing record
 */
export class PluginBillingProcessPaymentCommand implements ICommand {
	static readonly type = '[PluginBilling] Process Payment';

	constructor(
		public readonly billingId: string,
		public readonly paymentInput: {
			paymentMethod: string;
			paymentReference?: string;
			metadata?: Record<string, any>;
		}
	) {}
}
