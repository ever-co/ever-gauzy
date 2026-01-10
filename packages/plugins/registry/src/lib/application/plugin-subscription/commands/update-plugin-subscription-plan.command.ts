import { ID } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';
import { UpdatePluginSubscriptionPlanDTO } from '../../../shared';

export class UpdatePluginSubscriptionPlanCommand implements ICommand {
	public static readonly type = '[Plugin Subscription Plan] Update';

	constructor(public readonly id: ID, public readonly updateDto: UpdatePluginSubscriptionPlanDTO) {}
}
