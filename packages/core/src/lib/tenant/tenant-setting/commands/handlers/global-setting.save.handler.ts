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

	/**
	 * Both the REST route and the GraphQL mutation dispatch this command, so the operator check lives here:
	 * their `GLOBAL_SETTING` permission is held by every tenant's super admin.
	 */
	public async execute(command: GlobalSettingSaveCommand): Promise<ITenantSetting> {
		await this._tenantSettingService.assertMayWriteGlobalSettings();
		return this._tenantSettingService.saveGlobalSettings(command.input);
	}
}
