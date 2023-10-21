import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantAwareCrudService } from 'core/crud';
import { IntegrationMap } from './integration-map.entity';

@Injectable()
export class IntegrationMapService extends TenantAwareCrudService<IntegrationMap> {

	constructor(
		@InjectRepository(IntegrationMap)
		private readonly integrationMap: Repository<IntegrationMap>,
	) {
		super(integrationMap);
	}
}
