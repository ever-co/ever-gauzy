import { ID } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';

export class UnpublishPluginCommand implements ICommand {
	public static readonly type = '[Plugin] Unpublish';

	constructor(
		public readonly pluginId: ID,
		public readonly reason?: string,
		public readonly tenantId?: ID,
		public readonly organizationId?: ID,
		public readonly userId?: ID
	) {}
}
