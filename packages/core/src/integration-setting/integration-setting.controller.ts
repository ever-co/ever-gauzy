import { Controller, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CrudController } from '../core';
import { IntegrationSettingService } from './integration-setting.service';
import { IntegrationSetting } from './integration-setting.entity';
import { AuthGuard } from '@nestjs/passport';
import { TenantPermissionGuard } from '../shared/guards/auth/tenant-permission.guard';

@ApiTags('IntegrationSetting')
@UseGuards(AuthGuard('jwt'), TenantPermissionGuard)
@Controller()
export class IntegrationSettingController extends CrudController<IntegrationSetting> {
	constructor(private integrationSettingService: IntegrationSettingService) {
		super(integrationSettingService);
	}
}
