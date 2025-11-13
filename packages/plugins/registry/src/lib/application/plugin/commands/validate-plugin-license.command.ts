import { ID } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';

export class ValidatePluginLicenseCommand implements ICommand {
	public static readonly type = '[Plugin License] Validate';

	constructor(
		public readonly pluginId: ID,
		public readonly licenseKey?: string,
		public readonly tenantId?: ID,
		public readonly organizationId?: ID,
		public readonly userId?: ID
	) {}
}
