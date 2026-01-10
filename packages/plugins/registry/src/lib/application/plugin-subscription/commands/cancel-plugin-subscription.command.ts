import { ID } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';

export class CancelPluginSubscriptionCommand implements ICommand {
	public static readonly type = '[Plugin Subscription] Cancel';

	constructor(public readonly id: ID, public readonly reason?: string) {}
}
