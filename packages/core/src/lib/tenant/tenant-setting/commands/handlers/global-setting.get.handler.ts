import { forwardRef, Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { TenantSettingService } from '../../tenant-setting.service';
import { GlobalSettingGetCommand } from '../global-setting.get.command';

@CommandHandler(GlobalSettingGetCommand)
export class GlobalSettingGetHandler implements ICommandHandler<GlobalSettingGetCommand> {
	constructor(
		@Inject(forwardRef(() => TenantSettingService))
		private readonly _tenantSettingService: TenantSettingService
	) {}

	public async execute(command: GlobalSettingGetCommand): Promise<Record<string, string>> {
		return this._tenantSettingService.getGlobalSettings(command.names);
	}
}
