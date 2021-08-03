import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { TenantAwareCrudService } from './../core/crud';
import { InjectRepository } from '@nestjs/typeorm';
import { IntegrationEntitySetting } from './integration-entity-setting.entity';

@Injectable()
export class IntegrationEntitySettingService extends TenantAwareCrudService<IntegrationEntitySetting> {
	constructor(
		@InjectRepository(IntegrationEntitySetting)
		readonly repository: Repository<IntegrationEntitySetting>
	) {
		super(repository);
	}
}
