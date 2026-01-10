import { ICommand } from '@nestjs/cqrs';
import { PluginTenantBulkOperationDTO } from '../../../shared/dto/plugin-tenant-bulk-operation.dto';

export class BulkUpdatePluginTenantCommand implements ICommand {
	public static readonly type = '[Plugin Tenant] Bulk Update';

	constructor(public readonly input: PluginTenantBulkOperationDTO) {}
}
