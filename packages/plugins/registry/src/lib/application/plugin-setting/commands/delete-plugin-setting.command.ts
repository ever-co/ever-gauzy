import { ID } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';

export class DeletePluginSettingCommand implements ICommand {
	public static readonly type = '[Plugin Setting] Delete';

	constructor(
		public readonly id: ID,
		public readonly tenantId: ID,
		public readonly organizationId?: ID,
		public readonly userId?: ID
	) {}
}
