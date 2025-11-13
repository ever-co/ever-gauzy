import { ID } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';

export class RejectPluginCommand implements ICommand {
	public static readonly type = '[Plugin] Reject';

	constructor(
		public readonly pluginId: ID,
		public readonly reviewerId: ID,
		public readonly rejectionReason: string,
		public readonly rejectionNotes?: string,
		public readonly tenantId?: ID,
		public readonly organizationId?: ID
	) {}
}
