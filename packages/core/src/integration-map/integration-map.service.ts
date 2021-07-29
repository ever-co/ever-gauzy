import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { IntegrationMap } from './integration-map.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { TenantAwareCrudService } from './../core/crud';

@Injectable()
export class IntegrationMapService extends TenantAwareCrudService<IntegrationMap> {
	constructor(
		@InjectRepository(IntegrationMap)
		readonly repository: Repository<IntegrationMap>
	) {
		super(repository);
	}
}
