import { forwardRef, Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { RequestContext } from '../../../core/context';
import { SystemSettingSaveCommand } from '../system-setting.save.command';
import { SystemSettingService } from '../../system-setting.service';

@CommandHandler(SystemSettingSaveCommand)
export class SystemSettingSaveHandler implements ICommandHandler<SystemSettingSaveCommand> {
	constructor(
		@Inject(forwardRef(() => SystemSettingService))
		private readonly _systemSettingService: SystemSettingService
	) {}

	/**
	 * Executes a command to save system settings.
	 *
	 * @param {SystemSettingSaveCommand} command - A command object with settings and scope.
	 * @returns {Promise<Record<string, any>>} - The result of the save operation.
	 */
	public async execute(command: SystemSettingSaveCommand): Promise<Record<string, any>> {
		const { input, scope } = command;

		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.getOrganizationId();

		return await this._systemSettingService.saveSettings(input, scope, tenantId, organizationId);
	}
}
