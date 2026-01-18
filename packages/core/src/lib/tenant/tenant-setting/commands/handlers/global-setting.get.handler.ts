import { forwardRef, Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { TenantSettingService } from '../../tenant-setting.service';
import { GlobalSettingGetCommand } from '../global-setting.get.command';
import { WrapSecrets } from '../../../../core/decorators';
import { MonitoringProviderConfigDTO } from '../../dto';

@CommandHandler(GlobalSettingGetCommand)
export class GlobalSettingGetHandler implements ICommandHandler<GlobalSettingGetCommand> {
	constructor(
		@Inject(forwardRef(() => TenantSettingService))
		private readonly _tenantSettingService: TenantSettingService
	) {}

	public async execute(command: GlobalSettingGetCommand): Promise<Record<string, any>> {
		const settings = await this._tenantSettingService.getGlobalSettings(command.names);

		// Mask secret values before returning to client
		return WrapSecrets(settings, new MonitoringProviderConfigDTO());
	}
}
