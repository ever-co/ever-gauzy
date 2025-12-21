import { ID } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';

export class GeneratePluginLicenseCommand implements ICommand {
	public static readonly type = '[Plugin License] Generate';

	constructor(
		public readonly subscriptionId: ID,
		public readonly pluginId: ID,
		public readonly tenantId: ID,
		public readonly organizationId?: ID,
		public readonly userId?: ID
	) {}
}
