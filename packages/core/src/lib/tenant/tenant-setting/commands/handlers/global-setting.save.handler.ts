import { forwardRef, Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ITenantSetting } from '@gauzy/contracts';
import { TenantSettingService } from '../../tenant-setting.service';
import { GlobalSettingSaveCommand } from '../global-setting.save.command';

@CommandHandler(GlobalSettingSaveCommand)
export class GlobalSettingSaveHandler implements ICommandHandler<GlobalSettingSaveCommand> {
	constructor(
		@Inject(forwardRef(() => TenantSettingService))
		private readonly _tenantSettingService: TenantSettingService
	) {}

	public async execute(command: GlobalSettingSaveCommand): Promise<ITenantSetting> {
		return this._tenantSettingService.saveGlobalSettings(command.input);
	}
}
