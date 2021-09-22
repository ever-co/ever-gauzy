import { forwardRef, Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { RequestContext } from './../../../../core/context';
import { TenantSettingGetCommand } from '../tenant-setting.get.command';
import { TenantSettingService } from './../../tenant-setting.service';

@CommandHandler(TenantSettingGetCommand)
export class TenantSettingGetHandler
	implements ICommandHandler<TenantSettingGetCommand> {
	
	constructor(
		@Inject(forwardRef(() => TenantSettingService))
		private readonly _tenantSettingService: TenantSettingService
	) {}

	public async execute() {
		const tenantId = RequestContext.currentTenantId();
		return await this._tenantSettingService.get({
			where: {
				tenantId
			}
		});
	}
}
