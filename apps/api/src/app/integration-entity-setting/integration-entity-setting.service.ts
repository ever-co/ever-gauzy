import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { CrudService } from '../core';
import { InjectRepository } from '@nestjs/typeorm';
import { IntegrationEntitySetting } from './integration-entity-setting.entity';

@Injectable()
export class IntegrationEntitySettingService extends CrudService<
	IntegrationEntitySetting
> {
	constructor(
		@InjectRepository(IntegrationEntitySetting)
		readonly repository: Repository<IntegrationEntitySetting>
	) {
		super(repository);
	}
}
