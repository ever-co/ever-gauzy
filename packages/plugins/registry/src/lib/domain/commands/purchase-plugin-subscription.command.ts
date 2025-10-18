import { ICommand } from '@nestjs/cqrs';
import { PurchasePluginSubscriptionDTO } from '../../shared/dto/plugin-subscription.dto';

export class PurchasePluginSubscriptionCommand implements ICommand {
	public static readonly type = '[Plugin Subscription] Purchase';

	constructor(
		public readonly purchaseDto: PurchasePluginSubscriptionDTO,
		public readonly tenantId: string,
		public readonly organizationId?: string,
		public readonly userId?: string
	) {}
}
