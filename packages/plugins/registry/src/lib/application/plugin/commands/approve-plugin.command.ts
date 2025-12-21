import { ID } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';

export class ApprovePluginCommand implements ICommand {
	public static readonly type = '[Plugin] Approve';

	constructor(
		public readonly pluginId: ID,
		public readonly reviewerId: ID,
		public readonly approvalNotes?: string,
		public readonly tenantId?: ID,
		public readonly organizationId?: ID
	) {}
}
