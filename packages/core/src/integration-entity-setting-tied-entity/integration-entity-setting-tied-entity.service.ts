import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { TenantAwareCrudService } from './../core/crud';
import { InjectRepository } from '@nestjs/typeorm';
import { IntegrationEntitySettingTiedEntity } from './integration-entity-setting-tied-entity.entity';

@Injectable()
export class IntegrationEntitySettingTiedEntityService extends TenantAwareCrudService<IntegrationEntitySettingTiedEntity> {
	constructor(
		@InjectRepository(IntegrationEntitySettingTiedEntity)
		readonly repository: Repository<IntegrationEntitySettingTiedEntity>
	) {
		super(repository);
	}
}
