import { ICommand } from '@nestjs/cqrs';
import { PluginTenantApprovalDTO } from '../../../shared/dto/plugin-tenant-approval.dto';

export class ApprovePluginTenantCommand implements ICommand {
	public static readonly type = '[Plugin Tenant] Approve';

	constructor(public readonly input: PluginTenantApprovalDTO) {}
}
