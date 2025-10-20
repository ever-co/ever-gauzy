import { ICommand } from '@nestjs/cqrs';
import { UpdatePluginSubscriptionDTO } from '../../shared/dto/plugin-subscription.dto';
import { ID } from '@gauzy/contracts';

export class UpdatePluginSubscriptionCommand implements ICommand {
	public static readonly type = '[Plugin Subscription] Update';

	constructor(public readonly id: ID, public readonly updateDto: UpdatePluginSubscriptionDTO) {}
}
