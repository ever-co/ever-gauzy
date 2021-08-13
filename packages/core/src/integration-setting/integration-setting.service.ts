import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { IntegrationSetting } from './integration-setting.entity';
import { TenantAwareCrudService } from './../core/crud';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class IntegrationSettingService extends TenantAwareCrudService<IntegrationSetting> {
	constructor(
		@InjectRepository(IntegrationSetting)
		readonly repository: Repository<IntegrationSetting>
	) {
		super(repository);
	}

	async updateIntegrationSettings(updateIntegrationSettingsDto) {}
}
