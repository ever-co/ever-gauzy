import { ICommand } from '@nestjs/cqrs';
import { CreatePluginSubscriptionDTO } from '../../../shared';

export class CreatePluginSubscriptionCommand implements ICommand {
	public static readonly type = '[Plugin Subscription] Create';

	constructor(public readonly createDto: CreatePluginSubscriptionDTO) {}
}
