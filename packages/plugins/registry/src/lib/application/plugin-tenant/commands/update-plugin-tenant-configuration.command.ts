import { ICommand } from '@nestjs/cqrs';
import { PluginTenantConfigurationDTO } from '../../../shared/dto/plugin-tenant-configuration.dto';

export class UpdatePluginTenantConfigurationCommand implements ICommand {
	public static readonly type = '[Plugin Tenant] Update Configuration';

	constructor(public readonly input: PluginTenantConfigurationDTO) {}
}
