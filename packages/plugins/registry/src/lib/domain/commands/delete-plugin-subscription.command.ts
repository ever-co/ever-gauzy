import { ID } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';

export class DeletePluginSubscriptionCommand implements ICommand {
	public static readonly type = '[Plugin Subscription] Delete';

	constructor(public readonly id: ID) {}
}
