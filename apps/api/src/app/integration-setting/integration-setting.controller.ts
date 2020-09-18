import { Controller, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CrudController } from '../core';
import { IntegrationSettingService } from './integration-setting.service';
import { IntegrationSetting } from './integration-setting.entity';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('IntegrationSetting')
@UseGuards(AuthGuard('jwt'))
@Controller()
export class IntegrationSettingController extends CrudController<
	IntegrationSetting
> {
	constructor(private integrationSettingService: IntegrationSettingService) {
		super(integrationSettingService);
	}
}
