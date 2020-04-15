import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { IntegrationSetting } from './integration-setting.entity';
import { CrudService } from '../core';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class IntegrationSettingService extends CrudService<IntegrationSetting> {
	constructor(
		@InjectRepository(IntegrationSetting)
		readonly repository: Repository<IntegrationSetting>
	) {
		super(repository);
	}

	async updateIntegrationSettings(updateIntegrationSettingsDto) {}
}
