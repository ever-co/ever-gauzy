import { forwardRef, Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { RequestContext } from './../../../../core/context';
import { TenantSettingGetCommand } from '../tenant-setting.get.command';
import { TenantSettingService } from './../../tenant-setting.service';
import { WrapSecrets } from './../../../../core/decorators';
import {
	AwsS3ProviderConfigDTO,
	CloudinaryProviderConfigDTO,
	DigitalOceanS3ProviderConfigDTO,
	WasabiS3ProviderConfigDTO
} from './../../dto';

@CommandHandler(TenantSettingGetCommand)
export class TenantSettingGetHandler implements ICommandHandler<TenantSettingGetCommand> {
	constructor(
		@Inject(forwardRef(() => TenantSettingService))
		private readonly _tenantSettingService: TenantSettingService
	) {}

	/**
	 * Executes the retrieval and processing of tenant settings.
	 *
	 * @returns {Promise<Record<string, any>>} - Returns an object containing the tenant settings with secrets wrapped for various cloud storage providers.
	 *
	 * @throws {Error} - Throws an error if the operation fails.
	 */
	public async execute(): Promise<Record<string, any>> {
		let settings = await this._tenantSettingService.getSettings({
			where: { tenantId: RequestContext.currentTenantId() }
		});

		return Object.assign(
			{},
			WrapSecrets(settings, new WasabiS3ProviderConfigDTO()),
			WrapSecrets(settings, new AwsS3ProviderConfigDTO()),
			WrapSecrets(settings, new CloudinaryProviderConfigDTO()),
			WrapSecrets(settings, new DigitalOceanS3ProviderConfigDTO())
		);
	}
}
