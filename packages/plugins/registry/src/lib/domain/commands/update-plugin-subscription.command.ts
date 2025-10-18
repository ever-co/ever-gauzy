import { ICommand } from '@nestjs/cqrs';
import { UpdatePluginSubscriptionDTO } from '../../shared/dto/plugin-subscription.dto';

export class UpdatePluginSubscriptionCommand implements ICommand {
	public static readonly type = '[Plugin Subscription] Update';

	constructor(public readonly id: string, public readonly updateDto: UpdatePluginSubscriptionDTO) {}
}
