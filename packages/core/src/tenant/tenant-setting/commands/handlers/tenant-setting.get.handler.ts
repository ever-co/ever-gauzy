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
export class TenantSettingGetHandler
	implements ICommandHandler<TenantSettingGetCommand> {

	constructor(
		@Inject(forwardRef(() => TenantSettingService))
		private readonly _tenantSettingService: TenantSettingService
	) { }

	public async execute() {
		const tenantId = RequestContext.currentTenantId();
		let settings = await this._tenantSettingService.get({
			where: {
				tenantId
			}
		});
		return Object.assign(
			{},
			WrapSecrets(settings, new WasabiS3ProviderConfigDTO()),
			WrapSecrets(settings, new AwsS3ProviderConfigDTO()),
			WrapSecrets(settings, new CloudinaryProviderConfigDTO()),
			WrapSecrets(settings, new DigitalOceanS3ProviderConfigDTO()),
		);
	}
}
