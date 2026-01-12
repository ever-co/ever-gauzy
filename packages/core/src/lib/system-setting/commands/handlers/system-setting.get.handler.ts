import { forwardRef, Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { SystemSettingScope } from '@gauzy/contracts';
import { RequestContext } from '../../../core/context';
import { WrapSecrets } from '../../../core/decorators';
import { SystemSettingGetCommand, SystemSettingGetByScopeCommand } from '../system-setting.get.command';
import { SystemSettingService } from '../../system-setting.service';
import { SECRET_DTO_LIST } from '../../dto/secret-dto-list';

@CommandHandler(SystemSettingGetCommand)
export class SystemSettingGetHandler implements ICommandHandler<SystemSettingGetCommand> {
	constructor(
		@Inject(forwardRef(() => SystemSettingService))
		private readonly _systemSettingService: SystemSettingService
	) {}

	/**
	 * Executes the retrieval of system settings with cascade resolution.
	 *
	 * @param {SystemSettingGetCommand} command - The command containing setting names.
	 * @returns {Promise<Record<string, any>>} - Returns an object containing the resolved settings with secrets wrapped.
	 */
	public async execute(command: SystemSettingGetCommand): Promise<Record<string, any>> {
		const { names } = command;

		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();

		let settings = await this._systemSettingService.getSettingsWithCascade(names, tenantId, organizationId);

		return WrapSecrets(settings, SECRET_DTO_LIST);
	}
}

@CommandHandler(SystemSettingGetByScopeCommand)
export class SystemSettingGetByScopeHandler implements ICommandHandler<SystemSettingGetByScopeCommand> {
	constructor(
		@Inject(forwardRef(() => SystemSettingService))
		private readonly _systemSettingService: SystemSettingService
	) {}

	/**
	 * Executes the retrieval of system settings for a specific scope.
	 *
	 * @param {SystemSettingGetByScopeCommand} command - The command containing scope.
	 * @returns {Promise<Record<string, any>>} - Returns an object containing the settings with secrets wrapped.
	 */
	public async execute(command: SystemSettingGetByScopeCommand): Promise<Record<string, any>> {
		const { scope } = command;

		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();
		const effectiveScope = scope || SystemSettingScope.TENANT;

		let settings = await this._systemSettingService.getSettingsByScope(effectiveScope, tenantId, organizationId);

		return WrapSecrets(settings, SECRET_DTO_LIST);
	}
}
