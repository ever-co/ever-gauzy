import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { TenantAwareCrudService } from '../core/crud';
import { IntegrationMap } from './integration-map.entity';
import { TypeOrmIntegrationMapRepository } from './repository/type-orm-integration-map.repository';
import { MikroOrmIntegrationMapRepository } from './repository/mikro-orm-integration-map.repository';

@Injectable()
export class IntegrationMapService extends TenantAwareCrudService<IntegrationMap> {
	constructor(
		@InjectRepository(IntegrationMap)
		typeOrmIntegrationMapRepository: TypeOrmIntegrationMapRepository,

		mikroOrmIntegrationMapRepository: MikroOrmIntegrationMapRepository
	) {
		super(typeOrmIntegrationMapRepository, mikroOrmIntegrationMapRepository);
	}
}
