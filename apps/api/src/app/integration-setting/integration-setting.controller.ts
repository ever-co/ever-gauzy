import { Controller } from '@nestjs/common';
import { CrudController } from '../core';
import { IntegrationSettingService } from './integration-setting.service';
import { IntegrationSetting } from './integration-setting.entity';

@Controller()
export class IntegrationSettingController extends CrudController<
	IntegrationSetting
> {
	constructor(private integrationSettingService: IntegrationSettingService) {
		super(integrationSettingService);
	}
}
