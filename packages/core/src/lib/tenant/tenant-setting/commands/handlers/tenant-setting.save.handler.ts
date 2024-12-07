import { forwardRef, Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { RequestContext } from '../../../../core/context';
import { TenantSettingService } from './../../tenant-setting.service';
import { TenantSettingSaveCommand } from '../tenant-setting.save.command';

@CommandHandler(TenantSettingSaveCommand)
export class TenantSettingSaveHandler implements ICommandHandler<TenantSettingSaveCommand> {

	constructor(
		@Inject(forwardRef(() => TenantSettingService))
		private readonly _tenantSettingService: TenantSettingService
	) { }

	/**
	 * Executes a command to save tenant settings. Delegates to _tenantSettingService,
	 * using the current tenant ID from RequestContext or the one provided in the command.
	 *
	 * @param command A TenantSettingSaveCommand object with settings and tenant ID.
	 * @returns The result of the save operation from _tenantSettingService.
	 */
	public async execute(command: TenantSettingSaveCommand) {
		const { input, tenantId } = command;
		return await this._tenantSettingService.saveSettings(
			input,
			RequestContext.currentTenantId() || tenantId
		);
	}
}
