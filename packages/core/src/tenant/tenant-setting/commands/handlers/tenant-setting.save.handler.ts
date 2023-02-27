import { forwardRef, Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { TenantSettingService } from './../../tenant-setting.service';
import { TenantSettingSaveCommand } from '../tenant-setting.save.command';
import { RequestContext } from 'core';

@CommandHandler(TenantSettingSaveCommand)
export class TenantSettingSaveHandler implements ICommandHandler<TenantSettingSaveCommand> {
	constructor(
		@Inject(forwardRef(() => TenantSettingService))
		private readonly _tenantSettingService: TenantSettingService
	) {}

	public async execute(command: TenantSettingSaveCommand) {
		const { input, tenantId } = command;
		return await this._tenantSettingService.saveSettings(input, RequestContext.currentTenantId() || tenantId);
	}
}
