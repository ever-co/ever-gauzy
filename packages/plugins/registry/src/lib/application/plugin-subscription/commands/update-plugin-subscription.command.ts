import { ID } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';
import { UpdatePluginSubscriptionDTO } from '../../../shared';

export class UpdatePluginSubscriptionCommand implements ICommand {
	public static readonly type = '[Plugin Subscription] Update';

	constructor(public readonly id: ID, public readonly updateDto: UpdatePluginSubscriptionDTO) {}
}
