import { Injectable } from '@nestjs/common';
import { CrudService } from '../core/crud';
import { TypeOrmIntegrationTypeRepository } from './repository/type-orm-integration-type.repository';
import { MikroOrmIntegrationTypeRepository } from './repository/mikro-orm-integration-type.repository';
import { IntegrationType } from './integration-type.entity';

@Injectable()
export class IntegrationTypeService extends CrudService<IntegrationType> {
	constructor(
		typeOrmIntegrationTypeRepository: TypeOrmIntegrationTypeRepository,
		mikroOrmIntegrationTypeRepository: MikroOrmIntegrationTypeRepository
	) {
		super(typeOrmIntegrationTypeRepository, mikroOrmIntegrationTypeRepository);
	}
}
