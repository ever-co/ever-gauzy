import { ID } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';

export class RenewPluginSubscriptionCommand implements ICommand {
	public static readonly type = '[Plugin Subscription] Renew';

	constructor(public readonly id: ID) {}
}
