import { Controller, UseGuards } from '@nestjs/common';
import { CrudController } from '../core';
import { IntegrationSettingService } from './integration-setting.service';
import { IntegrationSetting } from './integration-setting.entity';
import { AuthGuard } from '@nestjs/passport';

@UseGuards(AuthGuard('jwt'))
@Controller()
export class IntegrationSettingController extends CrudController<
	IntegrationSetting
> {
	constructor(private integrationSettingService: IntegrationSettingService) {
		super(integrationSettingService);
	}
}
