import { BadRequestException, forwardRef, Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { RequestContext } from '../../../../core/context';
import { refusalForStorageSettings } from '../../../../core/file-storage/storage-endpoint-policy';
import { assertMayWriteTenantSettings } from '../../operator-only-tenant-settings';
import { TenantSettingService } from './../../tenant-setting.service';
import { TenantSettingSaveCommand } from '../tenant-setting.save.command';

@CommandHandler(TenantSettingSaveCommand)
export class TenantSettingSaveHandler implements ICommandHandler<TenantSettingSaveCommand> {
	constructor(
		@Inject(forwardRef(() => TenantSettingService))
		private readonly _tenantSettingService: TenantSettingService
	) {}

	/**
	 * Executes a command to save tenant settings. Delegates to _tenantSettingService,
	 * using the current tenant ID from RequestContext or the one provided in the command.
	 *
	 * @param command A TenantSettingSaveCommand object with settings and tenant ID.
	 * @returns The result of the save operation from _tenantSettingService.
	 */
	public async execute(command: TenantSettingSaveCommand) {
		const tenantId = RequestContext.currentTenantId() ?? command.tenantId;

		if (!tenantId) {
			throw new Error('Tenant ID is required to save tenant settings.');
		}

		// An organization's Documents storage limit is the installation operator's to set, not the tenant's: every
		// tenant admin holds `TENANT_SETTING`, so `POST /tenant-setting/dynamic` and its GraphQL fields could lift it.
		assertMayWriteTenantSettings(Object.keys(command.input ?? {}));

		// The API connects to the storage endpoints a tenant names: they must point at a public host.
		const refusal = refusalForStorageSettings(command.input as Record<string, unknown>);
		if (refusal) {
			throw new BadRequestException(refusal);
		}

		return this._tenantSettingService.saveSettings(command.input, tenantId);
	}
}
