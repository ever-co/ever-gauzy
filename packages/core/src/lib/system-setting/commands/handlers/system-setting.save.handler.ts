import { BadRequestException, forwardRef, Inject, UnauthorizedException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { RolesEnum, SystemSettingScope } from '@gauzy/contracts';
import { RequestContext } from '../../../core/context';
import { WrapSecrets } from '../../../core/decorators';
import { SystemSettingSaveCommand } from '../system-setting.save.command';
import { SystemSettingService } from '../../system-setting.service';
import {
	SentryConfigDTO,
	UnleashConfigDTO,
	GoogleMapsConfigDTO,
	PosthogConfigDTO,
	JitsuConfigDTO,
	GauzyAIConfigDTO,
	CloudinaryConfigDTO,
	ChatwootConfigDTO
} from '../../dto';

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

		// Security: Only SUPER_ADMIN can save GLOBAL settings
		if (scope === SystemSettingScope.GLOBAL) {
			if (!RequestContext.hasRoles([RolesEnum.SUPER_ADMIN])) {
				throw new UnauthorizedException('Only SUPER_ADMIN can modify global system settings');
			}
		}

		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();

		// Validate required IDs based on scope
		if (scope === SystemSettingScope.TENANT && !tenantId) {
			throw new BadRequestException('Tenant ID is required for TENANT scope settings');
		}

		if (scope === SystemSettingScope.ORGANIZATION) {
			if (!tenantId) {
				throw new BadRequestException('Tenant ID is required for ORGANIZATION scope settings');
			}
			if (!organizationId) {
				throw new BadRequestException('Organization ID is required for ORGANIZATION scope settings');
			}
		}

		const settings = await this._systemSettingService.saveSettings(input, scope, tenantId, organizationId);

		// Mask secrets in response
		return WrapSecrets(settings, [
			new SentryConfigDTO(),
			new UnleashConfigDTO(),
			new GoogleMapsConfigDTO(),
			new PosthogConfigDTO(),
			new JitsuConfigDTO(),
			new GauzyAIConfigDTO(),
			new CloudinaryConfigDTO(),
			new ChatwootConfigDTO()
		]);
	}
}
