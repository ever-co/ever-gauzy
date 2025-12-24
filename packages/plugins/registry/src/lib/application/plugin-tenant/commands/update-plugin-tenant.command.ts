import { ID } from '@gauzy/contracts';
import { ICommand } from '@nestjs/cqrs';
import { UpdatePluginTenantDTO } from '../../../shared/dto/update-plugin-tenant.dto';

export class UpdatePluginTenantCommand implements ICommand {
	public static readonly type = '[Plugin Tenant] Update';

	constructor(public readonly id: ID, public readonly input: UpdatePluginTenantDTO) {}
}
