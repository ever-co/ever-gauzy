import { Controller, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CrudController } from './../core/crud';
import { IntegrationSettingService } from './integration-setting.service';
import { IntegrationSetting } from './integration-setting.entity';
import { TenantPermissionGuard } from './../shared/guards';


@ApiTags('IntegrationSetting')
@UseGuards(TenantPermissionGuard)
@Controller('integration-setting')
export class IntegrationSettingController extends CrudController<IntegrationSetting> {
	constructor(
		private readonly integrationSettingService: IntegrationSettingService
	) {
		super(integrationSettingService);
	}
}
