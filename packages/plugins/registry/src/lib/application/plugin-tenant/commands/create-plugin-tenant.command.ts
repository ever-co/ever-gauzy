import { ICommand } from '@nestjs/cqrs';
import { CreatePluginTenantDTO } from '../../../shared/dto/create-plugin-tenant.dto';

export class CreatePluginTenantCommand implements ICommand {
	public static readonly type = '[Plugin Tenant] Create';

	constructor(public readonly input: CreatePluginTenantDTO) {}
}
