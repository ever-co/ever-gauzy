import { ID } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';

export class SubmitPluginForReviewCommand implements ICommand {
	public static readonly type = '[Plugin] Submit For Review';

	constructor(
		public readonly pluginId: ID,
		public readonly reviewNotes?: string,
		public readonly tenantId?: ID,
		public readonly organizationId?: ID,
		public readonly userId?: ID
	) {}
}
