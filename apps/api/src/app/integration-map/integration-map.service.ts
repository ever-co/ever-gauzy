import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { IntegrationMap } from './integration-map.entity';
import { CrudService } from '../core';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class IntegrationMapService extends CrudService<IntegrationMap> {
	constructor(
		@InjectRepository(IntegrationMap)
		readonly repository: Repository<IntegrationMap>
	) {
		super(repository);
	}
}
