import { ICommand } from '@nestjs/cqrs';
import { PurchasePluginSubscriptionDTO } from '../../shared/dto/plugin-subscription.dto';
import { ID } from '@gauzy/contracts';

export class PurchasePluginSubscriptionCommand implements ICommand {
	public static readonly type = '[Plugin Subscription] Purchase';

	constructor(
		public readonly purchaseDto: PurchasePluginSubscriptionDTO,
		public readonly tenantId: ID,
		public readonly organizationId?: ID,
		public readonly userId?: ID
	) {}
}
