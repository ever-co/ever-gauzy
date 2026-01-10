import { ID } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';
import { CopyPluginPlanDTO } from '../../../shared';

export class CopyPluginPlanCommand implements ICommand {
	public static readonly type = '[Plugin Subscription Plan] Copy';

	constructor(
		public readonly copyDto: CopyPluginPlanDTO,
		public readonly tenantId: ID,
		public readonly organizationId?: ID,
		public readonly userId?: ID
	) {}
}
