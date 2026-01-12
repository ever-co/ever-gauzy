import { UnauthorizedException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { RolesEnum, SystemSettingScope } from '@gauzy/contracts';
import { RequestContext } from '../../../core/context';
import { WrapSecrets } from '../../../core/decorators';
import { SystemSettingSaveCommand } from '../system-setting.save.command';
import { SystemSettingService } from '../../system-setting.service';
import { SECRET_DTO_LIST } from '../../dto/secret-dto-list';

@CommandHandler(SystemSettingSaveCommand)
export class SystemSettingSaveHandler implements ICommandHandler<SystemSettingSaveCommand> {
	constructor(private readonly _systemSettingService: SystemSettingService) {}

	/**
	 * Executes a command to save system settings.
	 *
	 * @param {SystemSettingSaveCommand} command - A command object with settings and scope.
	 * @returns {Promise<Record<string, any>>} - The result of the save operation.
	 */
	public async execute(command: SystemSettingSaveCommand): Promise<Record<string, any>> {
		const { input, scope } = command;

		// Security: Only SUPER_ADMIN can save GLOBAL settings
		if (scope === SystemSettingScope.GLOBAL) {
			if (!RequestContext.hasRoles([RolesEnum.SUPER_ADMIN])) {
				throw new UnauthorizedException('Only SUPER_ADMIN can modify global system settings');
			}
		}

		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();

		// Note: Scope/ID validation is handled by SystemSettingService.saveSettings()
		const settings = await this._systemSettingService.saveSettings(input, scope, tenantId, organizationId);

		// Mask secrets in response
		return WrapSecrets(settings, SECRET_DTO_LIST);
	}
}
