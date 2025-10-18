import { ICommand } from '@nestjs/cqrs';

export class CancelPluginSubscriptionCommand implements ICommand {
	public static readonly type = '[Plugin Subscription] Cancel';

	constructor(public readonly id: string, public readonly reason?: string) {}
}
