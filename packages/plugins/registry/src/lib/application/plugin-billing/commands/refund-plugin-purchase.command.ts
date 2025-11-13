import { ID } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';

export class RefundPluginPurchaseCommand implements ICommand {
	public static readonly type = '[Plugin Purchase] Refund';

	constructor(
		public readonly subscriptionId: ID,
		public readonly refundReason: string,
		public readonly refundAmount?: number,
		public readonly tenantId?: ID,
		public readonly organizationId?: string,
		public readonly userId?: ID
	) {}
}
