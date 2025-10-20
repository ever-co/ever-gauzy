import { ICommand } from '@nestjs/cqrs';
import { BulkUpdatePluginSettingsDTO } from '../../shared/dto/plugin-setting.dto';
import { ID } from '@gauzy/contracts';

export class BulkUpdatePluginSettingsCommand implements ICommand {
	public static readonly type = '[Plugin Setting] Bulk Update';

	constructor(
		public readonly bulkUpdateDto: BulkUpdatePluginSettingsDTO,
		public readonly tenantId: ID,
		public readonly organizationId?: ID,
		public readonly userId?: ID
	) {}
}
