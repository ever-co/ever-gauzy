import { MikroInjectRepository } from '@gauzy/common';
import { EntityRepository } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantAwareCrudService } from 'core/crud';
import { IntegrationMap } from './integration-map.entity';

@Injectable()
export class IntegrationMapService extends TenantAwareCrudService<IntegrationMap> {
	constructor(
		@InjectRepository(IntegrationMap)
		integrationMap: Repository<IntegrationMap>,
		@MikroInjectRepository(IntegrationMap)
		mikroIntegrationMap: EntityRepository<IntegrationMap>
	) {
		super(integrationMap, mikroIntegrationMap);
	}
}
