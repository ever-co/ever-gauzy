import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { CrudService } from '../core';
import { InjectRepository } from '@nestjs/typeorm';
import { IntegrationEntitySettingTiedEntity } from './integration-entity-setting-tied-entitiy.entity';

@Injectable()
export class IntegrationEntitySettingTiedEntityService extends CrudService<
	IntegrationEntitySettingTiedEntity
> {
	constructor(
		@InjectRepository(IntegrationEntitySettingTiedEntity)
		readonly repository: Repository<IntegrationEntitySettingTiedEntity>
	) {
		super(repository);
	}
}
