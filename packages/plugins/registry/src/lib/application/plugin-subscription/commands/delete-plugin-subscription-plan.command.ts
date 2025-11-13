import { ID } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';

export class DeletePluginSubscriptionPlanCommand implements ICommand {
	public static readonly type = '[Plugin Subscription Plan] Delete';

	constructor(public readonly id: ID) {}
}
