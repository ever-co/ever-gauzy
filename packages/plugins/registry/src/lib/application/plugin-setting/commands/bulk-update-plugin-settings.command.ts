import { ID } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';
import { BulkUpdatePluginSettingsDTO } from '../../../shared';

export class BulkUpdatePluginSettingsCommand implements ICommand {
	public static readonly type = '[Plugin Setting] Bulk Update';

	constructor(
		public readonly bulkUpdateDto: BulkUpdatePluginSettingsDTO,
		public readonly tenantId: ID,
		public readonly organizationId?: ID,
		public readonly userId?: ID
	) {}
}
